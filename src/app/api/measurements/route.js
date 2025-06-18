// src/app/api/measurements/route.js
import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';
import { writeMeasurement, writeBatchMeasurements, queryMeasurements } from '@/lib/db/influx';
import { cache } from '@/lib/db/redis';
import { authMiddleware } from '@/lib/auth/middleware';
import { validate, measurementSchema, batchMeasurementSchema, measurementQuerySchema } from '@/lib/validation/schemas';
import { successResponse } from '@/lib/utils/response';
import { asyncHandler, ValidationError } from '@/lib/utils/errors';

// POST /api/measurements - Submit measurements
export const POST = authMiddleware(asyncHandler(async (request) => {
  const body = await request.json();
  
  // Handle single or batch measurements
  const isBatch = Array.isArray(body);
  const measurements = isBatch ? body : [body];
  
  // Validate measurements
  const validated = await validate(
    isBatch ? batchMeasurementSchema : measurementSchema
  )(body);
  
  const validMeasurements = isBatch ? validated : [validated];
  
  // Process measurements
  const results = {
    successful: 0,
    failed: 0,
    errors: []
  };
  
  for (const measurement of validMeasurements) {
    try {
      // Get element details for validation and tags
      const elementResult = await query(
        'SELECT id, element_type, status FROM grid_elements WHERE id = $1 AND deleted_at IS NULL',
        [measurement.element_id]
      );
      
      if (elementResult.rows.length === 0) {
        results.failed++;
        results.errors.push({
          element_id: measurement.element_id,
          error: 'Element not found'
        });
        continue;
      }
      
      const element = elementResult.rows[0];
      
      // Write to InfluxDB
      await writeMeasurement(
        element.id,
        element.element_type,
        measurement.measurements
      );
      
      // Update Redis cache for real-time data
      await cache.set(
        `measurements:${element.id}:latest`,
        {
          ...measurement.measurements,
          timestamp: measurement.timestamp || new Date().toISOString(),
          element_type: element.element_type,
          status: element.status
        },
        60 // 1 minute TTL
      );
      
      // Check thresholds and generate alarms if needed
      await checkThresholds(element, measurement.measurements);
      
      results.successful++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        element_id: measurement.element_id,
        error: error.message
      });
    }
  }
  
  return successResponse({
    message: 'Measurements processed',
    successful: results.successful,
    failed: results.failed,
    errors: results.errors.slice(0, 10) // Limit errors in response
  });
}));

// GET /api/measurements - Query measurements
export const GET = authMiddleware(asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams);
  
  // Validate query parameters
  const validated = await validate(measurementQuerySchema)(params);
  const { element_id, start, stop, aggregation, window } = validated;

  // Check cache for recent queries
  const cacheKey = `measurements:query:${JSON.stringify(validated)}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return successResponse(cached);
  }
  
  // Verify element exists
  const elementResult = await query(
    'SELECT element_type FROM grid_elements WHERE id = $1 AND deleted_at IS NULL',
    [element_id]
  );
  if (elementResult.rows.length === 0) {
    throw new NotFoundError('Element');
  }
  
  // Query InfluxDB
  const data = await queryMeasurements(element_id, start, stop, aggregation, window);
  
  const response = {
    element_id,
    element_type: elementResult.rows[0].element_type,
    start,
    stop,
    aggregation,
    window,
    data
  };
  
  // Cache for 1 minute for recent data, longer for historical
  const cacheTTL = start === '-1h' ? 60 : 300;
  await cache.set(cacheKey, response, cacheTTL);
  
  return successResponse(response);
}));

// Helper function to check thresholds
async function checkThresholds(element, measurements) {
  // Define thresholds based on element type
  const thresholds = {
    load: {
      voltage: { min: 0.95, max: 1.05 }, // ±5% of nominal
      current: { max: 1.0 }, // 100% of rated
      power_factor: { min: 0.8 }
    },
    generator: {
      voltage: { min: 0.95, max: 1.05 },
      frequency: { min: 49.5, max: 50.5 }, // ±0.5 Hz
      power: { max: 1.0 } // 100% of rated capacity
    },
    transformer: {
      temperature: { max: 85 }, // °C
      current: { max: 1.1 } // 110% overload capability
    }
  };
  
  const elementThresholds = thresholds[element.element_type] || {};
  
  for (const [metric, value] of Object.entries(measurements)) {
    const threshold = elementThresholds[metric];
    if (!threshold) continue;
    
    let violated = false;
    let description = '';
    
    if (threshold.min !== undefined && value < threshold.min) {
      violated = true;
      description = `${metric} below minimum: ${value} < ${threshold.min}`;
    } else if (threshold.max !== undefined && value > threshold.max) {
      violated = true;
      description = `${metric} above maximum: ${value} > ${threshold.max}`;
    }
    
    if (violated) {
      // Create event in database
      await query(`
        INSERT INTO events (
          element_id, event_type, severity, category, 
          description, parameters, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        element.id,
        'alarm',
        value > threshold.max * 1.2 || value < threshold.min * 0.8 ? 'critical' : 'high',
        'threshold_violation',
        description,
        JSON.stringify({
          metric,
          value,
          threshold,
          timestamp: new Date().toISOString()
        }),
        'active'
      ]);
      
      // Store in Redis for real-time alerts
      await cache.set(
        `alarm:${element.id}:${metric}`,
        {
          element_id: element.id,
          metric,
          value,
          threshold,
          description,
          timestamp: new Date().toISOString()
        },
        300 // 5 minutes
      );
    }
  }
}
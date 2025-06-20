// src/app/api/elements/route.js
import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db/postgres';
import { cache } from '@/lib/db/redis';
import { authMiddleware, operatorOnly } from '@/lib/auth/middleware';
import { validate, createElementSchema, elementQuerySchema } from '@/lib/validation/schemas';
import { paginatedResponse, createdResponse } from '@/lib/utils/response';
import { asyncHandler, ValidationError, ConflictError } from '@/lib/utils/errors';

// GET /api/elements - Get all elements with filtering
export const GET = authMiddleware(asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams);
  
  // Validate query parameters
  const validated = await validate(elementQuerySchema)(params);
  const { page, limit, type, status, search, voltage_level, sort_by = 'created_at', sort_order = 'desc' } = validated;
  const offset = (page - 1) * limit;

  // Build cache key
  const cacheKey = `elements:${JSON.stringify(validated)}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return paginatedResponse(cached.data, cached.pagination);
  }

  // Build query
  let whereConditions = ['e.deleted_at IS NULL'];
  const queryParams = [];
  let paramCount = 0;

  if (type) {
    queryParams.push(type);
    whereConditions.push(`e.element_type = $${++paramCount}`);
  }

  if (status) {
    queryParams.push(status);
    whereConditions.push(`e.status = $${++paramCount}`);
  }

  if (search) {
    queryParams.push(`%${search}%`);
    whereConditions.push(`(e.name ILIKE $${++paramCount} OR e.description ILIKE $${paramCount})`);
  }

  if (voltage_level) {
    queryParams.push(voltage_level);
    whereConditions.push(`(
      (e.element_type = 'bus' AND b.voltage_level = $${++paramCount}) OR
      (e.element_type = 'line' AND tl.voltage_level = $${paramCount}) OR
      (e.element_type = 'transformer' AND (t.primary_voltage = $${paramCount} OR t.secondary_voltage = $${paramCount})) OR
      (e.element_type = 'generator' AND g.voltage_level = $${paramCount}) OR
      (e.element_type = 'load' AND l.voltage_level = $${paramCount})
    )`);
  }

  const whereClause = whereConditions.join(' AND ');

  // Get total count
  const countResult = await query(
    `SELECT COUNT(DISTINCT e.id) 
     FROM grid_elements e
     LEFT JOIN loads l ON e.id = l.id
     LEFT JOIN generators g ON e.id = g.id
     LEFT JOIN transformers t ON e.id = t.id
     LEFT JOIN transmission_lines tl ON e.id = tl.id
     LEFT JOIN buses b ON e.id = b.id
     WHERE ${whereClause}`,
    queryParams
  );
  const total = parseInt(countResult.rows[0].count);

  // Get elements with properties
  queryParams.push(limit);
  queryParams.push(offset);
  
  const result = await query(`
    SELECT 
      e.*,
      CASE 
        WHEN e.element_type = 'load' THEN jsonb_build_object(
          'load_type', l.load_type,
          'connection_type', l.connection_type,
          'rated_power', l.rated_power,
          'power_factor', l.power_factor,
          'voltage_level', l.voltage_level,
          'priority', l.priority,
          'bus_id', l.bus_id
        )
        WHEN e.element_type = 'generator' THEN jsonb_build_object(
          'generation_type', g.generation_type,
          'rated_capacity', g.rated_capacity,
          'min_capacity', g.min_capacity,
          'max_capacity', g.max_capacity,
          'ramp_rate', g.ramp_rate,
          'efficiency', g.efficiency,
          'fuel_type', g.fuel_type,
          'voltage_level', g.voltage_level,
          'bus_id', g.bus_id
        )
        WHEN e.element_type = 'transformer' THEN jsonb_build_object(
          'primary_voltage', t.primary_voltage,
          'secondary_voltage', t.secondary_voltage,
          'rated_power', t.rated_power,
          'current_tap', t.current_tap,
          'min_tap', t.min_tap,
          'max_tap', t.max_tap,
          'tap_step_size', t.tap_step_size,
          'winding_configuration', t.winding_configuration,
          'cooling_type', t.cooling_type,
          'primary_bus_id', t.primary_bus_id,
          'secondary_bus_id', t.secondary_bus_id
        )
        WHEN e.element_type = 'line' THEN (
          SELECT jsonb_build_object(
            'voltage_level', tl.voltage_level,
            'length', tl.length,
            'conductor_type', tl.conductor_type,
            'rated_current', tl.rated_current,
            'resistance', tl.resistance,
            'reactance', tl.reactance,
            'coordinates', COALESCE(
              (SELECT json_agg(
                json_build_object(
                  'id', lc.id,
                  'sequence_order', lc.sequence_order,
                  'latitude', lc.latitude,
                  'longitude', lc.longitude,
                  'elevation', lc.elevation,
                  'point_type', lc.point_type,
                  'description', lc.description
                ) ORDER BY lc.sequence_order
              ) FROM line_coordinates lc WHERE lc.line_id = tl.id),
              '[]'::json
            )
          ) FROM transmission_lines tl WHERE tl.id = e.id
        )
        WHEN e.element_type = 'bus' THEN jsonb_build_object(
          'voltage_level', b.voltage_level,
          'bus_type', b.bus_type,
          'substation_id', b.substation_id,
          'nominal_voltage', b.nominal_voltage,
          'voltage_tolerance_min', b.voltage_tolerance_min,
          'voltage_tolerance_max', b.voltage_tolerance_max
        )
      END as properties
    FROM grid_elements e
    LEFT JOIN loads l ON e.id = l.id
    LEFT JOIN generators g ON e.id = g.id
    LEFT JOIN transformers t ON e.id = t.id
    LEFT JOIN transmission_lines tl ON e.id = tl.id
    LEFT JOIN buses b ON e.id = b.id
    WHERE ${whereClause}
    ORDER BY e.${sort_by} ${sort_order}
    LIMIT $${++paramCount} OFFSET $${++paramCount}
  `, queryParams);

  const response = {
    data: result.rows,
    pagination: { page, limit, total }
  };

  // Cache for 5 minutes
  await cache.set(cacheKey, response, 300);

  return paginatedResponse(result.rows, { page, limit, total });
}));

// POST /api/elements - Create new element
export const POST = operatorOnly(asyncHandler(async (request) => {
  const body = await request.json();
  const validated = await validate(createElementSchema)(body);
  const result = await withTransaction(async (client) => {
    // Check for duplicate names
    const existing = await client.query(
      'SELECT id FROM grid_elements WHERE name = $1 AND deleted_at IS NULL',
      [validated.name]
    );

    if (existing.rows.length > 0) {
      throw new ConflictError('An element with this name already exists');
    }

    // Insert base element
    const elementResult = await client.query(`
      INSERT INTO grid_elements (
        element_type, name, description, 
        latitude, longitude, address,
        status, commissioning_date, manufacturer, 
        model, installation_date, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      validated.type,
      validated.name,
      validated.description,
      validated.location?.latitude,
      validated.location?.longitude,
      validated.location?.address,
      validated.status || 'active',
      validated.commissioning_date,
      validated.manufacturer,
      validated.model,
      validated.installation_date,
      JSON.stringify(validated.metadata || {})
    ]);

    const element = elementResult.rows[0];

    // Insert type-specific properties
    let properties = {};
    
    switch (validated.type) {
      case 'load':
        if (validated.load_properties) {
          const loadResult = await client.query(`
            INSERT INTO loads (
              id, load_type, connection_type, rated_power,
              power_factor, voltage_level, priority, bus_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
          `, [
            element.id,
            validated.load_properties.load_type,
            validated.load_properties.connection_type,
            validated.load_properties.rated_power,
            validated.load_properties.power_factor,
            validated.load_properties.voltage_level,
            validated.load_properties.priority || 'medium',
            validated.load_properties.bus_id
          ]);
          properties = loadResult.rows[0];
        }
        break;

      case 'generator':
        if (validated.generator_properties) {
          const genResult = await client.query(`
            INSERT INTO generators (
              id, generation_type, rated_capacity, min_capacity,
              max_capacity, ramp_rate, efficiency, fuel_type,
              voltage_level, bus_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
          `, [
            element.id,
            validated.generator_properties.generation_type,
            validated.generator_properties.rated_capacity,
            validated.generator_properties.min_capacity,
            validated.generator_properties.max_capacity,
            validated.generator_properties.ramp_rate,
            validated.generator_properties.efficiency,
            validated.generator_properties.fuel_type,
            validated.generator_properties.voltage_level,
            validated.generator_properties.bus_id
          ]);
          properties = genResult.rows[0];
        }
        break;

      case 'transformer':
        if (validated.transformer_properties) {
          const transResult = await client.query(`
            INSERT INTO transformers (
              id, primary_voltage, secondary_voltage, rated_power,
              current_tap, min_tap, max_tap, tap_step_size,
              winding_configuration, cooling_type, primary_bus_id, secondary_bus_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
          `, [
            element.id,
            validated.transformer_properties.primary_voltage,
            validated.transformer_properties.secondary_voltage,
            validated.transformer_properties.rated_power,
            validated.transformer_properties.current_tap || 0,
            validated.transformer_properties.min_tap || -10,
            validated.transformer_properties.max_tap || 10,
            validated.transformer_properties.tap_step_size || 1.25,
            validated.transformer_properties.winding_configuration,
            validated.transformer_properties.cooling_type,
            validated.transformer_properties.primary_bus_id,
            validated.transformer_properties.secondary_bus_id
          ]);
          properties = transResult.rows[0];
        }
        break;

        case 'line':
        if (validated.line_properties) {
          const lineResult = await client.query(`
            INSERT INTO transmission_lines (
              id, voltage_level, conductor_type, rated_current,
              resistance, reactance, length
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
          `, [
            element.id,
            validated.line_properties.voltage_level,
            validated.line_properties.conductor_type,
            validated.line_properties.rated_current,
            validated.line_properties.resistance,
            validated.line_properties.reactance,
            validated.line_properties.length || 0
          ]);

          // Insert line coordinates if provided
          if (validated.line_properties.coordinates && validated.line_properties.coordinates.length >= 2) {
            let totalLength = 0;
            
            for (let i = 0; i < validated.line_properties.coordinates.length; i++) {
              const coord = validated.line_properties.coordinates[i];
              await client.query(`
                INSERT INTO line_coordinates (
                  line_id, sequence_order, latitude, longitude,
                  elevation, point_type, description
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              `, [
                element.id,
                i,
                coord.latitude,
                coord.longitude,
                coord.elevation || null,
                coord.point_type,
                coord.description
              ]);

              // Calculate distance for length
              if (i > 0) {
                const prev = validated.line_properties.coordinates[i - 1];
                totalLength += haversineDistance(
                  prev.latitude, prev.longitude,
                  coord.latitude, coord.longitude
                );
              }
            }

            // Update calculated length
            await client.query(
              'UPDATE transmission_lines SET length = $2 WHERE id = $1',
              [element.id, totalLength]
            );
          }

          properties = lineResult.rows[0];
        }
        break;

      case 'bus':
        if (validated.bus_properties) {
          const busResult = await client.query(`
            INSERT INTO buses (
              id, voltage_level, bus_type, substation_id,
              nominal_voltage, voltage_tolerance_min, voltage_tolerance_max
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
          `, [
            element.id,
            validated.bus_properties.voltage_level,
            validated.bus_properties.bus_type || 'pq',
            validated.bus_properties.substation_id,
            validated.bus_properties.nominal_voltage,
            validated.bus_properties.voltage_tolerance_min || 0.95,
            validated.bus_properties.voltage_tolerance_max || 1.05
          ]);
          properties = busResult.rows[0];
        }
        break;
    }

    // Delete the id from properties to avoid duplication
    delete properties.id;

    return { ...element, properties };
  });

  // Invalidate cache
  await cache.invalidatePattern('elements:*');

  // Log audit
  await query(`
    INSERT INTO audit_log (user_id, action, table_name, record_id, new_values)
    VALUES ($1, $2, $3, $4, $5)
  `, [
    request.auth.userId,
    'create',
    'grid_elements',
    result.id,
    JSON.stringify(result)
  ]);

  return createdResponse(result, 'Element created successfully');
}));

// Helper function to add to the route file
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
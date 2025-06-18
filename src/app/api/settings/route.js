// src/app/api/settings/route.js
import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';
import { cache } from '@/lib/db/redis';
import { adminOnly, authMiddleware } from '@/lib/auth/middleware';
import { successResponse } from '@/lib/utils/response';
import { asyncHandler } from '@/lib/utils/errors';

// GET /api/settings - Get system settings
export const GET = authMiddleware(asyncHandler(async (request) => {
  const cacheKey = 'system:settings';
  const cached = await cache.get(cacheKey);
  if (cached) {
    return successResponse(cached);
  }

  // Get system statistics
  const [elements, users, measurements, events] = await Promise.all([
    query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'maintenance' THEN 1 END) as maintenance,
        COUNT(CASE WHEN status = 'fault' THEN 1 END) as fault
      FROM grid_elements
      WHERE deleted_at IS NULL
    `),
    query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_active THEN 1 END) as active,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
        COUNT(CASE WHEN role = 'operator' THEN 1 END) as operators,
        COUNT(CASE WHEN role = 'viewer' THEN 1 END) as viewers
      FROM users
    `),
    query(`
      SELECT 
        COUNT(*) as total_imports,
        SUM(records_imported) as total_records,
        MAX(import_completed_at) as last_import
      FROM data_imports
      WHERE status = 'completed'
    `),
    query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high
      FROM events
      WHERE created_at > NOW() - INTERVAL '7 days'
    `)
  ]);

  const settings = {
    system: {
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database_url: process.env.DATABASE_URL ? 'configured' : 'not configured',
      redis_url: process.env.REDIS_HOST ? 'configured' : 'not configured',
      influxdb_url: process.env.INFLUXDB_URL ? 'configured' : 'not configured'
    },
    statistics: {
      elements: {
        total: parseInt(elements.rows[0].total),
        active: parseInt(elements.rows[0].active),
        maintenance: parseInt(elements.rows[0].maintenance),
        fault: parseInt(elements.rows[0].fault)
      },
      users: {
        total: parseInt(users.rows[0].total),
        active: parseInt(users.rows[0].active),
        by_role: {
          admins: parseInt(users.rows[0].admins),
          operators: parseInt(users.rows[0].operators),
          viewers: parseInt(users.rows[0].viewers)
        }
      },
      data: {
        total_imports: parseInt(measurements.rows[0].total_imports) || 0,
        total_measurements: parseInt(measurements.rows[0].total_records) || 0,
        last_import: measurements.rows[0].last_import
      },
      events: {
        last_7_days: {
          total: parseInt(events.rows[0].total),
          active: parseInt(events.rows[0].active),
          critical: parseInt(events.rows[0].critical),
          high: parseInt(events.rows[0].high)
        }
      }
    },
    thresholds: {
      voltage: {
        min_deviation: 0.95,
        max_deviation: 1.05,
        unit: 'pu'
      },
      frequency: {
        min: 49.5,
        max: 50.5,
        unit: 'Hz'
      },
      temperature: {
        warning: 75,
        critical: 85,
        unit: '°C'
      }
    },
    rate_limits: {
      default: {
        window: 60000,
        max_requests: 100
      },
      api_key: {
        window: 60000,
        max_requests: 1000
      }
    },
    features: {
      real_time_streaming: true,
      import_export: true,
      analytics: true,
      power_flow_analysis: false, // Coming soon
      forecasting: false // Coming soon
    }
  };

  // Cache for 5 minutes
  await cache.set(cacheKey, settings, 300);

  return successResponse(settings);
}));

// PUT /api/settings - Update system settings
export const PUT = adminOnly(asyncHandler(async (request) => {
  const body = await request.json();

  // For now, only support updating thresholds
  if (body.thresholds) {
    // Store in cache (in production, store in database)
    await cache.set('system:thresholds', body.thresholds, 0); // No expiry
    
    // Log audit
    await query(`
      INSERT INTO audit_log (user_id, action, table_name, new_values)
      VALUES ($1, $2, $3, $4)
    `, [
      request.auth.userId,
      'update_settings',
      'system',
      JSON.stringify({ thresholds: body.thresholds })
    ]);
  }

  // Clear settings cache
  await cache.delete('system:settings');

  return successResponse({ message: 'Settings updated successfully' });
}));
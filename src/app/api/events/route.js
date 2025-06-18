// src/app/api/events/route.js
import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';
import { writeEvent } from '@/lib/db/influx';
import { cache } from '@/lib/db/redis';
import { authMiddleware, operatorOnly } from '@/lib/auth/middleware';
import { paginatedResponse, successResponse } from '@/lib/utils/response';
import { asyncHandler } from '@/lib/utils/errors';

// GET /api/events - List events/alarms
export const GET = authMiddleware(asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const status = searchParams.get('status');
  const severity = searchParams.get('severity');
  const eventType = searchParams.get('event_type');
  const elementId = searchParams.get('element_id');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const offset = (page - 1) * limit;

  // Build query
  let whereConditions = [];
  const params = [];
  let paramCount = 0;

  if (status) {
    params.push(status);
    whereConditions.push(`ev.status = $${++paramCount}`);
  }

  if (severity) {
    params.push(severity);
    whereConditions.push(`ev.severity = $${++paramCount}`);
  }

  if (eventType) {
    params.push(eventType);
    whereConditions.push(`ev.event_type = $${++paramCount}`);
  }

  if (elementId) {
    params.push(elementId);
    whereConditions.push(`ev.element_id = $${++paramCount}`);
  }

  if (startDate) {
    params.push(startDate);
    whereConditions.push(`ev.created_at >= $${++paramCount}`);
  }

  if (endDate) {
    params.push(endDate);
    whereConditions.push(`ev.created_at <= $${++paramCount}`);
  }

  const whereClause = whereConditions.length > 0 
    ? 'WHERE ' + whereConditions.join(' AND ')
    : '';

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) FROM events ev ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  // Get events
  params.push(limit);
  params.push(offset);
  
  const result = await query(`
    SELECT 
      ev.*,
      e.name as element_name,
      e.element_type,
      u1.name as acknowledged_by_name,
      u2.name as resolved_by_name,
      EXTRACT(EPOCH FROM (COALESCE(ev.resolved_at, NOW()) - ev.created_at))/60 as duration_minutes
    FROM events ev
    JOIN grid_elements e ON ev.element_id = e.id
    LEFT JOIN users u1 ON ev.acknowledged_by = u1.id
    LEFT JOIN users u2 ON ev.resolved_by = u2.id
    ${whereClause}
    ORDER BY 
      CASE WHEN ev.status = 'active' THEN 0 ELSE 1 END,
      CASE ev.severity 
        WHEN 'critical' THEN 0 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
      END,
      ev.created_at DESC
    LIMIT $${++paramCount} OFFSET $${++paramCount}
  `, params);

  return paginatedResponse(result.rows, { page, limit, total });
}));

// POST /api/events - Create new event (usually automated)
export const POST = operatorOnly(asyncHandler(async (request) => {
  const body = await request.json();
  
  const result = await query(`
    INSERT INTO events (
      element_id, event_type, severity, category,
      description, parameters, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [
    body.element_id,
    body.event_type || 'alarm',
    body.severity || 'medium',
    body.category,
    body.description,
    JSON.stringify(body.parameters || {}),
    'active'
  ]);

  const event = result.rows[0];

  // Write to InfluxDB for time-series analysis
  await writeEvent(
    event.element_id,
    event.event_type,
    event.severity,
    event.description,
    body.parameters
  );

  // Store in Redis for real-time alerts
  if (event.severity === 'critical' || event.severity === 'high') {
    await cache.set(
      `event:active:${event.id}`,
      event,
      3600 // 1 hour TTL
    );
  }

  // Get element details for response
  const elementResult = await query(
    'SELECT name, element_type FROM grid_elements WHERE id = $1',
    [event.element_id]
  );

  return successResponse({
    ...event,
    element_name: elementResult.rows[0]?.name,
    element_type: elementResult.rows[0]?.element_type
  }, 'Event created successfully');
}));
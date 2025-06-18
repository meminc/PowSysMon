// src/app/api/events/[id]/route.js
import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';
import { cache } from '@/lib/db/redis';
import { authMiddleware, operatorOnly } from '@/lib/auth/middleware';
import { successResponse } from '@/lib/utils/response';
import { asyncHandler, NotFoundError } from '@/lib/utils/errors';

// GET /api/events/[id] - Get event details
export const GET = authMiddleware(asyncHandler(async (request, { params }) => {
  const { id } = await params;

  const result = await query(`
    SELECT 
      ev.*,
      e.name as element_name,
      e.element_type,
      e.status as element_status,
      u1.name as acknowledged_by_name,
      u2.name as resolved_by_name,
      EXTRACT(EPOCH FROM (COALESCE(ev.resolved_at, NOW()) - ev.created_at))/60 as duration_minutes
    FROM events ev
    JOIN grid_elements e ON ev.element_id = e.id
    LEFT JOIN users u1 ON ev.acknowledged_by = u1.id
    LEFT JOIN users u2 ON ev.resolved_by = u2.id
    WHERE ev.id = $1
  `, [id]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Event');
  }

  return successResponse(result.rows[0]);
}));

// PUT /api/events/[id] - Update event (acknowledge/resolve)
export const PUT = operatorOnly(asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json();

  // Get current event
  const current = await query(
    'SELECT * FROM events WHERE id = $1',
    [id]
  );

  if (current.rows.length === 0) {
    throw new NotFoundError('Event');
  }

  const currentEvent = current.rows[0];
  let updateFields = [];
  const updateValues = [];
  let paramCount = 1;

  // Handle acknowledgment
  if (body.action === 'acknowledge' && !currentEvent.acknowledged_at) {
    updateFields.push(`acknowledged_at = CURRENT_TIMESTAMP`);
    updateFields.push(`acknowledged_by = $${++paramCount}`);
    updateValues.push(request.auth.userId);
  }

  // Handle resolution
  if (body.action === 'resolve' && currentEvent.status === 'active') {
    updateFields.push(`status = 'resolved'`);
    updateFields.push(`resolved_at = CURRENT_TIMESTAMP`);
    updateFields.push(`resolved_by = $${++paramCount}`);
    updateValues.push(request.auth.userId);
    
    if (body.resolution_notes) {
      updateFields.push(`parameters = parameters || $${++paramCount}`);
      updateValues.push(JSON.stringify({ resolution_notes: body.resolution_notes }));
    }
  }

  // Handle status update
  if (body.status && ['active', 'acknowledged', 'resolved'].includes(body.status)) {
    updateFields.push(`status = ${++paramCount}`);
    updateValues.push(body.status);
  }

  // Handle severity update
  if (body.severity && ['critical', 'high', 'medium', 'low'].includes(body.severity)) {
    updateFields.push(`severity = ${++paramCount}`);
    updateValues.push(body.severity);
  }

  if (updateFields.length === 0) {
    return successResponse(currentEvent, 'No changes made');
  }
  console.log("updateFields", updateFields);
  console.log("updateValues", updateValues);
  const result = await query(`
    UPDATE events
    SET ${updateFields.join(', ')}
    WHERE id = $1
    RETURNING *
  `, [id, ...updateValues]);

  const updatedEvent = result.rows[0];

  // Update or remove from Redis cache
  if (updatedEvent.status === 'resolved') {
    await cache.delete(`event:active:${id}`);
  } else if (updatedEvent.severity === 'critical' || updatedEvent.severity === 'high') {
    await cache.set(`event:active:${id}`, updatedEvent, 3600);
  }

  // Log audit
  await query(`
    INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    request.auth.userId,
    body.action || 'update_event',
    'events',
    id,
    JSON.stringify({ 
      status: currentEvent.status, 
      severity: currentEvent.severity 
    }),
    JSON.stringify({ 
      status: updatedEvent.status, 
      severity: updatedEvent.severity 
    })
  ]);

  // Get additional details for response
  const details = await query(`
    SELECT 
      e.name as element_name,
      e.element_type,
      u1.name as acknowledged_by_name,
      u2.name as resolved_by_name
    FROM events ev
    JOIN grid_elements e ON ev.element_id = e.id
    LEFT JOIN users u1 ON ev.acknowledged_by = u1.id
    LEFT JOIN users u2 ON ev.resolved_by = u2.id
    WHERE ev.id = $1
  `, [id]);

  return successResponse({
    ...updatedEvent,
    ...details.rows[0]
  }, `Event ${body.action || 'updated'} successfully`);
}));

// DELETE /api/events/[id] - Delete event (soft delete)
export const DELETE = operatorOnly(asyncHandler(async (request, { params }) => {
  const { id } = await params;

  // Only allow deletion of resolved events
  const result = await query(`
    UPDATE events
    SET status = 'deleted'
    WHERE id = $1 AND status = 'resolved'
    RETURNING id, description
  `, [id]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Event not found or cannot be deleted');
  }

  // Remove from cache
  await cache.delete(`event:active:${id}`);

  // Log audit
  await query(`
    INSERT INTO audit_log (user_id, action, table_name, record_id)
    VALUES ($1, $2, $3, $4)
  `, [
    request.auth.userId,
    'delete_event',
    'events',
    id
  ]);

  return successResponse({
    id,
    message: 'Event deleted successfully'
  });
}));
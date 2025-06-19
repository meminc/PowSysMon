// src/app/api/elements/lines/[id]/coordinates/route.js
import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db/postgres';
import { cache } from '@/lib/db/redis';
import { operatorOnly } from '@/lib/auth/middleware';
import { successResponse } from '@/lib/utils/response';
import { asyncHandler, ValidationError, NotFoundError } from '@/lib/utils/errors';
import { z } from 'zod';

const coordinateSchema = z.object({
  sequence_order: z.number().int().min(0),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  elevation: z.number().optional(),
  point_type: z.enum(['start', 'end', 'intermediate', 'tower', 'junction']).default('intermediate'),
  description: z.string().optional()
});

const coordinatesArraySchema = z.array(coordinateSchema).min(2, 'At least 2 coordinates are required');

// GET /api/elements/lines/[id]/coordinates - Get line coordinates
export const GET = operatorOnly(asyncHandler(async (request, { params }) => {
  const { id } = await params;

  const result = await query(`
    SELECT 
      lc.*,
      tl.name as line_name
    FROM line_coordinates lc
    JOIN transmission_lines tl ON lc.line_id = tl.id
    JOIN grid_elements e ON tl.id = e.id
    WHERE lc.line_id = $1 AND e.deleted_at IS NULL
    ORDER BY lc.sequence_order
  `, [id]);

  if (result.rows.length === 0) {
    // Check if line exists
    const lineCheck = await query(
      'SELECT id FROM transmission_lines WHERE id = $1',
      [id]
    );
    
    if (lineCheck.rows.length === 0) {
      throw new NotFoundError('Transmission line');
    }
  }

  return successResponse(result.rows);
}));

// PUT /api/elements/lines/[id]/coordinates - Update all coordinates for a line
export const PUT = operatorOnly(asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json();
  
  // Validate coordinates
  const coordinates = coordinatesArraySchema.parse(body.coordinates);

  // Ensure sequence orders are consecutive starting from 0
  const sortedCoordinates = coordinates
    .sort((a, b) => a.sequence_order - b.sequence_order)
    .map((coord, index) => ({ ...coord, sequence_order: index }));

  const result = await withTransaction(async (client) => {
    // Verify line exists
    const lineCheck = await client.query(
      'SELECT id FROM transmission_lines WHERE id = $1',
      [id]
    );
    
    if (lineCheck.rows.length === 0) {
      throw new NotFoundError('Transmission line');
    }

    // Delete existing coordinates
    await client.query(
      'DELETE FROM line_coordinates WHERE line_id = $1',
      [id]
    );

    // Insert new coordinates
    const insertedCoordinates = [];
    for (const coord of sortedCoordinates) {
      const coordResult = await client.query(`
        INSERT INTO line_coordinates (
          line_id, sequence_order, latitude, longitude, 
          elevation, point_type, description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        id,
        coord.sequence_order,
        coord.latitude,
        coord.longitude,
        coord.elevation || null,
        coord.point_type,
        coord.description || null
      ]);
      insertedCoordinates.push(coordResult.rows[0]);
    }

    // Update line length based on coordinates
    const totalLength = calculateLineLength(sortedCoordinates);
    await client.query(
      'UPDATE transmission_lines SET length = $2 WHERE id = $1',
      [id, totalLength]
    );

    return insertedCoordinates;
  });

  // Invalidate cache
  await cache.delete(`element:${id}`);
  await cache.invalidatePattern('elements:*');

  // Log audit
  await query(`
    INSERT INTO audit_log (user_id, action, table_name, record_id, new_values)
    VALUES ($1, $2, $3, $4, $5)
  `, [
    request.auth.userId,
    'update_line_coordinates',
    'line_coordinates',
    id,
    JSON.stringify({ coordinates: result })
  ]);

  return successResponse(result, 'Line coordinates updated successfully');
}));

// Helper function to calculate line length using Haversine formula
function calculateLineLength(coordinates) {
  let totalLength = 0;
  
  for (let i = 1; i < coordinates.length; i++) {
    const prev = coordinates[i - 1];
    const curr = coordinates[i];
    totalLength += haversineDistance(
      prev.latitude, prev.longitude,
      curr.latitude, curr.longitude
    );
  }
  
  return totalLength;
}

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
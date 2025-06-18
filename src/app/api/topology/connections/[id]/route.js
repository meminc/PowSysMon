// src/app/api/topology/connections/[id]/route.js
import { query } from '@/lib/db/postgres';
import { cache } from '@/lib/db/redis';
import { operatorOnly } from '@/lib/auth/middleware';
import { successResponse } from '@/lib/utils/response';
import { asyncHandler, NotFoundError } from '@/lib/utils/errors';

// DELETE /api/topology/connections/[id] - Remove connection
export const DELETE = operatorOnly(asyncHandler(async (request, { params }) => {
  const { id } = params;

  const result = await query(`
    UPDATE network_connections
    SET is_connected = false, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id, from_element_id, to_element_id
  `, [id]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Connection');
  }

  // Invalidate topology cache
  await cache.invalidatePattern('topology:*');

  // Log audit
  await query(`
    INSERT INTO audit_log (user_id, action, table_name, record_id)
    VALUES ($1, $2, $3, $4)
  `, [
    request.auth.userId,
    'disconnect',
    'network_connections',
    id
  ]);

  return successResponse({
    id,
    message: 'Connection removed successfully'
  });
}));
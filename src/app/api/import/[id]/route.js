// src/app/api/import/[id]/route.js
import { query } from '@/lib/db/postgres';
import { operatorOnly } from '@/lib/auth/middleware';
import { successResponse } from '@/lib/utils/response';
import { asyncHandler, NotFoundError } from '@/lib/utils/errors';

// GET /api/import/[id] - Get import details
export const GET = operatorOnly(asyncHandler(async (request, { params }) => {
  const { id } = params;

  const result = await query(`
    SELECT 
      di.*,
      u.name as imported_by_name,
      u.email as imported_by_email
    FROM data_imports di
    LEFT JOIN users u ON di.imported_by = u.id
    WHERE di.id = $1
  `, [id]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Import');
  }

  return successResponse(result.rows[0]);
}));
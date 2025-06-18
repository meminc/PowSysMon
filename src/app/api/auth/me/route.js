// src/app/api/auth/me/route.js
import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';
import { authMiddleware } from '@/lib/auth/middleware';
import { successResponse } from '@/lib/utils/response';
import { asyncHandler } from '@/lib/utils/errors';

export const GET = authMiddleware(asyncHandler(async (request) => {
  // Get user details from the token
  const userId = request.auth.userId;

  const result = await query(
    `SELECT id, email, name, role, created_at, last_login 
     FROM users 
     WHERE id = $1 AND is_active = true`,
    [userId]
  );

  if (result.rows.length === 0) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  return successResponse(result.rows[0]);
}));
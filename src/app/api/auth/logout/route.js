// src/app/api/auth/logout/route.js
import { NextResponse } from 'next/server';
import { cache } from '@/lib/db/redis';
import { query } from '@/lib/db/postgres';
import { authMiddleware } from '@/lib/auth/middleware';
import { extractBearerToken } from '@/lib/auth/jwt';
import { successResponse, noContentResponse } from '@/lib/utils/response';
import { asyncHandler } from '@/lib/utils/errors';

export const POST = authMiddleware(asyncHandler(async (request) => {
    const token = extractBearerToken(request.headers.get('authorization'));
    const sessionId = request.headers.get('x-session-id');
    
    // Blacklist the current token
    if (token) {
        // Add token to blacklist with expiry matching token expiry (24h)
        await cache.set(`blacklist:${token}`, true, 24 * 60 * 60);
    }

    // Remove session
    if (sessionId) {
        await cache.delete(`session:${sessionId}`);
    }

    // Log audit
    if (request.auth?.userId) {
        await query(
        `INSERT INTO audit_log (user_id, action, table_name, record_id)
        VALUES ($1, $2, $3, $4)`,
        [
            request.auth.userId,
            'logout',
            'users',
            request.auth.userId
        ]
        );
    }

    return successResponse(null, 'Logout successful');
}), { requireAuth: true });
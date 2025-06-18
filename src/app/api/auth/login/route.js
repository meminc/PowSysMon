// src/app/api/auth/login/route.js
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db/postgres';
import { cache } from '@/lib/db/redis';
import { generateToken, generateRefreshToken, generateSessionId } from '@/lib/auth/jwt';
import { validate, loginSchema } from '@/lib/validation/schemas';
import { publicEndpoint } from '@/lib/auth/middleware';
import { successResponse } from '@/lib/utils/response';
import { AuthenticationError, ValidationError } from '@/lib/utils/errors';
import { asyncHandler } from '@/lib/utils/errors';

export const POST = publicEndpoint(asyncHandler(async (request) => {
    // Parse and validate request body
    const body = await request.json();
    const validated = await validate(loginSchema)(body);
    
    // Find user by email
    const userResult = await query(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        [validated.email]
    );

    if (userResult.rows.length === 0) {
        throw new AuthenticationError('Invalid credentials');
    }

    const user = userResult.rows[0];

    // Verify password
    const passwordValid = await bcrypt.compare(validated.password, user.password_hash);
    if (!passwordValid) {
        throw new AuthenticationError('Invalid credentials');
    }

    // Generate tokens
    const tokenPayload = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
    };

    const accessToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    const sessionId = generateSessionId();

    // Store session in cache
    await cache.set(`session:${sessionId}`, {
        userId: user.id,
        refreshToken,
        createdAt: new Date().toISOString()
    }, 7 * 24 * 60 * 60); // 7 days

    // Update last login
    await query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
    );

    // Log audit
    await query(
        `INSERT INTO audit_log (user_id, action, table_name, record_id, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [
        user.id,
        'login',
        'users',
        user.id,
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        request.headers.get('user-agent')
        ]
    );

    return successResponse({
        user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
        },
        tokens: {
        access: accessToken,
        refresh: refreshToken
        },
        sessionId
    }, 'Login successful');
}));
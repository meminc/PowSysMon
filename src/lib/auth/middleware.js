// src/lib/auth/middleware.js
import { verifyToken, extractBearerToken, hashApiKey } from './jwt.js';
import { query } from '../db/postgres.js';
import { cache } from '../db/redis.js';
import { NextResponse } from 'next/server';

// Rate limiting check
const checkRateLimit = async (key, limit = 100, window = 60) => {
    const count = await cache.incr(`rate_limit:${key}`, window);
    return count <= limit;
};

// Main authentication middleware
export const authMiddleware = (handler, options = {}) => {
    return async (request, context) => {
        const { 
        requireAuth = true, 
        roles = [], 
        rateLimit = true,
        rateLimitMax = 100 
        } = options;

        // Skip auth for public endpoints
        if (!requireAuth) {
        return handler(request, context);
        }

        try {
        // Check for API key in header
        const apiKey = request.headers.get('x-api-key');
        if (apiKey) {
            return handleApiKeyAuth(request, context, handler, { roles, rateLimit, rateLimitMax, apiKey });
        }

        // Check for JWT token
        const authHeader = request.headers.get('authorization');
        const token = extractBearerToken(authHeader);
        
        if (!token) {
            return NextResponse.json(
            { error: 'No authentication token provided' },
            { status: 401 }
            );
        }
        return handleJWTAuth(request, context, handler, { roles, rateLimit, rateLimitMax, token });
        } catch (error) {
        console.error('Auth middleware error:', error);
        return NextResponse.json(
            { error: 'Authentication error' },
            { status: 500 }
        );
        }
    };
};

// Handle API Key authentication
async function handleApiKeyAuth(request, context, handler, options) {
    const { apiKey, roles, rateLimit, rateLimitMax } = options;
    
    try {
        // Check cache first
        const cacheKey = `api_key:${hashApiKey(apiKey)}`;
        let apiKeyData = await cache.get(cacheKey);

        if (!apiKeyData) {
        // Query database
        const result = await query(
            `SELECT ak.*, u.email, u.role 
            FROM api_keys ak 
            JOIN users u ON ak.user_id = u.id 
            WHERE ak.key_hash = $1 AND ak.is_active = true 
            AND (ak.expires_at IS NULL OR ak.expires_at > NOW())`,
            [hashApiKey(apiKey)]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
            { error: 'Invalid API key' },
            { status: 401 }
            );
        }

        apiKeyData = result.rows[0];
        // Cache for 5 minutes
        await cache.set(cacheKey, apiKeyData, 300);
        }

        // Check rate limit
        if (rateLimit) {
        const rateLimitKey = `${apiKeyData.id}:${Math.floor(Date.now() / 60000)}`;
        const allowed = await checkRateLimit(rateLimitKey, apiKeyData.rate_limit || rateLimitMax);
        
        if (!allowed) {
            return NextResponse.json(
            { error: 'Rate limit exceeded' },
            { status: 429 }
            );
        }
        }

        // Check roles
        if (roles.length > 0 && !roles.includes(apiKeyData.role)) {
        return NextResponse.json(
            { error: 'Insufficient permissions' },
            { status: 403 }
        );
        }

        // Update last used (fire and forget)
        query(
        'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1',
        [apiKeyData.id]
        ).catch(console.error);

        // Attach auth data to request
        request.auth = {
        type: 'api_key',
        apiKey: apiKeyData,
        userId: apiKeyData.user_id,
        role: apiKeyData.role
        };

        return handler(request, context);
    } catch (error) {
        console.error('API key auth error:', error);
        return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
        );
    }
}

// Handle JWT authentication
async function handleJWTAuth(request, context, handler, options) {
    const { token, roles, rateLimit, rateLimitMax } = options;

    const decoded = verifyToken(token);
    if (!decoded) {
        return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
        );
    }

    // Check if token is blacklisted (for logout)
    const blacklisted = await cache.get(`blacklist:${token}`);
    if (blacklisted) {
        return NextResponse.json(
        { error: 'Token has been revoked' },
        { status: 401 }
        );
    }

    // Check rate limit
    if (rateLimit) {
        const rateLimitKey = `${decoded.id}:${Math.floor(Date.now() / 60000)}`;
        const allowed = await checkRateLimit(rateLimitKey, rateLimitMax);
        
        if (!allowed) {
        return NextResponse.json(
            { error: 'Rate limit exceeded' },
            { status: 429 }
        );
        }
    }

    // Check roles
    if (roles.length > 0 && !roles.includes(decoded.role)) {
        return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
        );
    }

    // Attach auth data to request
    request.auth = {
        type: 'jwt',
        user: decoded,
        userId: decoded.id,
        role: decoded.role
    };

    return handler(request, context);
}

// Public endpoint wrapper (no auth required)
export const publicEndpoint = (handler) => {
    return authMiddleware(handler, { requireAuth: false });
};

// Admin only endpoint wrapper
export const adminOnly = (handler) => {
    return authMiddleware(handler, { roles: ['admin'] });
};

// Operator and admin endpoint wrapper
export const operatorOnly = (handler) => {
    return authMiddleware(handler, { roles: ['admin', 'operator'] });
};
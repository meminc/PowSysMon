// src/app/api/users/[id]/api-keys/route.js
import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db/postgres';
import { cache } from '@/lib/db/redis';
import { authMiddleware } from '@/lib/auth/middleware';
import { generateApiKey, hashApiKey } from '@/lib/auth/jwt';
import { successResponse, createdResponse } from '@/lib/utils/response';
import { asyncHandler, NotFoundError, AuthorizationError } from '@/lib/utils/errors';

// GET /api/users/[id]/api-keys - List user's API keys
export const GET = authMiddleware(asyncHandler(async (request, { params }) => {
  const { id: userId } = await params;

  // Users can view their own API keys, admins can view any
  if (request.auth.userId !== userId && request.auth.role !== 'admin') {
    throw new AuthorizationError();
  }

  const result = await query(`
    SELECT 
      id,
      name,
      permissions,
      rate_limit,
      is_active,
      created_at,
      last_used_at,
      expires_at,
      CASE 
        WHEN last_used_at IS NULL THEN 'never'
        WHEN last_used_at > NOW() - INTERVAL '1 hour' THEN 'last_hour'
        WHEN last_used_at > NOW() - INTERVAL '1 day' THEN 'last_day'
        WHEN last_used_at > NOW() - INTERVAL '7 days' THEN 'last_week'
        ELSE 'older'
      END as usage_recency
    FROM api_keys
    WHERE user_id = $1
    ORDER BY created_at DESC
  `, [userId]);

  return successResponse(result.rows);
}));

// POST /api/users/[id]/api-keys - Create new API key
export const POST = authMiddleware(asyncHandler(async (request, { params }) => {
  const { id: userId } = await params;
  const body = await request.json();

  // Users can create their own API keys, admins can create for any user
  if (request.auth.userId !== userId && request.auth.role !== 'admin') {
    throw new AuthorizationError();
  }

  // Validate user exists and is active
  const userResult = await query(
    'SELECT id, role FROM users WHERE id = $1 AND is_active = true',
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new NotFoundError('User');
  }

  const userRole = userResult.rows[0].role;

  // Generate API key
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);

  // Set default permissions based on user role
  const defaultPermissions = {
    viewer: ['read:elements', 'read:measurements', 'read:analytics'],
    operator: ['read:elements', 'write:elements', 'read:measurements', 'write:measurements', 'read:analytics'],
    admin: ['*']
  };

  const permissions = body.permissions || defaultPermissions[userRole] || defaultPermissions.viewer;

  // Set expiration (default: 1 year)
  const expiresAt = body.expires_in 
    ? new Date(Date.now() + body.expires_in * 1000)
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const result = await withTransaction(async (client) => {
    // Check API key limit (max 10 active keys per user)
    const keyCount = await client.query(
      'SELECT COUNT(*) FROM api_keys WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    if (parseInt(keyCount.rows[0].count) >= 10) {
      throw new ValidationError([{
        path: 'api_keys',
        message: 'Maximum number of API keys (10) reached'
      }]);
    }

    // Insert API key
    const keyResult = await client.query(`
      INSERT INTO api_keys (
        key_hash, name, user_id, permissions, 
        rate_limit, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, permissions, rate_limit, created_at, expires_at
    `, [
      keyHash,
      body.name || `API Key ${new Date().toISOString().split('T')[0]}`,
      userId,
      JSON.stringify(permissions),
      body.rate_limit || 1000,
      expiresAt
    ]);

    return keyResult.rows[0];
  });

  // Log audit
  await query(`
    INSERT INTO audit_log (user_id, action, table_name, record_id, new_values)
    VALUES ($1, $2, $3, $4, $5)
  `, [
    request.auth.userId,
    'create_api_key',
    'api_keys',
    result.id,
    JSON.stringify({ name: result.name, user_id: userId })
  ]);

  return createdResponse({
    ...result,
    key: apiKey, // Only returned once at creation
    message: 'Save this API key securely. It will not be shown again.'
  }, 'API key created successfully');
}));

// DELETE /api/users/[id]/api-keys/[keyId] - Revoke API key
export const DELETE = authMiddleware(asyncHandler(async (request, { params }) => {
  const { id: userId, keyId } = await params;

  // Users can revoke their own API keys, admins can revoke any
  if (request.auth.userId !== userId && request.auth.role !== 'admin') {
    throw new AuthorizationError();
  }

  const result = await query(`
    UPDATE api_keys
    SET is_active = false
    WHERE id = $1 AND user_id = $2 AND is_active = true
    RETURNING id, name, key_hash
  `, [keyId, userId]);

  if (result.rows.length === 0) {
    throw new NotFoundError('API key');
  }

  // Remove from cache
  await cache.delete(`api_key:${result.rows[0].key_hash}`);

  // Log audit
  await query(`
    INSERT INTO audit_log (user_id, action, table_name, record_id)
    VALUES ($1, $2, $3, $4)
  `, [
    request.auth.userId,
    'revoke_api_key',
    'api_keys',
    keyId
  ]);

  return successResponse({
    id: keyId,
    message: 'API key revoked successfully'
  });
}));
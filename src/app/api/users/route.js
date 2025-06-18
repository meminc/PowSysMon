// src/app/api/users/route.js
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '@/lib/db/postgres';
import { cache } from '@/lib/db/redis';
import { adminOnly } from '@/lib/auth/middleware';
import { validate, createUserSchema, paginationSchema } from '@/lib/validation/schemas';
import { successResponse, createdResponse, paginatedResponse } from '@/lib/utils/response';
import { asyncHandler, ConflictError, ValidationError } from '@/lib/utils/errors';

// GET /api/users - List all users
export const GET = adminOnly(asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams);
  
  const validated = await validate(paginationSchema)(params);
  const { page, limit } = validated;
  const role = searchParams.get('role');
  const search = searchParams.get('search');
  const isActive = searchParams.get('is_active');
  const offset = (page - 1) * limit;

  // Build query
  let whereConditions = [];
  const queryParams = [];
  let paramCount = 0;

  if (role) {
    queryParams.push(role);
    whereConditions.push(`role = $${++paramCount}`);
  }

  if (search) {
    queryParams.push(`%${search}%`);
    whereConditions.push(`(name ILIKE $${++paramCount} OR email ILIKE $${paramCount})`);
  }

  if (isActive !== null) {
    queryParams.push(isActive === 'true');
    whereConditions.push(`is_active = $${++paramCount}`);
  }

  const whereClause = whereConditions.length > 0 
    ? 'WHERE ' + whereConditions.join(' AND ')
    : '';

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) FROM users ${whereClause}`,
    queryParams
  );
  const total = parseInt(countResult.rows[0].count);

  // Get users
  queryParams.push(limit);
  queryParams.push(offset);
  
  const result = await query(`
    SELECT 
      id,
      email,
      name,
      role,
      is_active,
      created_at,
      last_login,
      (SELECT COUNT(*) FROM api_keys WHERE user_id = users.id AND is_active = true) as active_api_keys
    FROM users
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${++paramCount} OFFSET $${++paramCount}
  `, queryParams);

  return paginatedResponse(result.rows, { page, limit, total });
}));

// POST /api/users - Create new user
export const POST = adminOnly(asyncHandler(async (request) => {
  const body = await request.json();
  const validated = await validate(createUserSchema)(body);

  // Check if user already exists
  const existing = await query(
    'SELECT id FROM users WHERE email = $1',
    [validated.email]
  );

  if (existing.rows.length > 0) {
    throw new ConflictError('User with this email already exists');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(validated.password, 10);

  const result = await withTransaction(async (client) => {
    // Create user
    const userResult = await client.query(`
      INSERT INTO users (email, password_hash, name, role, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, name, role, is_active, created_at
    `, [
      validated.email,
      passwordHash,
      validated.name,
      validated.role || 'viewer',
      true
    ]);

    const user = userResult.rows[0];

    // Create default preferences
    await client.query(`
      INSERT INTO user_preferences (user_id, dashboard_config, map_preferences)
      VALUES ($1, $2, $3)
    `, [
      user.id,
      JSON.stringify({
        widgets: [
          { type: 'system_summary', position: { x: 0, y: 0, w: 12, h: 4 } },
          { type: 'generation_mix', position: { x: 0, y: 4, w: 6, h: 4 } },
          { type: 'load_profile', position: { x: 6, y: 4, w: 6, h: 4 } }
        ]
      }),
      JSON.stringify({
        default_zoom: 10,
        layer_visibility: {
          loads: true,
          generators: true,
          lines: true,
          transformers: true,
          buses: true
        }
      })
    ]);

    return user;
  });

  // Log audit
  await query(`
    INSERT INTO audit_log (user_id, action, table_name, record_id, new_values)
    VALUES ($1, $2, $3, $4, $5)
  `, [
    request.auth.userId,
    'create_user',
    'users',
    result.id,
    JSON.stringify({ email: result.email, name: result.name, role: result.role })
  ]);

  // Remove password from response
  delete result.password_hash;

  return createdResponse(result, 'User created successfully');
}));
// src/app/api/users/[id]/route.js
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '@/lib/db/postgres';
import { cache } from '@/lib/db/redis';
import { authMiddleware, adminOnly } from '@/lib/auth/middleware';
import { validate, updateUserSchema } from '@/lib/validation/schemas';
import { successResponse } from '@/lib/utils/response';
import { asyncHandler, NotFoundError, AuthorizationError } from '@/lib/utils/errors';

// GET /api/users/[id] - Get user details
export const GET = authMiddleware(asyncHandler(async (request, { params }) => {
  const { id } = await params;

  // Users can view their own profile, admins can view any
  if (request.auth.userId !== id && request.auth.role !== 'admin') {
    throw new AuthorizationError();
  }

  const result = await query(`
    SELECT 
      u.id,
      u.email,
      u.name,
      u.role,
      u.is_active,
      u.created_at,
      u.last_login,
      up.dashboard_config,
      up.map_preferences,
      up.notification_settings,
      (SELECT COUNT(*) FROM api_keys WHERE user_id = u.id AND is_active = true) as active_api_keys,
      (SELECT COUNT(*) FROM audit_log WHERE user_id = u.id) as audit_entries
    FROM users u
    LEFT JOIN user_preferences up ON u.id = up.user_id
    WHERE u.id = $1
  `, [id]);

  if (result.rows.length === 0) {
    throw new NotFoundError('User');
  }

  return successResponse(result.rows[0]);
}));

// PUT /api/users/[id] - Update user
export const PUT = authMiddleware(asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json();

  // Users can update their own profile (limited fields), admins can update any
  const isOwnProfile = request.auth.userId === id;
  const isAdmin = request.auth.role === 'admin';

  if (!isOwnProfile && !isAdmin) {
    throw new AuthorizationError();
  }

  // Validate update data
  const validated = await validate(updateUserSchema)(body);

  // Non-admins can only update their own name and preferences
  if (!isAdmin) {
    delete validated.role;
    delete validated.is_active;
    delete validated.email;
  }

  const result = await withTransaction(async (client) => {
    // Get current user data
    const current = await client.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    if (current.rows.length === 0) {
      throw new NotFoundError('User');
    }

    // Update user fields
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (validated.email !== undefined) {
      // Check if email is already taken
      const emailCheck = await client.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [validated.email, id]
      );
      if (emailCheck.rows.length > 0) {
        throw new ConflictError('Email already in use');
      }
      updateFields.push(`email = $${++paramCount}`);
      updateValues.push(validated.email);
    }

    if (validated.name !== undefined) {
      updateFields.push(`name = $${++paramCount}`);
      updateValues.push(validated.name);
    }

    if (validated.role !== undefined && isAdmin) {
      updateFields.push(`role = $${++paramCount}`);
      updateValues.push(validated.role);
    }

    if (validated.is_active !== undefined && isAdmin) {
      updateFields.push(`is_active = $${++paramCount}`);
      updateValues.push(validated.is_active);
    }

    let updatedUser = current.rows[0];
    
    if (updateFields.length > 0) {
      const userResult = await client.query(`
        UPDATE users
        SET ${updateFields.join(', ')}
        WHERE id = $1
        RETURNING id, email, name, role, is_active, created_at, last_login
      `, [id, ...updateValues]);
      updatedUser = userResult.rows[0];
    }

    // Update password if provided
    if (body.password) {
      const passwordHash = await bcrypt.hash(body.password, 10);
      await client.query(
        'UPDATE users SET password_hash = $2 WHERE id = $1',
        [id, passwordHash]
      );
    }

    // Update preferences if provided
    if (body.preferences) {
      const prefFields = [];
      const prefValues = [];
      let prefParamCount = 1;

      if (body.preferences.dashboard_config !== undefined) {
        prefFields.push(`dashboard_config = $${++prefParamCount}`);
        prefValues.push(JSON.stringify(body.preferences.dashboard_config));
      }

      if (body.preferences.map_preferences !== undefined) {
        prefFields.push(`map_preferences = $${++prefParamCount}`);
        prefValues.push(JSON.stringify(body.preferences.map_preferences));
      }

      if (body.preferences.notification_settings !== undefined) {
        prefFields.push(`notification_settings = $${++prefParamCount}`);
        prefValues.push(JSON.stringify(body.preferences.notification_settings));
      }

      if (prefFields.length > 0) {
        await client.query(`
          UPDATE user_preferences
          SET ${prefFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $1
        `, [id, ...prefValues]);
      }
    }

    return {
      old: current.rows[0],
      new: updatedUser
    };
  });

  // Clear user cache
  await cache.delete(`user:${id}`);

  // Log audit
  await query(`
    INSERT INTO audit_log (
      user_id, action, table_name, record_id,
      old_values, new_values
    ) VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    request.auth.userId,
    'update_user',
    'users',
    id,
    JSON.stringify({ 
      email: result.old.email, 
      name: result.old.name, 
      role: result.old.role 
    }),
    JSON.stringify({ 
      email: result.new.email, 
      name: result.new.name, 
      role: result.new.role 
    })
  ]);

  return successResponse(result.new, 'User updated successfully');
}));

// DELETE /api/users/[id] - Deactivate user
export const DELETE = adminOnly(asyncHandler(async (request, { params }) => {
  const { id } = await params;

  // Prevent self-deactivation
  if (request.auth.userId === id) {
    throw new ValidationError([{
      path: 'id',
      message: 'Cannot deactivate your own account'
    }]);
  }

  const result = await query(`
    UPDATE users
    SET is_active = false
    WHERE id = $1 AND is_active = true
    RETURNING id, email, name
  `, [id]);

  if (result.rows.length === 0) {
    throw new NotFoundError('User');
  }

  // Deactivate all API keys
  await query(
    'UPDATE api_keys SET is_active = false WHERE user_id = $1',
    [id]
  );

  // Clear user sessions from cache
  await cache.invalidatePattern(`session:*:${id}`);
  await cache.delete(`user:${id}`);

  // Log audit
  await query(`
    INSERT INTO audit_log (user_id, action, table_name, record_id)
    VALUES ($1, $2, $3, $4)
  `, [
    request.auth.userId,
    'deactivate_user',
    'users',
    id
  ]);

  return successResponse(
    { 
      id, 
      email: result.rows[0].email,
      message: 'User deactivated successfully' 
    }
  );
}));
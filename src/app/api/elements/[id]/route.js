// src/app/api/elements/[id]/route.js
import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db/postgres';
import { cache } from '@/lib/db/redis';
import { authMiddleware, operatorOnly, adminOnly } from '@/lib/auth/middleware';
import { successResponse } from '@/lib/utils/response';
import { asyncHandler, NotFoundError } from '@/lib/utils/errors';

// GET /api/elements/[id] - Get element by ID
export const GET = authMiddleware(asyncHandler(async (request, { params }) => {
  const { id } = await params;

  // Check cache
  const cacheKey = `element:${id}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return successResponse(cached);
  }

  const result = await query(`
    SELECT 
      e.*,
      CASE 
        WHEN e.element_type = 'load' THEN jsonb_build_object(
          'load_type', l.load_type,
          'connection_type', l.connection_type,
          'rated_power', l.rated_power,
          'power_factor', l.power_factor,
          'voltage_level', l.voltage_level,
          'priority', l.priority,
          'bus_id', l.bus_id
        )
        WHEN e.element_type = 'generator' THEN jsonb_build_object(
          'generation_type', g.generation_type,
          'rated_capacity', g.rated_capacity,
          'min_capacity', g.min_capacity,
          'max_capacity', g.max_capacity,
          'ramp_rate', g.ramp_rate,
          'efficiency', g.efficiency,
          'fuel_type', g.fuel_type,
          'voltage_level', g.voltage_level,
          'bus_id', g.bus_id
        )
        WHEN e.element_type = 'transformer' THEN jsonb_build_object(
          'primary_voltage', t.primary_voltage,
          'secondary_voltage', t.secondary_voltage,
          'rated_power', t.rated_power,
          'current_tap', t.current_tap,
          'min_tap', t.min_tap,
          'max_tap', t.max_tap,
          'tap_step_size', t.tap_step_size,
          'winding_configuration', t.winding_configuration,
          'cooling_type', t.cooling_type,
          'primary_bus_id', t.primary_bus_id,
          'secondary_bus_id', t.secondary_bus_id
        )
        WHEN e.element_type = 'line' THEN jsonb_build_object(
          'from_bus_id', tl.from_bus_id,
          'to_bus_id', tl.to_bus_id,
          'length', tl.length,
          'voltage_level', tl.voltage_level,
          'conductor_type', tl.conductor_type,
          'configuration', tl.configuration,
          'rated_current', tl.rated_current,
          'resistance', tl.resistance,
          'reactance', tl.reactance,
          'capacitance', tl.capacitance
        )
        WHEN e.element_type = 'bus' THEN jsonb_build_object(
          'voltage_level', b.voltage_level,
          'bus_type', b.bus_type,
          'substation_id', b.substation_id,
          'nominal_voltage', b.nominal_voltage,
          'voltage_tolerance_min', b.voltage_tolerance_min,
          'voltage_tolerance_max', b.voltage_tolerance_max
        )
      END as properties,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id', nc.id,
            'from_element_id', nc.from_element_id,
            'to_element_id', nc.to_element_id,
            'connection_type', nc.connection_type,
            'is_connected', nc.is_connected,
            'connected_element_id', 
              CASE 
                WHEN nc.from_element_id = e.id THEN nc.to_element_id 
                ELSE nc.from_element_id 
              END,
            'connected_element_name',
              CASE 
                WHEN nc.from_element_id = e.id THEN e2.name 
                ELSE e1.name 
              END
          )
        ) FILTER (WHERE nc.id IS NOT NULL), 
        '[]'
      ) as connections
    FROM grid_elements e
    LEFT JOIN loads l ON e.id = l.id
    LEFT JOIN generators g ON e.id = g.id
    LEFT JOIN transformers t ON e.id = t.id
    LEFT JOIN transmission_lines tl ON e.id = tl.id
    LEFT JOIN buses b ON e.id = b.id
    LEFT JOIN network_connections nc ON 
      (nc.from_element_id = e.id OR nc.to_element_id = e.id)
      AND nc.is_connected = true
    LEFT JOIN grid_elements e1 ON nc.from_element_id = e1.id
    LEFT JOIN grid_elements e2 ON nc.to_element_id = e2.id
    WHERE e.id = $1 AND e.deleted_at IS NULL
    GROUP BY e.id, 
    l.load_type, l.connection_type, l.rated_power, l.power_factor, l.voltage_level, l.priority, l.bus_id, 
    g.generation_type, g.rated_capacity, g.min_capacity, g.max_capacity, g.ramp_rate, g.efficiency, g.fuel_type, g.voltage_level, g.bus_id, 
    t.primary_voltage, t.secondary_voltage, t.rated_power, t.current_tap, t.min_tap, t.max_tap, t.tap_step_size, t.winding_configuration, t.cooling_type,t.primary_bus_id, t.secondary_bus_id, 
    tl.from_bus_id, tl.to_bus_id, tl.length, tl.voltage_level, tl.conductor_type, tl.configuration, tl.rated_current, tl.resistance, tl.reactance, tl.capacitance, 
    b.voltage_level, b.bus_type, b.substation_id, b.nominal_voltage, b.voltage_tolerance_min, b.voltage_tolerance_max
  `, [id]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Element');
  }

  const element = result.rows[0];
  
  // Cache for 5 minutes
  await cache.set(cacheKey, element, 300);

  return successResponse(element);
}));

// PUT /api/elements/[id] - Update element
export const PUT = operatorOnly(asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json();

  const result = await withTransaction(async (client) => {
    // Get current values for audit
    const current = await client.query(
      'SELECT * FROM grid_elements WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (current.rows.length === 0) {
      throw new NotFoundError('Element');
    }

    // Update base element
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (body.name !== undefined) {
      updateFields.push(`name = $${++paramCount}`);
      updateValues.push(body.name);
    }
    if (body.description !== undefined) {
      updateFields.push(`description = $${++paramCount}`);
      updateValues.push(body.description);
    }
    if (body.status !== undefined) {
      updateFields.push(`status = $${++paramCount}`);
      updateValues.push(body.status);
    }
    if (body.location?.latitude !== undefined) {
      updateFields.push(`latitude = $${++paramCount}`);
      updateValues.push(body.location.latitude);
    }
    if (body.location?.longitude !== undefined) {
      updateFields.push(`longitude = $${++paramCount}`);
      updateValues.push(body.location.longitude);
    }
    if (body.location?.address !== undefined) {
      updateFields.push(`address = $${++paramCount}`);
      updateValues.push(body.location.address);
    }
    if (body.metadata !== undefined) {
      updateFields.push(`metadata = $${++paramCount}`);
      updateValues.push(JSON.stringify(body.metadata));
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');

    const updateResult = await client.query(`
      UPDATE grid_elements
      SET ${updateFields.join(', ')}
      WHERE id = $1
      RETURNING *
    `, [id, ...updateValues]);

    const element = updateResult.rows[0];

    // Update type-specific properties if provided
    let properties = {};
    
    // Handle type-specific updates based on element type
    const elementType = current.rows[0].element_type;
    
    switch (elementType) {
      case 'load':
        if (body.load_properties) {
          const loadFields = [];
          const loadValues = [];
          let loadParamCount = 1;

          Object.entries(body.load_properties).forEach(([key, value]) => {
            if (value !== undefined) {
              loadFields.push(`${key} = $${++loadParamCount}`);
              loadValues.push(value);
            }
          });

          if (loadFields.length > 0) {
            const loadResult = await client.query(`
              UPDATE loads
              SET ${loadFields.join(', ')}
              WHERE id = $1
              RETURNING *
            `, [id, ...loadValues]);
            properties = loadResult.rows[0];
          }
        }
        break;

      case 'generator':
        if (body.generator_properties) {
          const genFields = [];
          const genValues = [];
          let genParamCount = 1;

          Object.entries(body.generator_properties).forEach(([key, value]) => {
            if (value !== undefined) {
              genFields.push(`${key} = $${++genParamCount}`);
              genValues.push(value);
            }
          });

          if (genFields.length > 0) {
            const genResult = await client.query(`
              UPDATE generators
              SET ${genFields.join(', ')}
              WHERE id = $1
              RETURNING *
            `, [id, ...genValues]);
            properties = genResult.rows[0];
          }
        }
        break;

      // Add other element types similarly...
    }

    return {
      old: current.rows[0],
      new: { ...element, properties }
    };
  });

  // Invalidate cache
  await cache.delete(`element:${id}`);
  await cache.invalidatePattern('elements:*');

  // Log audit
  await query(`
    INSERT INTO audit_log (
      user_id, action, table_name, record_id, 
      old_values, new_values
    ) VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    request.auth.userId,
    'update',
    'grid_elements',
    id,
    JSON.stringify(result.old),
    JSON.stringify(result.new)
  ]);

  return successResponse(result.new, 'Element updated successfully');
}));

// DELETE /api/elements/[id] - Soft delete element
export const DELETE = adminOnly(asyncHandler(async (request, { params }) => {
  const { id } = await params;

  const result = await query(`
    UPDATE grid_elements
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING id, name
  `, [id]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Element');
  }

  // Invalidate cache
  await cache.delete(`element:${id}`);
  await cache.invalidatePattern('elements:*');

  // Log audit
  await query(`
    INSERT INTO audit_log (user_id, action, table_name, record_id)
    VALUES ($1, $2, $3, $4)
  `, [
    request.auth.userId,
    'delete',
    'grid_elements',
    id
  ]);

  return successResponse(
    { id, name: result.rows[0].name }, 
    'Element deleted successfully'
  );
}));
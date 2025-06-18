// src/app/api/topology/route.js
import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db/postgres';
import { cache } from '@/lib/db/redis';
import { authMiddleware, operatorOnly } from '@/lib/auth/middleware';
import { validate, connectionSchema } from '@/lib/validation/schemas';
import { successResponse, createdResponse } from '@/lib/utils/response';
import { asyncHandler, ValidationError, NotFoundError } from '@/lib/utils/errors';

// GET /api/topology - Get network topology
export const GET = authMiddleware(asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'graph';
  const voltageLevel = searchParams.get('voltage_level');
  const elementType = searchParams.get('element_type');
  const includeDisconnected = searchParams.get('include_disconnected') === 'true';

  const cacheKey = `topology:${format}:${voltageLevel || 'all'}:${elementType || 'all'}:${includeDisconnected}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return successResponse(cached);
  }

  // Build filter conditions
  let elementWhereConditions = ['e.deleted_at IS NULL'];
  const elementParams = [];
  let paramCount = 0;

  if (voltageLevel) {
    elementParams.push(parseFloat(voltageLevel));
    elementWhereConditions.push(`(
      (e.element_type = 'bus' AND b.voltage_level = $${++paramCount}) OR
      (e.element_type = 'line' AND tl.voltage_level = $${paramCount}) OR
      (e.element_type = 'transformer' AND (t.primary_voltage = $${paramCount} OR t.secondary_voltage = $${paramCount})) OR
      (e.element_type = 'generator' AND g.voltage_level = $${paramCount}) OR
      (e.element_type = 'load' AND l.voltage_level = $${paramCount})
    )`);
  }

  if (elementType) {
    elementParams.push(elementType);
    elementWhereConditions.push(`e.element_type = $${++paramCount}`);
  }

  const elementWhereClause = elementWhereConditions.join(' AND ');

  // Get all elements with their properties
  const elementsResult = await query(`
    SELECT 
      e.id,
      e.element_type,
      e.name,
      e.description,
      e.status,
      e.latitude,
      e.longitude,
      CASE 
        WHEN e.element_type = 'bus' THEN jsonb_build_object(
          'voltage_level', b.voltage_level,
          'bus_type', b.bus_type,
          'substation_id', b.substation_id
        )
        WHEN e.element_type = 'line' THEN jsonb_build_object(
          'from_bus_id', tl.from_bus_id,
          'to_bus_id', tl.to_bus_id,
          'voltage_level', tl.voltage_level,
          'length', tl.length,
          'rated_current', tl.rated_current
        )
        WHEN e.element_type = 'transformer' THEN jsonb_build_object(
          'primary_voltage', t.primary_voltage,
          'secondary_voltage', t.secondary_voltage,
          'rated_power', t.rated_power,
          'primary_bus_id', t.primary_bus_id,
          'secondary_bus_id', t.secondary_bus_id
        )
        WHEN e.element_type = 'generator' THEN jsonb_build_object(
          'generation_type', g.generation_type,
          'rated_capacity', g.rated_capacity,
          'voltage_level', g.voltage_level,
          'bus_id', g.bus_id
        )
        WHEN e.element_type = 'load' THEN jsonb_build_object(
          'load_type', l.load_type,
          'rated_power', l.rated_power,
          'voltage_level', l.voltage_level,
          'bus_id', l.bus_id
        )
      END as properties
    FROM grid_elements e
    LEFT JOIN buses b ON e.id = b.id
    LEFT JOIN transmission_lines tl ON e.id = tl.id
    LEFT JOIN transformers t ON e.id = t.id
    LEFT JOIN generators g ON e.id = g.id
    LEFT JOIN loads l ON e.id = l.id
    WHERE ${elementWhereClause}
  `, elementParams);

  // Build connection filter
  let connectionWhereConditions = [];
  if (!includeDisconnected) {
    connectionWhereConditions.push('nc.is_connected = true');
  }
  const connectionWhereClause = connectionWhereConditions.length > 0 
    ? 'WHERE ' + connectionWhereConditions.join(' AND ')
    : '';

  // Get connections
  const connectionsResult = await query(`
    SELECT 
      nc.id,
      nc.from_element_id,
      nc.to_element_id,
      nc.connection_type,
      nc.is_connected,
      e1.name as from_name,
      e1.element_type as from_type,
      e2.name as to_name,
      e2.element_type as to_type
    FROM network_connections nc
    JOIN grid_elements e1 ON nc.from_element_id = e1.id
    JOIN grid_elements e2 ON nc.to_element_id = e2.id
    ${connectionWhereClause}
      AND e1.deleted_at IS NULL 
      AND e2.deleted_at IS NULL
  `);

  let response;

  switch (format) {
    case 'graph':
      response = formatAsGraph(elementsResult.rows, connectionsResult.rows);
      break;
    case 'adjacency':
      response = formatAsAdjacency(elementsResult.rows, connectionsResult.rows);
      break;
    case 'matrix':
      response = formatAsMatrix(elementsResult.rows, connectionsResult.rows);
      break;
    case 'hierarchical':
      response = formatAsHierarchical(elementsResult.rows, connectionsResult.rows);
      break;
    default:
      throw new ValidationError([{ 
        path: 'format', 
        message: 'Invalid format. Valid formats: graph, adjacency, matrix, hierarchical' 
      }]);
  }

  // Add metadata
  response.metadata = {
    element_count: elementsResult.rows.length,
    connection_count: connectionsResult.rows.length,
    voltage_levels: [...new Set(elementsResult.rows
      .map(e => e.properties?.voltage_level)
      .filter(v => v !== undefined))],
    element_types: [...new Set(elementsResult.rows.map(e => e.element_type))],
    timestamp: new Date().toISOString()
  };

  // Cache for 10 minutes
  await cache.set(cacheKey, response, 600);

  return successResponse(response);
}));

// POST /api/topology/connections - Create/update connection
export const POST = operatorOnly(asyncHandler(async (request) => {
  const body = await request.json();
  const validated = await validate(connectionSchema)(body);

  // Validate elements exist and get their types
  const elementsResult = await query(
    `SELECT id, element_type, name 
     FROM grid_elements 
     WHERE id IN ($1, $2) AND deleted_at IS NULL`,
    [validated.from_element_id, validated.to_element_id]
  );

  if (elementsResult.rows.length !== 2) {
    throw new NotFoundError('One or both elements not found');
  }

  // Validate connection logic
  const fromElement = elementsResult.rows.find(e => e.id === validated.from_element_id);
  const toElement = elementsResult.rows.find(e => e.id === validated.to_element_id);

  validateConnection(fromElement, toElement);

  const result = await withTransaction(async (client) => {
    // Check if connection already exists
    const existing = await client.query(
      `SELECT id FROM network_connections 
       WHERE (from_element_id = $1 AND to_element_id = $2) 
          OR (from_element_id = $2 AND to_element_id = $1)`,
      [validated.from_element_id, validated.to_element_id]
    );

    let connection;
    if (existing.rows.length > 0) {
      // Update existing connection
      connection = await client.query(`
        UPDATE network_connections
        SET 
          connection_type = $3,
          is_connected = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [
        existing.rows[0].id,
        validated.connection_type,
        validated.is_connected
      ]);
    } else {
      // Create new connection
      connection = await client.query(`
        INSERT INTO network_connections (
          from_element_id, to_element_id, connection_type, is_connected
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [
        validated.from_element_id,
        validated.to_element_id,
        validated.connection_type,
        validated.is_connected
      ]);
    }

    return connection.rows[0];
  });

  // Invalidate topology cache
  await cache.invalidatePattern('topology:*');

  // Log audit
  await query(`
    INSERT INTO audit_log (user_id, action, table_name, record_id, new_values)
    VALUES ($1, $2, $3, $4, $5)
  `, [
    request.auth.userId,
    'create_connection',
    'network_connections',
    result.id,
    JSON.stringify(result)
  ]);

  return createdResponse({
    ...result,
    from_element: fromElement,
    to_element: toElement
  }, 'Connection created successfully');
}));

// DELETE /api/topology/connections/:id - Remove connection
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

  return successResponse(
    { id, message: 'Connection removed successfully' }
  );
}));

// Helper functions for formatting topology data
function formatAsGraph(elements, connections) {
  const nodes = elements.map(element => ({
    id: element.id,
    label: element.name,
    type: element.element_type,
    status: element.status,
    properties: element.properties,
    position: {
      x: element.longitude || 0,
      y: element.latitude || 0
    }
  }));

  const links = connections.map(conn => ({
    id: conn.id,
    source: conn.from_element_id,
    target: conn.to_element_id,
    type: conn.connection_type,
    connected: conn.is_connected,
    label: `${conn.from_name} → ${conn.to_name}`
  }));

  return { nodes, links };
}

function formatAsAdjacency(elements, connections) {
  const adjacency = {};
  
  // Initialize with all elements
  elements.forEach(element => {
    adjacency[element.id] = {
      element: {
        id: element.id,
        name: element.name,
        type: element.element_type,
        status: element.status,
        properties: element.properties
      },
      connections: []
    };
  });

  // Add connections
  connections.forEach(conn => {
    if (adjacency[conn.from_element_id]) {
      adjacency[conn.from_element_id].connections.push({
        to: conn.to_element_id,
        to_name: conn.to_name,
        type: conn.connection_type,
        connected: conn.is_connected,
        connection_id: conn.id
      });
    }
    if (adjacency[conn.to_element_id]) {
      adjacency[conn.to_element_id].connections.push({
        to: conn.from_element_id,
        to_name: conn.from_name,
        type: conn.connection_type,
        connected: conn.is_connected,
        connection_id: conn.id
      });
    }
  });

  return adjacency;
}

function formatAsMatrix(elements, connections) {
  const elementIds = elements.map(e => e.id);
  const elementMap = {};
  elements.forEach((e, i) => {
    elementMap[e.id] = i;
  });

  // Create adjacency matrix
  const matrix = Array(elements.length).fill(null)
    .map(() => Array(elements.length).fill(0));

  connections.forEach(conn => {
    const fromIdx = elementMap[conn.from_element_id];
    const toIdx = elementMap[conn.to_element_id];
    if (fromIdx !== undefined && toIdx !== undefined) {
      matrix[fromIdx][toIdx] = conn.is_connected ? 1 : 0;
      matrix[toIdx][fromIdx] = conn.is_connected ? 1 : 0; // Undirected
    }
  });

  return {
    elements: elements.map(e => ({
      id: e.id,
      name: e.name,
      type: e.element_type
    })),
    matrix
  };
}

function formatAsHierarchical(elements, connections) {
  // Find root nodes (substations or high voltage buses)
  const roots = elements.filter(e => 
    e.element_type === 'bus' && 
    (e.properties?.voltage_level >= 132 || e.properties?.bus_type === 'slack')
  );

  if (roots.length === 0) {
    // Fallback: use any bus as root
    const anyBus = elements.find(e => e.element_type === 'bus');
    if (anyBus) roots.push(anyBus);
  }

  // Build adjacency list
  const adjacency = {};
  elements.forEach(e => {
    adjacency[e.id] = [];
  });

  connections.forEach(conn => {
    if (conn.is_connected) {
      adjacency[conn.from_element_id]?.push(conn.to_element_id);
      adjacency[conn.to_element_id]?.push(conn.from_element_id);
    }
  });

  // Build tree structure using BFS
  const visited = new Set();
  const trees = [];

  roots.forEach(root => {
    if (visited.has(root.id)) return;

    const tree = buildTree(root, adjacency, elements, visited);
    trees.push(tree);
  });

  // Add disconnected elements
  elements.forEach(element => {
    if (!visited.has(element.id)) {
      trees.push({
        id: element.id,
        name: element.name,
        type: element.element_type,
        properties: element.properties,
        children: []
      });
    }
  });

  return { trees };
}

function buildTree(root, adjacency, elements, visited) {
  const elementMap = {};
  elements.forEach(e => {
    elementMap[e.id] = e;
  });

  const queue = [{
    id: root.id,
    name: root.name,
    type: root.element_type,
    properties: root.properties,
    children: []
  }];

  visited.add(root.id);
  const tree = queue[0];

  while (queue.length > 0) {
    const current = queue.shift();
    
    adjacency[current.id]?.forEach(neighborId => {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        const neighbor = elementMap[neighborId];
        if (neighbor) {
          const node = {
            id: neighbor.id,
            name: neighbor.name,
            type: neighbor.element_type,
            properties: neighbor.properties,
            children: []
          };
          current.children.push(node);
          queue.push(node);
        }
      }
    });
  }

  return tree;
}

function validateConnection(fromElement, toElement) {
  const validConnections = {
    'bus': ['load', 'generator', 'transformer', 'line'],
    'load': ['bus'],
    'generator': ['bus'],
    'transformer': ['bus'],
    'line': ['bus']
  };

  const fromValid = validConnections[fromElement.element_type]?.includes(toElement.element_type);
  const toValid = validConnections[toElement.element_type]?.includes(fromElement.element_type);

  if (!fromValid && !toValid) {
    throw new ValidationError([{
      path: 'connection',
      message: `Invalid connection between ${fromElement.element_type} and ${toElement.element_type}`
    }]);
  }
}
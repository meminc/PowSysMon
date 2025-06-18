// src/app/api/export/route.js
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { Parser } from 'json2csv';
import { query } from '@/lib/db/postgres';
import { queryMeasurements } from '@/lib/db/influx';
import { authMiddleware } from '@/lib/auth/middleware';
import { csvResponse, jsonFileResponse, fileResponse } from '@/lib/utils/response';
import { asyncHandler, ValidationError } from '@/lib/utils/errors';

export const GET = authMiddleware(asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const exportType = searchParams.get('type') || 'elements'; // elements, measurements, topology
  const format = searchParams.get('format') || 'csv'; // csv, json, xlsx
  const elementType = searchParams.get('element_type');
  const elementIds = searchParams.get('element_ids')?.split(',').filter(Boolean);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const includeProperties = searchParams.get('include_properties') !== 'false';

  let data;
  let filename;

  switch (exportType) {
    case 'elements':
      data = await exportElements(elementType, elementIds, includeProperties);
      filename = `grid_elements_${new Date().toISOString().split('T')[0]}`;
      break;

    case 'measurements':
      if (!elementIds || elementIds.length === 0) {
        throw new ValidationError([{
          path: 'element_ids',
          message: 'Element IDs are required for measurement export'
        }]);
      }
      data = await exportMeasurements(elementIds, startDate, endDate);
      filename = `measurements_${new Date().toISOString().split('T')[0]}`;
      break;

    case 'topology':
      data = await exportTopology();
      filename = `network_topology_${new Date().toISOString().split('T')[0]}`;
      break;

    case 'events':
      data = await exportEvents(startDate, endDate, elementIds);
      filename = `events_${new Date().toISOString().split('T')[0]}`;
      break;

    default:
      throw new ValidationError([{
        path: 'type',
        message: 'Invalid export type. Valid types: elements, measurements, topology, events'
      }]);
  }

  // Format and return data
  switch (format) {
    case 'csv':
      return exportAsCSV(data, filename);

    case 'json':
      return jsonFileResponse(data, `${filename}.json`);

    case 'xlsx':
      return exportAsExcel(data, filename);

    default:
      throw new ValidationError([{
        path: 'format',
        message: 'Invalid format. Valid formats: csv, json, xlsx'
      }]);
  }
}));

// Export elements
async function exportElements(elementType, elementIds, includeProperties) {
  let whereConditions = ['e.deleted_at IS NULL'];
  const params = [];
  let paramCount = 0;

  if (elementType) {
    params.push(elementType);
    whereConditions.push(`e.element_type = $${++paramCount}`);
  }

  if (elementIds && elementIds.length > 0) {
    params.push(elementIds);
    whereConditions.push(`e.id = ANY($${++paramCount})`);
  }

  const whereClause = whereConditions.join(' AND ');

  const result = await query(`
    SELECT 
      e.id,
      e.element_type,
      e.name,
      e.description,
      e.status,
      e.latitude,
      e.longitude,
      e.address,
      e.commissioning_date,
      e.manufacturer,
      e.model,
      e.installation_date,
      e.created_at,
      e.updated_at,
      ${includeProperties ? `
        CASE 
          WHEN e.element_type = 'load' THEN jsonb_build_object(
            'load_type', l.load_type,
            'connection_type', l.connection_type,
            'rated_power', l.rated_power,
            'power_factor', l.power_factor,
            'voltage_level', l.voltage_level,
            'priority', l.priority
          )
          WHEN e.element_type = 'generator' THEN jsonb_build_object(
            'generation_type', g.generation_type,
            'rated_capacity', g.rated_capacity,
            'min_capacity', g.min_capacity,
            'max_capacity', g.max_capacity,
            'efficiency', g.efficiency,
            'voltage_level', g.voltage_level
          )
          WHEN e.element_type = 'transformer' THEN jsonb_build_object(
            'primary_voltage', t.primary_voltage,
            'secondary_voltage', t.secondary_voltage,
            'rated_power', t.rated_power
          )
          WHEN e.element_type = 'line' THEN jsonb_build_object(
            'from_bus_id', tl.from_bus_id,
            'to_bus_id', tl.to_bus_id,
            'length', tl.length,
            'voltage_level', tl.voltage_level
          )
          WHEN e.element_type = 'bus' THEN jsonb_build_object(
            'voltage_level', b.voltage_level,
            'bus_type', b.bus_type
          )
        END as properties
      ` : 'NULL as properties'}
    FROM grid_elements e
    LEFT JOIN loads l ON e.id = l.id
    LEFT JOIN generators g ON e.id = g.id
    LEFT JOIN transformers t ON e.id = t.id
    LEFT JOIN transmission_lines tl ON e.id = tl.id
    LEFT JOIN buses b ON e.id = b.id
    WHERE ${whereClause}
    ORDER BY e.element_type, e.name
  `, params);

  // Flatten properties for CSV export
  return result.rows.map(row => {
    const flattened = { ...row };
    if (row.properties) {
      Object.entries(row.properties).forEach(([key, value]) => {
        flattened[`property_${key}`] = value;
      });
      delete flattened.properties;
    }
    return flattened;
  });
}

// Export measurements
async function exportMeasurements(elementIds, startDate, endDate) {
  const start = startDate || '-24h';
  const stop = endDate || 'now()';
  const allData = [];

  // Get element details
  const elementsResult = await query(
    `SELECT id, name, element_type 
     FROM grid_elements 
     WHERE id = ANY($1) AND deleted_at IS NULL`,
    [elementIds]
  );

  const elementMap = {};
  elementsResult.rows.forEach(e => {
    elementMap[e.id] = e;
  });

  // Query measurements for each element
  for (const elementId of elementIds) {
    const element = elementMap[elementId];
    if (!element) continue;

    const measurements = await queryMeasurements(elementId, start, stop, 'mean', '5m');
    
    measurements.forEach(m => {
      allData.push({
        element_id: elementId,
        element_name: element.name,
        element_type: element.element_type,
        timestamp: m.timestamp,
        ...m
      });
    });
  }

  return allData;
}

// Export topology
async function exportTopology() {
  const result = await query(`
    SELECT 
      nc.id as connection_id,
      nc.from_element_id,
      e1.name as from_element_name,
      e1.element_type as from_element_type,
      nc.to_element_id,
      e2.name as to_element_name,
      e2.element_type as to_element_type,
      nc.connection_type,
      nc.is_connected,
      nc.created_at,
      nc.updated_at
    FROM network_connections nc
    JOIN grid_elements e1 ON nc.from_element_id = e1.id
    JOIN grid_elements e2 ON nc.to_element_id = e2.id
    WHERE e1.deleted_at IS NULL AND e2.deleted_at IS NULL
    ORDER BY nc.created_at DESC
  `);

  return result.rows;
}

// Export events
async function exportEvents(startDate, endDate, elementIds) {
  let whereConditions = [];
  const params = [];
  let paramCount = 0;

  if (startDate) {
    params.push(startDate);
    whereConditions.push(`ev.created_at >= $${++paramCount}`);
  }

  if (endDate) {
    params.push(endDate);
    whereConditions.push(`ev.created_at <= $${++paramCount}`);
  }

  if (elementIds && elementIds.length > 0) {
    params.push(elementIds);
    whereConditions.push(`ev.element_id = ANY($${++paramCount})`);
  }

  const whereClause = whereConditions.length > 0 
    ? 'WHERE ' + whereConditions.join(' AND ')
    : '';

  const result = await query(`
    SELECT 
      ev.id,
      ev.element_id,
      e.name as element_name,
      e.element_type,
      ev.event_type,
      ev.severity,
      ev.category,
      ev.description,
      ev.status,
      ev.created_at,
      ev.acknowledged_at,
      u1.name as acknowledged_by_name,
      ev.resolved_at,
      u2.name as resolved_by_name,
      ev.parameters
    FROM events ev
    JOIN grid_elements e ON ev.element_id = e.id
    LEFT JOIN users u1 ON ev.acknowledged_by = u1.id
    LEFT JOIN users u2 ON ev.resolved_by = u2.id
    ${whereClause}
    ORDER BY ev.created_at DESC
  `, params);

  // Flatten parameters
  return result.rows.map(row => {
    const flattened = { ...row };
    if (row.parameters) {
      Object.entries(row.parameters).forEach(([key, value]) => {
        flattened[`param_${key}`] = value;
      });
      delete flattened.parameters;
    }
    return flattened;
  });
}

// Export as CSV
function exportAsCSV(data, filename) {
  if (data.length === 0) {
    return csvResponse('No data to export', `${filename}.csv`);
  }

  const fields = Object.keys(data[0]);
  const parser = new Parser({ fields });
  const csv = parser.parse(data);
  
  return csvResponse(csv, `${filename}.csv`);
}

// Export as Excel
function exportAsExcel(data, filename) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  
  // Auto-size columns
  const colWidths = {};
  data.forEach(row => {
    Object.entries(row).forEach(([key, value]) => {
      const len = value ? value.toString().length : 10;
      colWidths[key] = Math.max(colWidths[key] || 10, len);
    });
  });
  
  ws['!cols'] = Object.keys(data[0]).map(key => ({ 
    wch: Math.min(colWidths[key] || 10, 50) 
  }));
  
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  return fileResponse(
    buffer, 
    `${filename}.xlsx`, 
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}
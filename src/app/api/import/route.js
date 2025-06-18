// src/app/api/import/route.js
import { NextResponse } from 'next/server';
import { parse } from 'csv-parse';
import * as XLSX from 'xlsx';
import { query, withTransaction } from '@/lib/db/postgres';
import { writeBatchMeasurements } from '@/lib/db/influx';
import { operatorOnly } from '@/lib/auth/middleware';
import { validate, importConfigSchema } from '@/lib/validation/schemas';
import { successResponse, paginatedResponse } from '@/lib/utils/response';
import { asyncHandler, ValidationError } from '@/lib/utils/errors';

// POST /api/import - Import data from file
export const POST = operatorOnly(asyncHandler(async (request) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const importType = formData.get('type') || 'measurements'; // measurements or elements
    const mappingConfig = formData.get('mapping');

    if (!file) {
      throw new ValidationError([{ path: 'file', message: 'No file provided' }]);
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new ValidationError([{ 
        path: 'file', 
        message: `File size exceeds maximum of ${maxSize / 1024 / 1024}MB` 
      }]);
    }

    // Parse mapping configuration
    let config = {};
    if (mappingConfig) {
      try {
        config = JSON.parse(mappingConfig);
        if (importType === 'measurements') {
          config = await validate(importConfigSchema)(config);
        }
      } catch (error) {
        throw new ValidationError([{ 
          path: 'mapping', 
          message: 'Invalid mapping configuration' 
        }]);
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileType = file.name.split('.').pop().toLowerCase();

    // Create import record
    const importResult = await query(`
      INSERT INTO data_imports (
        filename, file_type, file_size_bytes, 
        imported_by, status, element_mapping
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      file.name,
      fileType,
      file.size,
      request.auth.userId,
      'processing',
      JSON.stringify(config)
    ]);

    const importId = importResult.rows[0].id;

    // Process file based on type
    let result;
    if (importType === 'measurements') {
      result = await importMeasurements(importId, buffer, fileType, config);
    } else if (importType === 'elements') {
      result = await importElements(importId, buffer, fileType, config);
    } else {
      throw new ValidationError([{ 
        path: 'type', 
        message: 'Invalid import type. Valid types: measurements, elements' 
      }]);
    }

    return successResponse({
      import_id: importId,
      ...result
    });
  } catch (error) {
    console.error('Import error:', error);
    throw error;
  }
}));

// GET /api/import - Get import history
export const GET = operatorOnly(asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const status = searchParams.get('status');
  const offset = (page - 1) * limit;

  let whereConditions = [];
  const params = [];
  let paramCount = 0;

  if (status) {
    params.push(status);
    whereConditions.push(`status = $${++paramCount}`);
  }

  const whereClause = whereConditions.length > 0 
    ? 'WHERE ' + whereConditions.join(' AND ')
    : '';

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) FROM data_imports ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  // Get imports
  params.push(limit);
  params.push(offset);
  
  const result = await query(`
    SELECT 
      di.*,
      u.name as imported_by_name,
      u.email as imported_by_email
    FROM data_imports di
    LEFT JOIN users u ON di.imported_by = u.id
    ${whereClause}
    ORDER BY di.import_started_at DESC
    LIMIT $${++paramCount} OFFSET $${++paramCount}
  `, params);

  return paginatedResponse(result.rows, { page, limit, total });
}));

// GET /api/import/:id - Get import details
export const GET_BY_ID = operatorOnly(asyncHandler(async (request, { params }) => {
  const { id } = params;

  const result = await query(`
    SELECT 
      di.*,
      u.name as imported_by_name,
      u.email as imported_by_email
    FROM data_imports di
    LEFT JOIN users u ON di.imported_by = u.id
    WHERE di.id = $1
  `, [id]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Import');
  }

  return successResponse(result.rows[0]);
}));

// Helper function to import measurements
async function importMeasurements(importId, buffer, fileType, config) {
  let data = [];
  
  // Parse file
  if (fileType === 'csv') {
    data = await parseCSV(buffer);
  } else if (['xlsx', 'xls'].includes(fileType)) {
    data = parseExcel(buffer);
  } else {
    throw new ValidationError([{ 
      path: 'file', 
      message: 'Unsupported file type. Supported types: csv, xlsx, xls' 
    }]);
  }

  // Validate required columns
  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    const required = [config.element_id_column, config.timestamp_column];
    const missing = required.filter(col => !headers.includes(col));
    
    if (missing.length > 0) {
      throw new ValidationError([{
        path: 'mapping',
        message: `Missing required columns: ${missing.join(', ')}`
      }]);
    }
  }

  // Process data in batches
  const batchSize = 1000;
  let processedCount = 0;
  let importedCount = 0;
  let errors = [];
  const measurements = [];

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    for (const row of batch) {
      try {
        // Extract element ID and timestamp
        const elementId = row[config.element_id_column];
        const timestampStr = row[config.timestamp_column];
        
        if (!elementId) {
          errors.push({
            row: processedCount + 1,
            error: 'Missing element ID'
          });
          processedCount++;
          continue;
        }

        // Parse timestamp
        let timestamp;
        try {
          timestamp = new Date(timestampStr);
          if (isNaN(timestamp.getTime())) {
            throw new Error('Invalid date');
          }
        } catch (e) {
          errors.push({
            row: processedCount + 1,
            error: `Invalid timestamp: ${timestampStr}`
          });
          processedCount++;
          continue;
        }

        // Verify element exists
        const elementResult = await query(
          'SELECT element_type FROM grid_elements WHERE id = $1 AND deleted_at IS NULL',
          [elementId]
        );

        if (elementResult.rows.length === 0) {
          errors.push({
            row: processedCount + 1,
            error: `Element not found: ${elementId}`
          });
          processedCount++;
          continue;
        }

        // Extract measurements based on mapping
        const measurementData = {};
        Object.entries(config.measurements || {}).forEach(([field, column]) => {
          if (row[column] !== undefined && row[column] !== null && row[column] !== '') {
            const value = parseFloat(row[column]);
            if (!isNaN(value)) {
              measurementData[field] = value;
            }
          }
        });

        if (Object.keys(measurementData).length === 0) {
          errors.push({
            row: processedCount + 1,
            error: 'No valid measurements found'
          });
          processedCount++;
          continue;
        }

        // Add to batch
        measurements.push({
          elementId,
          elementType: elementResult.rows[0].element_type,
          data: measurementData,
          timestamp
        });

        importedCount++;
      } catch (error) {
        errors.push({
          row: processedCount + 1,
          error: error.message
        });
      }
      processedCount++;
    }

    // Write batch to InfluxDB
    if (measurements.length > 0) {
      try {
        await writeBatchMeasurements(measurements);
        measurements.length = 0; // Clear array
      } catch (error) {
        console.error('InfluxDB write error:', error);
        errors.push({
          batch: `Rows ${i + 1}-${Math.min(i + batchSize, data.length)}`,
          error: 'Failed to write measurements to database'
        });
      }
    }

    // Update import progress
    await query(`
      UPDATE data_imports
      SET 
        records_processed = $2,
        records_imported = $3,
        records_failed = $4
      WHERE id = $1
    `, [importId, processedCount, importedCount, errors.length]);
  }

  // Finalize import
  await query(`
    UPDATE data_imports
    SET 
      status = $2,
      import_completed_at = CURRENT_TIMESTAMP,
      error_log = $3
    WHERE id = $1
  `, [
    importId,
    errors.length === 0 ? 'completed' : 'completed_with_errors',
    JSON.stringify(errors.slice(0, 100)) // Limit errors stored
  ]);

  return {
    status: 'completed',
    records_processed: processedCount,
    records_imported: importedCount,
    records_failed: errors.length,
    errors: errors.slice(0, 10) // Return first 10 errors
  };
}

// Helper function to import elements
async function importElements(importId, buffer, fileType, config) {
  let data = [];
  
  // Parse file
  if (fileType === 'csv') {
    data = await parseCSV(buffer);
  } else if (['xlsx', 'xls'].includes(fileType)) {
    data = parseExcel(buffer);
  } else if (fileType === 'json') {
    data = JSON.parse(buffer.toString());
    if (!Array.isArray(data)) {
      data = [data];
    }
  } else {
    throw new ValidationError([{ 
      path: 'file', 
      message: 'Unsupported file type. Supported types: csv, xlsx, xls, json' 
    }]);
  }

  let processedCount = 0;
  let importedCount = 0;
  let errors = [];

  await withTransaction(async (client) => {
    for (const row of data) {
      try {
        // Map fields based on configuration or use direct mapping
        const element = config.mapping ? mapFields(row, config.mapping) : row;

        // Validate element type
        if (!['load', 'generator', 'transformer', 'line', 'bus'].includes(element.type)) {
          errors.push({
            row: processedCount + 1,
            error: `Invalid element type: ${element.type}`
          });
          processedCount++;
          continue;
        }

        // Insert base element
        const elementResult = await client.query(`
          INSERT INTO grid_elements (
            element_type, name, description, 
            latitude, longitude, address,
            status, commissioning_date, manufacturer, 
            model, installation_date, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (name) WHERE deleted_at IS NULL
          DO UPDATE SET
            description = EXCLUDED.description,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id, (xmax = 0) as inserted
        `, [
          element.type,
          element.name,
          element.description,
          element.location?.latitude,
          element.location?.longitude,
          element.location?.address,
          element.status || 'active',
          element.commissioning_date,
          element.manufacturer,
          element.model,
          element.installation_date,
          JSON.stringify(element.metadata || {})
        ]);

        const { id: elementId, inserted } = elementResult.rows[0];

        // Insert type-specific properties if new element
        if (inserted) {
          await insertElementProperties(client, elementId, element);
        }

        importedCount++;
      } catch (error) {
        errors.push({
          row: processedCount + 1,
          error: error.message
        });
      }
      processedCount++;
    }
  });

  // Finalize import
  await query(`
    UPDATE data_imports
    SET 
      status = $2,
      import_completed_at = CURRENT_TIMESTAMP,
      records_processed = $3,
      records_imported = $4,
      records_failed = $5,
      error_log = $6
    WHERE id = $1
  `, [
    importId,
    errors.length === 0 ? 'completed' : 'completed_with_errors',
    processedCount,
    importedCount,
    errors.length,
    JSON.stringify(errors.slice(0, 100))
  ]);

  return {
    status: 'completed',
    records_processed: processedCount,
    records_imported: importedCount,
    records_failed: errors.length,
    errors: errors.slice(0, 10)
  };
}

// Helper function to parse CSV
async function parseCSV(buffer) {
  return new Promise((resolve, reject) => {
    parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: true,
      cast_date: true
    }, (err, records) => {
      if (err) reject(err);
      else resolve(records);
    });
  });
}

// Helper function to parse Excel
function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { 
    type: 'buffer',
    cellDates: true,
    cellNF: false,
    cellText: false
  });
  
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  return XLSX.utils.sheet_to_json(worksheet, {
    raw: false,
    dateNF: 'YYYY-MM-DD HH:mm:ss'
  });
}

// Helper function to map fields
function mapFields(row, mapping) {
  const mapped = {};
  
  Object.entries(mapping).forEach(([targetField, sourceField]) => {
    if (sourceField.includes('.')) {
      // Handle nested fields
      const parts = sourceField.split('.');
      let value = row;
      for (const part of parts) {
        value = value?.[part];
      }
      setNestedValue(mapped, targetField, value);
    } else {
      setNestedValue(mapped, targetField, row[sourceField]);
    }
  });
  
  return mapped;
}

// Helper function to set nested values
function setNestedValue(obj, path, value) {
  const parts = path.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  
  current[parts[parts.length - 1]] = value;
}

// Helper function to insert element properties
async function insertElementProperties(client, elementId, element) {
  switch (element.type) {
    case 'load':
      if (element.load_properties) {
        await client.query(`
          INSERT INTO loads (
            id, load_type, connection_type, rated_power,
            power_factor, voltage_level, priority, bus_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          elementId,
          element.load_properties.load_type,
          element.load_properties.connection_type,
          element.load_properties.rated_power,
          element.load_properties.power_factor,
          element.load_properties.voltage_level,
          element.load_properties.priority || 'medium',
          element.load_properties.bus_id
        ]);
      }
      break;

    case 'generator':
      if (element.generator_properties) {
        await client.query(`
          INSERT INTO generators (
            id, generation_type, rated_capacity, min_capacity,
            max_capacity, ramp_rate, efficiency, fuel_type,
            voltage_level, bus_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          elementId,
          element.generator_properties.generation_type,
          element.generator_properties.rated_capacity,
          element.generator_properties.min_capacity,
          element.generator_properties.max_capacity,
          element.generator_properties.ramp_rate,
          element.generator_properties.efficiency,
          element.generator_properties.fuel_type,
          element.generator_properties.voltage_level,
          element.generator_properties.bus_id
        ]);
      }
      break;

    // Add other element types...
  }
}
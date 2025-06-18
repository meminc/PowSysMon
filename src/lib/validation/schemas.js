// src/lib/validation/schemas.js
import { z } from 'zod';

// Base schemas
export const uuidSchema = z.string().uuid();

export const coordinatesSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
});

// Element schemas
export const elementSchema = z.object({
    type: z.enum(['load', 'generator', 'transformer', 'line', 'bus', 'breaker']),
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    location: z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        address: z.string().optional()
    }).optional(),
    status: z.enum(['active', 'inactive', 'maintenance', 'fault']).optional(),
    commissioning_date: z.string().datetime().optional(),
    manufacturer: z.string().max(255).optional(),
    model: z.string().max(255).optional(),
    installation_date: z.string().datetime().optional(),
    metadata: z.record(z.any()).optional()
});

// Load specific schema
export const loadSchema = elementSchema.extend({
    type: z.literal('load'),
    load_properties: z.object({
        load_type: z.enum(['residential', 'commercial', 'industrial']),
        connection_type: z.enum(['single_phase', 'three_phase']),
        rated_power: z.number().positive(),
        power_factor: z.number().min(0).max(1),
        voltage_level: z.number().positive(),
        priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
        bus_id: z.string().uuid().optional()
    })
});

// Generator specific schema
export const generatorSchema = elementSchema.extend({
    type: z.literal('generator'),
    generator_properties: z.object({
        generation_type: z.enum(['solar', 'wind', 'hydro', 'thermal', 'nuclear', 'battery']),
        rated_capacity: z.number().positive(),
        min_capacity: z.number().nonnegative(),
        max_capacity: z.number().positive(),
        ramp_rate: z.number().positive().optional(),
        efficiency: z.number().min(0).max(1).optional(),
        fuel_type: z.string().max(50).optional(),
        voltage_level: z.number().positive(),
        bus_id: z.string().uuid().optional()
    }).refine(data => data.min_capacity <= data.max_capacity, {
        message: "Min capacity must be less than or equal to max capacity"
    })
});

// Transformer specific schema
export const transformerSchema = elementSchema.extend({
    type: z.literal('transformer'),
    transformer_properties: z.object({
        primary_voltage: z.number().positive(),
        secondary_voltage: z.number().positive(),
        rated_power: z.number().positive(),
        current_tap: z.number().int().optional(),
        min_tap: z.number().int().optional(),
        max_tap: z.number().int().optional(),
        tap_step_size: z.number().positive().optional(),
        winding_configuration: z.string().max(20).optional(),
        cooling_type: z.string().max(10).optional(),
        primary_bus_id: z.string().uuid().optional(),
        secondary_bus_id: z.string().uuid().optional()
    })
});

// Transmission line specific schema
export const lineSchema = elementSchema.extend({
    type: z.literal('line'),
    line_properties: z.object({
        from_bus_id: z.string().uuid(),
        to_bus_id: z.string().uuid(),
        length: z.number().positive(),
        voltage_level: z.number().positive(),
        conductor_type: z.string().max(20).optional(),
        configuration: z.string().max(20).optional(),
        rated_current: z.number().positive().optional(),
        resistance: z.number().nonnegative().optional(),
        reactance: z.number().nonnegative().optional(),
        capacitance: z.number().nonnegative().optional()
    }).refine(data => data.from_bus_id !== data.to_bus_id, {
        message: "From and to bus IDs must be different"
    })
});

// Bus specific schema
export const busSchema = elementSchema.extend({
    type: z.literal('bus'),
    bus_properties: z.object({
        voltage_level: z.number().positive(),
        bus_type: z.enum(['slack', 'pv', 'pq']).optional(),
        substation_id: z.string().uuid().optional(),
        nominal_voltage: z.number().positive().optional(),
        voltage_tolerance_min: z.number().positive().max(1).optional(),
        voltage_tolerance_max: z.number().min(1).max(2).optional()
    })
});

// Combined element schema
export const createElementSchema = z.discriminatedUnion('type', [
    loadSchema,
    generatorSchema,
    transformerSchema,
    lineSchema,
    busSchema
]);

// Measurement schema
export const measurementSchema = z.object({
    element_id: z.string().uuid(),
    timestamp: z.string().datetime().optional(),
    measurements: z.object({
        voltage: z.number().optional(),
        voltage_a: z.number().optional(),
        voltage_b: z.number().optional(),
        voltage_c: z.number().optional(),
        current: z.number().optional(),
        current_a: z.number().optional(),
        current_b: z.number().optional(),
        current_c: z.number().optional(),
        active_power: z.number().optional(),
        reactive_power: z.number().optional(),
        apparent_power: z.number().optional(),
        power_factor: z.number().min(-1).max(1).optional(),
        frequency: z.number().optional(),
        temperature: z.number().optional(),
        humidity: z.number().min(0).max(100).optional(),
        energy_import: z.number().optional(),
        energy_export: z.number().optional()
    }).refine(data => Object.keys(data).length > 0, {
        message: "At least one measurement is required"
    })
});

// Batch measurement schema
export const batchMeasurementSchema = z.array(measurementSchema);

// Query schemas
export const paginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50)
});

export const elementQuerySchema = paginationSchema.extend({
    type: z.enum(['load', 'generator', 'transformer', 'line', 'bus', 'breaker']).optional(),
    status: z.enum(['active', 'inactive', 'maintenance', 'fault']).optional(),
    search: z.string().optional(),
    voltage_level: z.coerce.number().optional(),
    sort_by: z.enum(['created_at', 'name', 'status']).optional(),
    sort_order: z.enum(['asc', 'desc']).optional()
});

const durationRegex = /^-?\d+[smhdw]$/; // e.g., '5m', '1h', '-1d'

export const measurementQuerySchema = z.object({
    element_id: z.string().uuid(),
    start: z.string().default('-1h'),
    stop: z.string().default('now()'),
    aggregation: z.enum(['mean', 'sum', 'min', 'max', 'last']).default('mean'),
    window: z.string()
            .regex(durationRegex, { message: 'Invalid duration format' })
            .default('5m')
});

// Connection schema
export const connectionSchema = z.object({
    from_element_id: z.string().uuid(),
    to_element_id: z.string().uuid(),
    connection_type: z.string().default('electrical'),
    is_connected: z.boolean().default(true)
});

// User schemas
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6)
});

export const createUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(100),
    name: z.string().min(1).max(255),
    role: z.enum(['admin', 'operator', 'viewer']).default('viewer')
});

export const updateUserSchema = z.object({
    email: z.string().email().optional(),
    name: z.string().min(1).max(255).optional(),
    role: z.enum(['admin', 'operator', 'viewer']).optional(),
    is_active: z.boolean().optional()
});

// Import schema
export const importConfigSchema = z.object({
    element_id_column: z.string(),
    timestamp_column: z.string(),
    measurements: z.record(z.string(), z.string()),
    date_format: z.string().optional()
});

// Validation helper
export const validate = (schema) => {
    return async (data) => {
        try {
            return await schema.parseAsync(data);
        } catch (error) {
            const errors = error.errors.map(err => ({
                path: err.path.join('.'),
                message: err.message
            }));
            throw new ValidationError(errors);
        }
    };
};

// Custom validation error
export class ValidationError extends Error {
    constructor(errors) {
        super('Validation failed');
        this.name = 'ValidationError';
        this.errors = errors;
        this.statusCode = 400;
    }
}
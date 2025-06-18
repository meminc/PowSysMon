// src/lib/db/influx.js
import { InfluxDB, Point } from '@influxdata/influxdb-client';

const token = process.env.INFLUXDB_TOKEN || 'development-token';
const org = process.env.INFLUXDB_ORG || 'grid-monitoring';
const bucket = process.env.INFLUXDB_BUCKET || 'grid_measurements';
const url = process.env.INFLUXDB_URL || 'http://localhost:8086';

let influxClient = null;
let writeApi = null;
let queryApi = null;

// Initialize InfluxDB connection
const initInflux = () => {
    if (!influxClient) {
        influxClient = new InfluxDB({ url, token });
        writeApi = influxClient.getWriteApi(org, bucket, 'ns');
        queryApi = influxClient.getQueryApi(org);
        
        // Set default tags that will be added to all points
        writeApi.useDefaultTags({ source: 'grid-monitoring-api' });
    }
    return { writeApi, queryApi };
};

// Write measurement helper
export const writeMeasurement = async (elementId, elementType, measurements) => {
    try {
        const { writeApi } = initInflux();
        
        const point = new Point('grid_measurements')
            .tag('element_id', elementId)
            .tag('element_type', elementType)
            .timestamp(new Date());

        // Add measurement fields
        Object.entries(measurements).forEach(([field, value]) => {
        if (typeof value === 'number') {
            point.floatField(field, value);
        } else if (typeof value === 'boolean') {
            point.booleanField(field, value);
        } else {
            point.stringField(field, value.toString());
        }
        });

        writeApi.writePoint(point);
        await writeApi.flush();
        
        return true;
    } catch (error) {
        console.error('InfluxDB write error:', error);
        throw error;
    }
};

// Write batch measurements
export const writeBatchMeasurements = async (measurements) => {
    try {
        const { writeApi } = initInflux();
        
        measurements.forEach(({ elementId, elementType, data, timestamp }) => {
        const point = new Point('grid_measurements')
            .tag('element_id', elementId)
            .tag('element_type', elementType)
            .timestamp(timestamp || new Date());

        Object.entries(data).forEach(([field, value]) => {
            if (typeof value === 'number') {
                point.floatField(field, value);
            } else if (typeof value === 'boolean') {
                point.booleanField(field, value);
            } else {
                point.stringField(field, value.toString());
            }
        });

        writeApi.writePoint(point);
        });

        await writeApi.flush();
        return true;
    } catch (error) {
        console.error('InfluxDB batch write error:', error);
        throw error;
    }
};

// Query measurements
export const queryMeasurements = async (elementId, start = '-1h', stop = 'now()', aggregation = 'mean', window = '5m') => {
    try {
        const { queryApi } = initInflux();
        
        const query = `
        from(bucket: "${bucket}")
            |> range(start: ${start}, stop: ${stop})
            |> filter(fn: (r) => r["element_id"] == "${elementId}")
            |> aggregateWindow(every: ${window}, fn: ${aggregation}, createEmpty: false)
            |> yield(name: "result")
        `;

        const data = [];
        
        await new Promise((resolve, reject) => {
            queryApi.queryRows(query, {
                next(row, tableMeta) {
                const o = tableMeta.toObject(row);
                data.push({
                    time: o._time,
                    field: o._field,
                    value: o._value,
                    elementId: o.element_id,
                    elementType: o.element_type
                });
                },
                error(error) {
                    reject(error);
                },
                complete() {
                    resolve();
                },
            });
        });

        // Transform data for easier consumption
        const transformed = data.reduce((acc, item) => {
        const time = new Date(item.time).toISOString();
        if (!acc[time]) {
            acc[time] = { timestamp: time };
        }
        acc[time][item.field] = item.value;
        return acc;
        }, {});

        return Object.values(transformed);
    } catch (error) {
        console.error('InfluxDB query error:', error);
        throw error;
    }
};

// Write event
export const writeEvent = async (elementId, eventType, severity, description, parameters = {}) => {
    try {
        const { writeApi } = initInflux();
        
        const point = new Point('grid_events')
        .tag('element_id', elementId)
        .tag('event_type', eventType)
        .tag('severity', severity)
        .stringField('description', description)
        .stringField('parameters', JSON.stringify(parameters))
        .timestamp(new Date());

        writeApi.writePoint(point);
        await writeApi.flush();
        
        return true;
    } catch (error) {
        console.error('InfluxDB event write error:', error);
        throw error;
    }
};

// Check InfluxDB connection
export const checkConnection = async () => {
    try {
        const { queryApi } = initInflux();
        
        // Simple query to check connection
        await queryApi.collectRows('buckets()');
        
        return { connected: true };
    } catch (error) {
        return { connected: false, error: error.message };
    }
};

// Export initialized APIs for direct use if needed
export const getInfluxAPIs = () => initInflux();
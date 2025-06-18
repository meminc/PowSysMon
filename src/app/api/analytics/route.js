// src/app/api/analytics/route.js
import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';
import { queryMeasurements, getInfluxAPIs } from '@/lib/db/influx';
import { cache } from '@/lib/db/redis';
import { authMiddleware } from '@/lib/auth/middleware';
import { successResponse } from '@/lib/utils/response';
import { asyncHandler, ValidationError } from '@/lib/utils/errors';

export const GET = authMiddleware(asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const period = searchParams.get('period') || '24h';
  const groupBy = searchParams.get('groupBy');
  const elementIds = searchParams.get('elements')?.split(',').filter(Boolean);

  switch (type) {
    case 'system_summary':
      return getSystemSummary();
    case 'load_profile':
      return getLoadProfile(period, elementIds);
    case 'generation_mix':
      return getGenerationMix();
    case 'network_losses':
      return getNetworkLosses(period);
    case 'reliability_metrics':
      return getReliabilityMetrics(period);
    case 'energy_consumption':
      return getEnergyConsumption(period, groupBy);
    case 'peak_demand':
      return getPeakDemand(period);
    case 'power_quality':
      return getPowerQuality(period, elementIds);
    default:
      throw new ValidationError([{ 
        path: 'type', 
        message: 'Invalid analytics type. Valid types: system_summary, load_profile, generation_mix, network_losses, reliability_metrics, energy_consumption, peak_demand, power_quality' 
      }]);
  }
}));

async function getSystemSummary() {
  const cacheKey = 'analytics:system_summary';
  const cached = await cache.get(cacheKey);
  if (cached) {
    return successResponse(cached);
  }

  // Get element counts by type and status
  const elementCounts = await query(`
    SELECT 
      element_type,
      status,
      COUNT(*) as count
    FROM grid_elements
    WHERE deleted_at IS NULL
    GROUP BY element_type, status
    ORDER BY element_type, status
  `);

  // Get capacity summary
  const capacity = await query(`
    SELECT 
      SUM(g.rated_capacity) as total_generation_capacity,
      SUM(CASE WHEN g.generation_type = 'solar' THEN g.rated_capacity ELSE 0 END) as solar_capacity,
      SUM(CASE WHEN g.generation_type = 'wind' THEN g.rated_capacity ELSE 0 END) as wind_capacity,
      SUM(CASE WHEN g.generation_type = 'hydro' THEN g.rated_capacity ELSE 0 END) as hydro_capacity,
      SUM(CASE WHEN g.generation_type IN ('solar', 'wind', 'hydro') THEN g.rated_capacity ELSE 0 END) as renewable_capacity,
      SUM(CASE WHEN g.generation_type IN ('thermal', 'nuclear') THEN g.rated_capacity ELSE 0 END) as conventional_capacity,
      COUNT(DISTINCT g.id) as generator_count
    FROM generators g
    JOIN grid_elements e ON g.id = e.id
    WHERE e.deleted_at IS NULL AND e.status = 'active'
  `);

  // Get load summary
  const loads = await query(`
    SELECT 
      SUM(l.rated_power) as total_load_capacity,
      COUNT(DISTINCT l.id) as load_count,
      SUM(CASE WHEN l.load_type = 'residential' THEN l.rated_power ELSE 0 END) as residential_capacity,
      SUM(CASE WHEN l.load_type = 'commercial' THEN l.rated_power ELSE 0 END) as commercial_capacity,
      SUM(CASE WHEN l.load_type = 'industrial' THEN l.rated_power ELSE 0 END) as industrial_capacity
    FROM loads l
    JOIN grid_elements e ON l.id = e.id
    WHERE e.deleted_at IS NULL AND e.status = 'active'
  `);

  // Get network statistics
  const network = await query(`
    SELECT 
      COUNT(DISTINCT CASE WHEN element_type = 'line' THEN e.id END) as transmission_lines,
      COUNT(DISTINCT CASE WHEN element_type = 'transformer' THEN e.id END) as transformers,
      COUNT(DISTINCT CASE WHEN element_type = 'bus' THEN e.id END) as buses,
      COUNT(DISTINCT nc.id) as connections
    FROM grid_elements e
    LEFT JOIN network_connections nc ON (nc.from_element_id = e.id OR nc.to_element_id = e.id) AND nc.is_connected = true
    WHERE e.deleted_at IS NULL
  `);

  // Get current measurements from InfluxDB
  const { queryApi } = getInfluxAPIs();
  const currentMetrics = [];
  
  try {
    const flux = `
      from(bucket: "${process.env.INFLUXDB_BUCKET}")
        |> range(start: -5m)
        |> filter(fn: (r) => r._measurement == "grid_measurements")
        |> group(columns: ["_field"])
        |> last()
        |> group()
    `;
    
    await queryApi.collectRows(flux, (row, tableMeta) => {
      const obj = tableMeta.toObject(row);
      currentMetrics.push(obj);
    });
  } catch (error) {
    console.error('InfluxDB query error:', error);
  }

  // Calculate current totals
  const currentLoad = currentMetrics
    .filter(m => m._field === 'active_power' && m.element_type === 'load')
    .reduce((sum, m) => sum + (m._value || 0), 0);
    
  const currentGeneration = currentMetrics
    .filter(m => m._field === 'active_power' && m.element_type === 'generator')
    .reduce((sum, m) => sum + (m._value || 0), 0);

  const avgFrequency = currentMetrics
    .filter(m => m._field === 'frequency')
    .reduce((sum, m, _, arr) => sum + m._value / arr.length, 0) || 50;

  const summary = {
    timestamp: new Date().toISOString(),
    elements: {
      byType: elementCounts.rows.reduce((acc, row) => {
        if (!acc[row.element_type]) acc[row.element_type] = {};
        acc[row.element_type][row.status] = parseInt(row.count);
        return acc;
      }, {}),
      total: elementCounts.rows.reduce((sum, row) => sum + parseInt(row.count), 0)
    },
    capacity: {
      generation: {
        total: parseFloat(capacity.rows[0].total_generation_capacity || 0),
        renewable: parseFloat(capacity.rows[0].renewable_capacity || 0),
        conventional: parseFloat(capacity.rows[0].conventional_capacity || 0),
        solar: parseFloat(capacity.rows[0].solar_capacity || 0),
        wind: parseFloat(capacity.rows[0].wind_capacity || 0),
        hydro: parseFloat(capacity.rows[0].hydro_capacity || 0),
        units: parseInt(capacity.rows[0].generator_count || 0)
      },
      load: {
        total: parseFloat(loads.rows[0].total_load_capacity || 0),
        residential: parseFloat(loads.rows[0].residential_capacity || 0),
        commercial: parseFloat(loads.rows[0].commercial_capacity || 0),
        industrial: parseFloat(loads.rows[0].industrial_capacity || 0),
        units: parseInt(loads.rows[0].load_count || 0)
      }
    },
    network: {
      transmission_lines: parseInt(network.rows[0].transmission_lines || 0),
      transformers: parseInt(network.rows[0].transformers || 0),
      buses: parseInt(network.rows[0].buses || 0),
      connections: parseInt(network.rows[0].connections || 0)
    },
    current: {
      load: currentLoad,
      generation: currentGeneration,
      balance: currentGeneration - currentLoad,
      frequency: avgFrequency,
      renewable_percentage: capacity.rows[0].total_generation_capacity > 0 
        ? (capacity.rows[0].renewable_capacity / capacity.rows[0].total_generation_capacity * 100) 
        : 0
    }
  };

  // Cache for 1 minute
  await cache.set(cacheKey, summary, 60);

  return successResponse(summary);
}

async function getLoadProfile(period, elementIds) {
  const cacheKey = `analytics:load_profile:${period}:${elementIds?.join(',')}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return successResponse(cached);
  }

  const { queryApi } = getInfluxAPIs();
  const window = getAggregationWindow(period);
  
  let filter = 'r.element_type == "load"';
  if (elementIds && elementIds.length > 0) {
    const ids = elementIds.map(id => `r.element_id == "${id}"`).join(' or ');
    filter = `(${filter}) and (${ids})`;
  }

  const flux = `
    from(bucket: "${process.env.INFLUXDB_BUCKET}")
      |> range(start: -${period})
      |> filter(fn: (r) => r._measurement == "grid_measurements" and r._field == "active_power")
      |> filter(fn: (r) => ${filter})
      |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
      |> group(columns: ["_time"])
      |> sum()
      |> yield(name: "load_profile")
  `;

  const data = [];
  await queryApi.collectRows(flux, (row, tableMeta) => {
    const obj = tableMeta.toObject(row);
    data.push({
      timestamp: obj._time,
      total_load: obj._value || 0
    });
  });

  // Calculate statistics
  const values = data.map(d => d.total_load);
  const peak_load = Math.max(...values, 0);
  const min_load = Math.min(...values, 0);
  const avg_load = values.length > 0 
    ? values.reduce((a, b) => a + b, 0) / values.length 
    : 0;
  const load_factor = peak_load > 0 ? avg_load / peak_load : 0;

  // Get load breakdown by type
  const loadBreakdown = await query(`
    SELECT 
      l.load_type,
      SUM(l.rated_power) as capacity,
      COUNT(*) as count
    FROM loads l
    JOIN grid_elements e ON l.id = e.id
    WHERE e.deleted_at IS NULL AND e.status = 'active'
    GROUP BY l.load_type
  `);

  const result = {
    period,
    window,
    profile: data,
    statistics: {
      peak_load,
      min_load,
      avg_load,
      load_factor,
      variance: calculateVariance(values)
    },
    breakdown: loadBreakdown.rows
  };

  // Cache for 5 minutes
  await cache.set(cacheKey, result, 300);

  return successResponse(result);
}

async function getGenerationMix() {
  const cacheKey = 'analytics:generation_mix';
  const cached = await cache.get(cacheKey);
  if (cached) {
    return successResponse(cached);
  }

  // Get generation capacity by type
  const result = await query(`
    SELECT 
      g.generation_type,
      COUNT(*) as unit_count,
      SUM(g.rated_capacity) as total_capacity,
      SUM(CASE WHEN e.status = 'active' THEN g.rated_capacity ELSE 0 END) as available_capacity,
      AVG(g.efficiency) as avg_efficiency,
      MIN(g.min_capacity) as min_capacity,
      MAX(g.max_capacity) as max_capacity
    FROM generators g
    JOIN grid_elements e ON g.id = e.id
    WHERE e.deleted_at IS NULL
    GROUP BY g.generation_type
    ORDER BY total_capacity DESC
  `);

  // Get current generation from each type
  const { queryApi } = getInfluxAPIs();
  const currentGen = {};
  
  const flux = `
    from(bucket: "${process.env.INFLUXDB_BUCKET}")
      |> range(start: -5m)
      |> filter(fn: (r) => 
        r._measurement == "grid_measurements" and 
        r._field == "active_power" and 
        r.element_type == "generator"
      )
      |> last()
      |> group(columns: ["element_id"])
  `;

  const genData = [];
  await queryApi.collectRows(flux, (row, tableMeta) => {
    genData.push(tableMeta.toObject(row));
  });

  // Map generation data to types
  for (const row of result.rows) {
    currentGen[row.generation_type] = 0;
  }

  // Get generator types for current generation
  if (genData.length > 0) {
    const genIds = genData.map(g => g.element_id);
    const genTypes = await query(
      `SELECT g.id, g.generation_type 
       FROM generators g 
       WHERE g.id = ANY($1)`,
      [genIds]
    );

    const typeMap = {};
    genTypes.rows.forEach(gt => {
      typeMap[gt.id] = gt.generation_type;
    });

    genData.forEach(g => {
      const type = typeMap[g.element_id];
      if (type && currentGen[type] !== undefined) {
        currentGen[type] += g._value || 0;
      }
    });
  }

  const totalCapacity = result.rows.reduce((sum, r) => sum + parseFloat(r.total_capacity), 0);
  const totalCurrent = Object.values(currentGen).reduce((sum, val) => sum + val, 0);

  const mix = result.rows.map(row => ({
    generation_type: row.generation_type,
    unit_count: parseInt(row.unit_count),
    total_capacity: parseFloat(row.total_capacity),
    available_capacity: parseFloat(row.available_capacity),
    current_generation: currentGen[row.generation_type] || 0,
    capacity_factor: row.available_capacity > 0 
      ? (currentGen[row.generation_type] || 0) / row.available_capacity 
      : 0,
    percentage_of_total: totalCapacity > 0 
      ? (parseFloat(row.total_capacity) / totalCapacity * 100) 
      : 0,
    avg_efficiency: parseFloat(row.avg_efficiency) || null,
    is_renewable: ['solar', 'wind', 'hydro'].includes(row.generation_type)
  }));

  const summary = {
    mix,
    totals: {
      capacity: totalCapacity,
      available: result.rows.reduce((sum, r) => sum + parseFloat(r.available_capacity), 0),
      current_generation: totalCurrent,
      renewable_percentage: calculateRenewablePercentage(mix),
      capacity_utilization: totalCapacity > 0 ? (totalCurrent / totalCapacity * 100) : 0
    }
  };

  // Cache for 2 minutes
  await cache.set(cacheKey, summary, 120);

  return successResponse(summary);
}

async function getNetworkLosses(period) {
  const cacheKey = `analytics:network_losses:${period}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return successResponse(cached);
  }

  const { queryApi } = getInfluxAPIs();
  const window = getAggregationWindow(period);

  // Get generation and load data
  const flux = `
    genPower = from(bucket: "${process.env.INFLUXDB_BUCKET}")
      |> range(start: -${period})
      |> filter(fn: (r) => 
        r._measurement == "grid_measurements" and 
        r._field == "active_power" and 
        r.element_type == "generator"
      )
      |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)
      |> group(columns: ["_time"])
      |> sum()
      |> yield(name: "generation")

    loadPower = from(bucket: "${process.env.INFLUXDB_BUCKET}")
      |> range(start: -${period})
      |> filter(fn: (r) => 
        r._measurement == "grid_measurements" and 
        r._field == "active_power" and 
        r.element_type == "load"
      )
      |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)
      |> group(columns: ["_time"])
      |> sum()
      |> yield(name: "load")
  `;

  const genData = [];
  const loadData = [];
  
  await queryApi.collectRows(flux, (row, tableMeta) => {
    const obj = tableMeta.toObject(row);
    if (obj.result === 'generation') {
      genData.push({ time: obj._time, value: obj._value });
    } else if (obj.result === 'load') {
      loadData.push({ time: obj._time, value: obj._value });
    }
  });

  // Calculate losses
  const losses = [];
  const timeMap = new Map();
  
  genData.forEach(g => timeMap.set(g.time, { generation: g.value }));
  loadData.forEach(l => {
    const entry = timeMap.get(l.time) || {};
    entry.load = l.value;
    timeMap.set(l.time, entry);
  });

  for (const [time, data] of timeMap) {
    const generation = data.generation || 0;
    const load = data.load || 0;
    const loss = generation - load;
    const lossPercentage = generation > 0 ? (loss / generation * 100) : 0;
    
    losses.push({
      timestamp: time,
      generation,
      load,
      loss,
      loss_percentage: lossPercentage
    });
  }

  // Calculate statistics
  const lossValues = losses.map(l => l.loss);
  const avgLoss = lossValues.length > 0 
    ? lossValues.reduce((a, b) => a + b, 0) / lossValues.length 
    : 0;
  const maxLoss = Math.max(...lossValues, 0);
  const minLoss = Math.min(...lossValues, 0);

  // Get line losses estimation
  const lineData = await query(`
    SELECT 
      COUNT(*) as line_count,
      AVG(length) as avg_length,
      AVG(resistance) as avg_resistance
    FROM transmission_lines tl
    JOIN grid_elements e ON tl.id = e.id
    WHERE e.deleted_at IS NULL AND e.status = 'active'
  `);

  const result = {
    period,
    window,
    losses,
    statistics: {
      avg_loss: avgLoss,
      max_loss: maxLoss,
      min_loss: minLoss,
      avg_loss_percentage: losses.length > 0
        ? losses.reduce((sum, l) => sum + l.loss_percentage, 0) / losses.length
        : 0,
      total_energy_lost: avgLoss * losses.length * (parseWindowToHours(window))
    },
    network_info: lineData.rows[0]
  };

  // Cache for 5 minutes
  await cache.set(cacheKey, result, 300);

  return successResponse(result);
}

async function getReliabilityMetrics(period) {
  const cacheKey = `analytics:reliability:${period}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return successResponse(cached);
  }

  // Calculate period boundaries
  const endDate = new Date();
  const startDate = new Date();
  switch (period) {
    case '24h': startDate.setHours(endDate.getHours() - 24); break;
    case '7d': startDate.setDate(endDate.getDate() - 7); break;
    case '30d': startDate.setDate(endDate.getDate() - 30); break;
    case '1y': startDate.setFullYear(endDate.getFullYear() - 1); break;
    default: startDate.setHours(endDate.getHours() - 24);
  }

  // Get fault events
  const faults = await query(`
    SELECT 
      e.element_type,
      COUNT(*) as fault_count,
      AVG(EXTRACT(EPOCH FROM (ev.resolved_at - ev.created_at))/60) as avg_duration_minutes,
      MAX(EXTRACT(EPOCH FROM (ev.resolved_at - ev.created_at))/60) as max_duration_minutes
    FROM events ev
    JOIN grid_elements e ON ev.element_id = e.id
    WHERE ev.event_type = 'fault'
      AND ev.created_at >= $1
      AND ev.created_at <= $2
    GROUP BY e.element_type
  `, [startDate, endDate]);

  // Get element availability
  const availability = await query(`
    WITH element_status AS (
      SELECT 
        element_type,
        COUNT(*) as total_elements,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_elements
      FROM grid_elements
      WHERE deleted_at IS NULL
      GROUP BY element_type
    )
    SELECT 
      element_type,
      total_elements,
      active_elements,
      CASE WHEN total_elements > 0 
        THEN (active_elements::float / total_elements * 100) 
        ELSE 100 
      END as availability_percentage
    FROM element_status
  `);

  // Calculate SAIDI, SAIFI, CAIDI
  const totalCustomers = await query(`
    SELECT COUNT(*) as count 
    FROM loads 
    WHERE id IN (SELECT id FROM grid_elements WHERE deleted_at IS NULL)
  `);
  
  const customerCount = parseInt(totalCustomers.rows[0].count) || 1;

  // Get interruption data
  const interruptions = await query(`
    SELECT 
      COUNT(DISTINCT ev.id) as total_interruptions,
      COUNT(DISTINCT l.id) as affected_customers,
      SUM(EXTRACT(EPOCH FROM (COALESCE(ev.resolved_at, NOW()) - ev.created_at))/60) as total_duration_minutes
    FROM events ev
    JOIN loads l ON l.bus_id IN (
      SELECT id FROM grid_elements 
      WHERE id = ev.element_id OR id IN (
        SELECT to_element_id FROM network_connections WHERE from_element_id = ev.element_id
        UNION
        SELECT from_element_id FROM network_connections WHERE to_element_id = ev.element_id
      )
    )
    WHERE ev.event_type = 'fault'
      AND ev.severity IN ('critical', 'high')
      AND ev.created_at >= $1
      AND ev.created_at <= $2
  `, [startDate, endDate]);

  const intData = interruptions.rows[0];
  const saifi = customerCount > 0 ? (intData.affected_customers || 0) / customerCount : 0;
  const saidi = customerCount > 0 ? (intData.total_duration_minutes || 0) / customerCount : 0;
  const caidi = intData.total_interruptions > 0 ? saidi / saifi : 0;

  const result = {
    period,
    date_range: {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    },
    faults: faults.rows,
    availability: availability.rows,
    indices: {
      saifi: {
        value: saifi,
        description: 'System Average Interruption Frequency Index',
        unit: 'interruptions/customer'
      },
      saidi: {
        value: saidi,
        description: 'System Average Interruption Duration Index',
        unit: 'minutes/customer'
      },
      caidi: {
        value: caidi,
        description: 'Customer Average Interruption Duration Index',
        unit: 'minutes/interruption'
      }
    },
    summary: {
      total_faults: faults.rows.reduce((sum, f) => sum + parseInt(f.fault_count), 0),
      total_customers: customerCount,
      affected_customers: parseInt(intData.affected_customers) || 0,
      total_interruption_time: parseFloat(intData.total_duration_minutes) || 0
    }
  };

  // Cache for 10 minutes
  await cache.set(cacheKey, result, 600);

  return successResponse(result);
}

async function getEnergyConsumption(period, groupBy = 'hour') {
  const cacheKey = `analytics:energy:${period}:${groupBy}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return successResponse(cached);
  }

  const { queryApi } = getInfluxAPIs();
  const window = groupBy === 'hour' ? '1h' : groupBy === 'day' ? '1d' : '1h';

  // Get energy consumption data
  const flux = `
    from(bucket: "${process.env.INFLUXDB_BUCKET}")
      |> range(start: -${period})
      |> filter(fn: (r) => 
        r._measurement == "grid_measurements" and 
        r._field == "active_power" and 
        r.element_type == "load"
      )
      |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
      |> map(fn: (r) => ({ r with _value: r._value * ${parseWindowToHours(window)} }))
      |> group(columns: ["_time"])
      |> sum()
      |> yield(name: "energy")
  `;

  const data = [];
  await queryApi.collectRows(flux, (row, tableMeta) => {
    const obj = tableMeta.toObject(row);
    data.push({
      timestamp: obj._time,
      energy_kwh: obj._value || 0
    });
  });

  // Get consumption by load type
  const byType = await query(`
    SELECT 
      l.load_type,
      SUM(l.rated_power) as capacity,
      COUNT(*) as count
    FROM loads l
    JOIN grid_elements e ON l.id = e.id
    WHERE e.deleted_at IS NULL AND e.status = 'active'
    GROUP BY l.load_type
  `);

  // Calculate totals and statistics
  const totalEnergy = data.reduce((sum, d) => sum + d.energy_kwh, 0);
  const avgConsumption = data.length > 0 ? totalEnergy / data.length : 0;
  const peakConsumption = Math.max(...data.map(d => d.energy_kwh), 0);

  const result = {
    period,
    groupBy,
    window,
    consumption: data,
    by_type: byType.rows.map(t => ({
      ...t,
      estimated_consumption: totalEnergy * (parseFloat(t.capacity) / byType.rows.reduce((sum, r) => sum + parseFloat(r.capacity), 1))
    })),
    statistics: {
      total_energy_kwh: totalEnergy,
      avg_consumption_kwh: avgConsumption,
      peak_consumption_kwh: peakConsumption,
      min_consumption_kwh: Math.min(...data.map(d => d.energy_kwh), 0)
    }
  };

  // Cache for 5 minutes
  await cache.set(cacheKey, result, 300);

  return successResponse(result);
}

async function getPeakDemand(period) {
  const cacheKey = `analytics:peak_demand:${period}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return successResponse(cached);
  }

  const { queryApi } = getInfluxAPIs();

  // Get peak demand periods
  const flux = `
    from(bucket: "${process.env.INFLUXDB_BUCKET}")
      |> range(start: -${period})
      |> filter(fn: (r) => 
        r._measurement == "grid_measurements" and 
        r._field == "active_power" and 
        r.element_type == "load"
      )
      |> aggregateWindow(every: 15m, fn: sum, createEmpty: false)
      |> group()
      |> top(n: 10, columns: ["_value"])
  `;

  const peaks = [];
  await queryApi.collectRows(flux, (row, tableMeta) => {
    const obj = tableMeta.toObject(row);
    peaks.push({
      timestamp: obj._time,
      demand_mw: obj._value || 0
    });
  });

  // Get demand charges estimation
  const demandCharge = 15; // $/kW (example rate)
  const peakDemand = peaks.length > 0 ? peaks[0].demand_mw : 0;
  const estimatedCharge = peakDemand * demandCharge * 1000; // Convert MW to kW

  const result = {
    period,
    peak_periods: peaks,
    peak_demand: {
      value: peakDemand,
      timestamp: peaks.length > 0 ? peaks[0].timestamp : null,
      unit: 'MW'
    },
    demand_charge_estimate: {
      rate: demandCharge,
      rate_unit: '$/kW',
      estimated_charge: estimatedCharge,
      currency: 'USD'
    }
  };

  // Cache for 5 minutes
  await cache.set(cacheKey, result, 300);

  return successResponse(result);
}

async function getPowerQuality(period, elementIds) {
  const cacheKey = `analytics:power_quality:${period}:${elementIds?.join(',')}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return successResponse(cached);
  }

  const { queryApi } = getInfluxAPIs();
  
  let filter = 'true';
  if (elementIds && elementIds.length > 0) {
    const ids = elementIds.map(id => `r.element_id == "${id}"`).join(' or ');
    filter = `(${ids})`;
  }

  // Get voltage quality metrics
  const voltageFlux = `
    from(bucket: "${process.env.INFLUXDB_BUCKET}")
      |> range(start: -${period})
      |> filter(fn: (r) => 
        r._measurement == "grid_measurements" and 
        r._field == "voltage" and ${filter}
      )
      |> map(fn: (r) => ({
        r with
        deviation: math.abs(x: (r._value - 11.0) / 11.0 * 100.0)
      }))
      |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
  `;

  const voltageData = [];
  await queryApi.collectRows(voltageFlux, (row, tableMeta) => {
    const obj = tableMeta.toObject(row);
    voltageData.push({
      time: obj._time,
      element_id: obj.element_id,
      voltage: obj._value,
      deviation: obj.deviation
    });
  });

  // Get frequency quality metrics
  const frequencyFlux = `
    from(bucket: "${process.env.INFLUXDB_BUCKET}")
      |> range(start: -${period})
      |> filter(fn: (r) => 
        r._measurement == "grid_measurements" and 
        r._field == "frequency" and ${filter}
      )
      |> map(fn: (r) => ({
        r with
        deviation: math.abs(x: (r._value - 50.0) / 50.0 * 100.0)
      }))
      |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
  `;

  const frequencyData = [];
  await queryApi.collectRows(frequencyFlux, (row, tableMeta) => {
    const obj = tableMeta.toObject(row);
    frequencyData.push({
      time: obj._time,
      element_id: obj.element_id,
      frequency: obj._value,
      deviation: obj.deviation
    });
  });

  // Calculate statistics
  const voltageDeviations = voltageData.map(v => v.deviation);
  const frequencyDeviations = frequencyData.map(f => f.deviation);

  // Count violations
  const voltageViolations = voltageDeviations.filter(d => d > 5).length; // >5% deviation
  const frequencyViolations = frequencyDeviations.filter(d => d > 1).length; // >1% deviation

  const result = {
    period,
    voltage_quality: {
      avg_deviation: voltageDeviations.length > 0 
        ? voltageDeviations.reduce((a, b) => a + b, 0) / voltageDeviations.length 
        : 0,
      max_deviation: Math.max(...voltageDeviations, 0),
      violations: voltageViolations,
      violation_percentage: voltageDeviations.length > 0 
        ? (voltageViolations / voltageDeviations.length * 100) 
        : 0,
      compliance: voltageDeviations.length > 0 
        ? ((voltageDeviations.length - voltageViolations) / voltageDeviations.length * 100) 
        : 100
    },
    frequency_quality: {
      avg_deviation: frequencyDeviations.length > 0 
        ? frequencyDeviations.reduce((a, b) => a + b, 0) / frequencyDeviations.length 
        : 0,
      max_deviation: Math.max(...frequencyDeviations, 0),
      violations: frequencyViolations,
      violation_percentage: frequencyDeviations.length > 0 
        ? (frequencyViolations / frequencyDeviations.length * 100) 
        : 0,
      compliance: frequencyDeviations.length > 0 
        ? ((frequencyDeviations.length - frequencyViolations) / frequencyDeviations.length * 100) 
        : 100
    },
    total_measurements: voltageData.length + frequencyData.length
  };

  // Cache for 5 minutes
  await cache.set(cacheKey, result, 300);

  return successResponse(result);
}

// Helper functions
function getAggregationWindow(period) {
  const windows = {
    '1h': '1m',
    '6h': '5m',
    '24h': '15m',
    '7d': '1h',
    '30d': '6h',
    '90d': '1d',
    '1y': '1d'
  };
  return windows[period] || '15m';
}

function parseWindowToHours(window) {
  const match = window.match(/(\d+)(\w+)/);
  if (!match) return 1;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 'm': return value / 60;
    case 'h': return value;
    case 'd': return value * 24;
    default: return 1;
  }
}

function calculateVariance(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

function calculateRenewablePercentage(mix) {
  const renewableTypes = ['solar', 'wind', 'hydro'];
  const renewableCapacity = mix
    .filter(g => renewableTypes.includes(g.generation_type))
    .reduce((sum, g) => sum + g.total_capacity, 0);
  const totalCapacity = mix.reduce((sum, g) => sum + g.total_capacity, 0);
  return totalCapacity > 0 ? (renewableCapacity / totalCapacity * 100) : 0;
}
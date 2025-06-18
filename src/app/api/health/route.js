// src/app/api/health/route.js
import { NextResponse } from 'next/server';
import { checkConnection as checkPostgres } from '@/lib/db/postgres';
import { checkConnection as checkRedis } from '@/lib/db/redis';
import { checkConnection as checkInflux } from '@/lib/db/influx';
import { publicEndpoint } from '@/lib/auth/middleware';

export const GET = publicEndpoint(async (request) => {
    const services = {};
    let allHealthy = true;

    // Check PostgreSQL
    try {
      const pgStatus = await checkPostgres();
      services.postgres = pgStatus;
      if (!pgStatus.connected) allHealthy = false;
    } catch (error) {
      services.postgres = { connected: false, error: error.message };
      allHealthy = false;
    }

    // Check Redis
    try {
      const redisStatus = await checkRedis();
      services.redis = redisStatus;
      if (!redisStatus.connected) allHealthy = false;
    } catch (error) {
      services.redis = { connected: false, error: error.message };
      allHealthy = false;
    }

    // Check InfluxDB (optional - may not be running initially)
    try {
      const influxStatus = await checkInflux();
      services.influxdb = influxStatus;
      // Don't fail health check if InfluxDB is down
    } catch (error) {
      services.influxdb = { connected: false, error: error.message };
    }

    const response = {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    return NextResponse.json(response, { 
      status: allHealthy ? 200 : 503 
    });
});
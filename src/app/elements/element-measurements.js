// src/components/elements/element-measurements.js
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, TrendingUp, AlertCircle } from 'lucide-react';
import { useMeasurements } from '@/hooks/api/useMeasurements';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function ElementMeasurements({ elementId, elementType }) {
  const { data, isLoading } = useMeasurements(elementId, '-1h');
  const [currentValues, setCurrentValues] = useState({});

  useEffect(() => {
    if (data?.data && data.data.length > 0) {
      // Get the most recent measurement
      const latest = data.data[data.data.length - 1];
      setCurrentValues(latest);
    }
  }, [data]);

  const getMeasurementConfig = () => {
    switch (elementType) {
      case 'generator':
        return [
          { key: 'active_power', label: 'Active Power', unit: 'MW', color: '#3b82f6' },
          { key: 'reactive_power', label: 'Reactive Power', unit: 'MVAR', color: '#10b981' },
          { key: 'voltage', label: 'Voltage', unit: 'kV', color: '#f59e0b' },
          { key: 'frequency', label: 'Frequency', unit: 'Hz', color: '#8b5cf6' }
        ];
      case 'load':
        return [
          { key: 'active_power', label: 'Power Consumption', unit: 'kW', color: '#3b82f6' },
          { key: 'power_factor', label: 'Power Factor', unit: '', color: '#10b981' },
          { key: 'voltage', label: 'Voltage', unit: 'kV', color: '#f59e0b' },
          { key: 'current', label: 'Current', unit: 'A', color: '#ef4444' }
        ];
      case 'transformer':
        return [
          { key: 'active_power', label: 'Power Flow', unit: 'MW', color: '#3b82f6' },
          { key: 'temperature', label: 'Temperature', unit: '°C', color: '#ef4444' },
          { key: 'current', label: 'Current', unit: 'A', color: '#10b981' },
          { key: 'tap_position', label: 'Tap Position', unit: '', color: '#8b5cf6' }
        ];
      case 'line':
        return [
          { key: 'active_power', label: 'Power Flow', unit: 'MW', color: '#3b82f6' },
          { key: 'current', label: 'Current', unit: 'A', color: '#10b981' },
          { key: 'voltage', label: 'Voltage', unit: 'kV', color: '#f59e0b' },
          { key: 'losses', label: 'Losses', unit: 'kW', color: '#ef4444' }
        ];
      case 'bus':
        return [
          { key: 'voltage', label: 'Voltage', unit: 'kV', color: '#3b82f6' },
          { key: 'frequency', label: 'Frequency', unit: 'Hz', color: '#10b981' },
          { key: 'voltage_angle', label: 'Voltage Angle', unit: '°', color: '#f59e0b' }
        ];
      default:
        return [];
    }
  };

  const measurements = getMeasurementConfig();

  if (!measurements.length) {
    return null;
  }

  const formatChartData = () => {
    if (!data?.data) return [];
    
    return data.data.map(item => ({
      time: format(new Date(item.timestamp), 'HH:mm'),
      ...item
    }));
  };

  const chartData = formatChartData();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Real-time Measurements</span>
          </span>
          {!isLoading && data && (
            <span className="text-sm font-normal text-gray-600">
              Last hour
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Current Values Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {measurements.map((measurement) => {
            const value = currentValues[measurement.key];
            const isNormal = true; // TODO: Add threshold checking
            
            return (
              <div 
                key={measurement.key} 
                className="bg-gray-50 rounded-lg p-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600">{measurement.label}</p>
                    <p className="text-xl font-semibold mt-1">
                      {value !== undefined ? value.toFixed(2) : '—'} 
                      <span className="text-sm font-normal text-gray-600 ml-1">
                        {measurement.unit}
                      </span>
                    </p>
                  </div>
                  {!isNormal && (
                    <AlertCircle className="h-4 w-4 text-yellow-500 mt-1" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Chart */}
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-gray-500">
            Loading measurements...
          </div>
        ) : chartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="time" 
                  stroke="#888"
                  fontSize={12}
                />
                <YAxis 
                  stroke="#888"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px'
                  }}
                />
                {measurements.slice(0, 2).map((measurement) => (
                  <Line
                    key={measurement.key}
                    type="monotone"
                    dataKey={measurement.key}
                    stroke={measurement.color}
                    strokeWidth={2}
                    dot={false}
                    name={measurement.label}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            No measurement data available
          </div>
        )}

        {/* Status Indicator */}
        <div className="mt-4 flex items-center justify-center text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-gray-600">Receiving live data</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
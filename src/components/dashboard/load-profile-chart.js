// src/components/dashboard/load-profile-chart.js
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Loader2 } from 'lucide-react';
import { useLoadProfile } from '@/hooks/api/useAnalytics';
import { format } from 'date-fns';

export default function LoadProfileChart() {
  const { data, isLoading } = useLoadProfile('24h');
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    if (data?.profile) {
      const formattedData = data.profile.map(item => ({
        time: format(new Date(item.timestamp), 'HH:mm'),
        load: item.total_load,
      }));
      setChartData(formattedData);
    }
  }, [data]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-sm text-blue-600">
            Load: {payload[0].value.toFixed(2)} MW
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Load Profile (24h)</span>
          {data?.statistics && (
            <div className="flex items-center space-x-4 text-sm font-normal">
              <span className="text-gray-600">
                Peak: <span className="font-medium text-gray-900">{data.statistics.peak_load.toFixed(2)} MW</span>
              </span>
              <span className="text-gray-600">
                Avg: <span className="font-medium text-gray-900">{data.statistics.avg_load.toFixed(2)} MW</span>
              </span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="time" 
                stroke="#888"
                fontSize={12}
                tickFormatter={(value) => value}
              />
              <YAxis 
                stroke="#888"
                fontSize={12}
                label={{ value: 'Load (MW)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="load" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
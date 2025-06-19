// src/components/dashboard/generation-mix-chart.js
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Loader2 } from 'lucide-react';
import { useGenerationMix } from '@/hooks/api/useAnalytics';

const COLORS = {
  solar: '#f59e0b',
  wind: '#10b981',
  hydro: '#3b82f6',
  thermal: '#6b7280',
  nuclear: '#8b5cf6',
  battery: '#ec4899'
};

export default function GenerationMixChart() {
  const { data, isLoading } = useGenerationMix();

  const chartData = data?.mix?.map(item => ({
    name: item.generation_type.charAt(0).toUpperCase() + item.generation_type.slice(1),
    value: parseFloat(item.current_generation),
    percentage: item.percentage_of_total,
    capacity: item.total_capacity
  })) || [];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="text-sm font-medium">{data.name}</p>
          <p className="text-sm text-gray-600">
            Generation: {data.value.toFixed(2)} MW
          </p>
          <p className="text-sm text-gray-600">
            Capacity: {data.payload.capacity.toFixed(2)} MW
          </p>
          <p className="text-sm text-gray-600">
            Share: {data.payload.percentage.toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);

    if (percent < 0.05) return null; // Don't show label for small slices

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-sm font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Generation Mix</span>
          {data?.totals && (
            <div className="text-sm font-normal">
              <span className="text-gray-600">Total: </span>
              <span className="font-medium text-gray-900">
                {data.totals.current_generation.toFixed(2)} MW
              </span>
              <span className="text-green-600 ml-2">
                ({data.totals.renewable_percentage.toFixed(1)}% Renewable)
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
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.name.toLowerCase()] || '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value, entry) => {
                  const v = typeof entry?.value === 'number' ? entry.value.toFixed(2) : '0.00';
                  return <span className="text-sm">{value} ({v} MW)</span>;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
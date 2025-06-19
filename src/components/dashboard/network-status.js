// src/components/dashboard/network-status.js
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function NetworkStatus({ measurements, connectionStatus }) {
  const [realtimeData, setRealtimeData] = useState({});
  
  useEffect(() => {
    if (measurements) {
      setRealtimeData(measurements);
    }
  }, [measurements]);

  const mockElements = [
    { id: '1', name: 'Substation A', type: 'bus', voltage: 132, status: 'active' },
    { id: '2', name: 'Solar Farm 1', type: 'generator', power: 45.2, status: 'active' },
    { id: '3', name: 'Industrial Load', type: 'load', power: 78.5, status: 'active' },
    { id: '4', name: 'Wind Farm 1', type: 'generator', power: 32.8, status: 'maintenance' },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'maintenance': return 'bg-yellow-500';
      case 'fault': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'generator': return '⚡';
      case 'load': return '🏭';
      case 'bus': return '🔌';
      default: return '📍';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Network Status
          </span>
          <div className="flex items-center gap-2 text-sm font-normal">
            {connectionStatus === 'connected' ? (
              <>
                <Wifi className="h-4 w-4 text-green-600" />
                <span className="text-green-600">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-gray-400" />
                <span className="text-gray-400">Offline</span>
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Grid Status Summary */}
          <div className="grid grid-cols-3 gap-4 pb-4 border-b">
            <div>
              <p className="text-sm text-gray-600">System Voltage</p>
              <p className="text-xl font-semibold">
                {realtimeData.voltage?.toFixed(1) || '132.0'} kV
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Power Flow</p>
              <p className="text-xl font-semibold">
                {realtimeData.power?.toFixed(2) || '156.8'} MW
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Efficiency</p>
              <p className="text-xl font-semibold text-green-600">
                {realtimeData.efficiency?.toFixed(2) || '98.5'}%
              </p>
            </div>
          </div>

          {/* Elements Status */}
          <div className="space-y-3">
            {mockElements.map((element) => (
              <div key={element.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getTypeIcon(element.type)}</span>
                  <div>
                    <p className="font-medium text-sm">{element.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{element.type}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    {element.voltage && (
                      <p className="text-sm font-medium">{element.voltage} kV</p>
                    )}
                    {element.power && (
                      <p className="text-sm font-medium">{element.power} MW</p>
                    )}
                  </div>
                  <div className={cn(
                    'w-3 h-3 rounded-full animate-pulse',
                    getStatusColor(element.status)
                  )} />
                </div>
              </div>
            ))}
          </div>

          {/* Connection Status Legend */}
          <div className="flex items-center justify-center space-x-6 pt-4 border-t text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Active</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>Maintenance</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Fault</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
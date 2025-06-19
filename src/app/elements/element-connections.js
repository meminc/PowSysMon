// src/components/elements/element-connections.js
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Network, Zap, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function ElementConnections({ element }) {
  const router = useRouter();
  const connections = element.connections || [];

  const getConnectionIcon = (type) => {
    switch (type) {
      case 'electrical':
        return <Zap className="h-4 w-4 text-yellow-600" />;
      default:
        return <Network className="h-4 w-4 text-gray-600" />;
    }
  };

  const getElementTypeIcon = (type) => {
    const icons = {
      generator: '⚡',
      load: '🏭',
      transformer: '📦',
      line: '➖',
      bus: '🔌'
    };
    return icons[type] || '📍';
  };

  if (connections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Network className="h-5 w-5" />
            <span>Connections</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 text-center py-4">
            No connections found
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <Network className="h-5 w-5" />
            <span>Connections</span>
          </span>
          <span className="text-sm font-normal text-gray-600">
            {connections.length} connected
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {connections.map((connection) => {
            const isFrom = connection.from_element_id === element.id;
            const connectedId = isFrom ? connection.to_element_id : connection.from_element_id;
            const connectedName = connection.connected_element_name || 'Unknown Element';
            
            return (
              <div
                key={connection.id}
                className={cn(
                  "p-3 rounded-lg border transition-all cursor-pointer",
                  "hover:shadow-sm hover:border-blue-300",
                  connection.is_connected 
                    ? "bg-white border-gray-200" 
                    : "bg-gray-50 border-gray-300"
                )}
                onClick={() => router.push(`/elements/${connectedId}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getConnectionIcon(connection.connection_type)}
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {connectedName}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">
                        {connection.connection_type} connection
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!connection.is_connected && (
                      <span className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded">
                        Disconnected
                      </span>
                    )}
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
                
                {/* Connection Direction Indicator */}
                <div className="mt-2 flex items-center text-xs text-gray-500">
                  <span className="mr-1">{getElementTypeIcon(element.element_type)}</span>
                  <span>{element.name}</span>
                  <span className="mx-2">→</span>
                  <span className="mr-1">{getElementTypeIcon('bus')}</span>
                  <span>{connectedName}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
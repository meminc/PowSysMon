// src/components/dashboard/recent-events.js
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useEvents } from '@/hooks/api/useEvents';

export default function RecentEvents() {
  const { data, isLoading } = useEvents({ limit: 5, status: 'active' });

  const getEventIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'medium':
        return <Info className="h-4 w-4 text-yellow-600" />;
      case 'low':
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      default:
        return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-50 border-red-200';
      case 'high': return 'bg-orange-50 border-orange-200';
      case 'medium': return 'bg-yellow-50 border-yellow-200';
      case 'low': return 'bg-blue-50 border-blue-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  // Mock data for demonstration
  const mockEvents = [
    {
      id: '1',
      severity: 'critical',
      description: 'Overcurrent detected on Line L1',
      element_name: 'Transmission Line L1',
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      status: 'active'
    },
    {
      id: '2',
      severity: 'high',
      description: 'Voltage fluctuation at Bus B2',
      element_name: 'Bus B2',
      created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      status: 'active'
    },
    {
      id: '3',
      severity: 'medium',
      description: 'Temperature warning on Transformer T1',
      element_name: 'Transformer T1',
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      status: 'acknowledged'
    },
    {
      id: '4',
      severity: 'low',
      description: 'Scheduled maintenance reminder',
      element_name: 'Solar Farm SF1',
      created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      status: 'active'
    },
    {
      id: '5',
      severity: 'medium',
      description: 'Power factor below threshold',
      element_name: 'Industrial Load IL1',
      created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
      status: 'active'
    }
  ];

  const events = data?.data || mockEvents;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Recent Events</span>
          <span className="text-sm font-normal text-gray-600">
            {events.filter(e => e.severity === 'critical').length} Critical
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              Loading events...
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No active events
            </div>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className={cn(
                  'p-3 rounded-lg border transition-all hover:shadow-sm cursor-pointer',
                  getSeverityColor(event.severity)
                )}
              >
                <div className="flex items-start space-x-3">
                  {getEventIcon(event.severity)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {event.description}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {event.element_name}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                      </span>
                      {event.status === 'acknowledged' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                          Acknowledged
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        {events.length > 0 && (
          <div className="mt-4 text-center">
            <a href="/events" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View all events →
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
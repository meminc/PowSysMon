// src/components/map/element-info-panel.js
'use client';

import { X, Edit, ExternalLink, MapPin, Activity, AlertCircle } from 'lucide-react';
import Button from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function ElementInfoPanel({
  element,
  measurements,
  onClose,
  onEdit,
  onViewDetails
}) {
  if (!element) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'maintenance': return 'text-yellow-600 bg-yellow-100';
      case 'fault': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getElementIcon = (type) => {
    const icons = {
      bus: '🔌',
      generator: '⚡',
      load: '🏭',
      transformer: '⚙️',
      line: '📏',
    };
    return icons[type] || '📍';
  };

  const renderProperties = () => {
    const props = element.properties || {};
    
    switch (element.element_type) {
      case 'generator':
        return (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Type:</span>
              <span className="font-medium capitalize">{props.generation_type || 'Unknown'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Capacity:</span>
              <span className="font-medium">{props.rated_capacity ? `${props.rated_capacity} MW` : 'Unknown'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Voltage:</span>
              <span className="font-medium">{props.voltage_level ? `${props.voltage_level} kV` : 'Unknown'}</span>
            </div>
            {props.efficiency && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Efficiency:</span>
                <span className="font-medium">{(props.efficiency * 100).toFixed(1)}%</span>
              </div>
            )}
          </div>
        );

      case 'load':
        return (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Type:</span>
              <span className="font-medium capitalize">{props.load_type || 'Unknown'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Power:</span>
              <span className="font-medium">{props.rated_power ? `${props.rated_power} MW` : 'Unknown'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Voltage:</span>
              <span className="font-medium">{props.voltage_level ? `${props.voltage_level} kV` : 'Unknown'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Priority:</span>
              <span className="font-medium capitalize">{props.priority || 'Medium'}</span>
            </div>
          </div>
        );

      case 'transformer':
        return (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Ratio:</span>
              <span className="font-medium">
                {props.primary_voltage && props.secondary_voltage 
                  ? `${props.primary_voltage}/${props.secondary_voltage} kV`
                  : 'Unknown'
                }
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Rating:</span>
              <span className="font-medium">{props.rated_power ? `${props.rated_power} MVA` : 'Unknown'}</span>
            </div>
            {props.current_tap !== undefined && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tap Position:</span>
                <span className="font-medium">{props.current_tap}</span>
              </div>
            )}
          </div>
        );

      case 'bus':
        return (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Voltage Level:</span>
              <span className="font-medium">{props.voltage_level ? `${props.voltage_level} kV` : 'Unknown'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Type:</span>
              <span className="font-medium uppercase">{props.bus_type || 'PQ'}</span>
            </div>
          </div>
        );

      case 'line':
        return (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Length:</span>
              <span className="font-medium">{props.length ? `${props.length.toFixed(2)} km` : 'Unknown'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Voltage:</span>
              <span className="font-medium">{props.voltage_level ? `${props.voltage_level} kV` : 'Unknown'}</span>
            </div>
            {props.coordinates && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Path Points:</span>
                <span className="font-medium">{props.coordinates.length}</span>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="text-sm text-gray-500">
            No specific properties available
          </div>
        );
    }
  };

  const renderMeasurements = () => {
    if (!measurements || Object.keys(measurements).length === 0) {
      return (
        <div className="text-sm text-gray-500">
          No real-time data available
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {measurements.voltage && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Voltage:</span>
            <span className="font-medium">{measurements.voltage.toFixed(2)} kV</span>
          </div>
        )}
        {measurements.current && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Current:</span>
            <span className="font-medium">{measurements.current.toFixed(1)} A</span>
          </div>
        )}
        {measurements.active_power && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Active Power:</span>
            <span className="font-medium">{measurements.active_power.toFixed(2)} MW</span>
          </div>
        )}
        {measurements.reactive_power && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Reactive Power:</span>
            <span className="font-medium">{measurements.reactive_power.toFixed(2)} MVAr</span>
          </div>
        )}
        {measurements.frequency && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Frequency:</span>
            <span className="font-medium">{measurements.frequency.toFixed(2)} Hz</span>
          </div>
        )}
        {measurements.temperature && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Temperature:</span>
            <span className="font-medium">{measurements.temperature.toFixed(1)} °C</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{getElementIcon(element.element_type)}</span>
            <div>
              <CardTitle className="text-base">{element.name}</CardTitle>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-sm text-gray-600 capitalize">
                  {element.element_type}
                </span>
                <span className={cn(
                  'px-2 py-0.5 text-xs font-medium rounded-full',
                  getStatusColor(element.status)
                )}>
                  {element.status}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Location */}
        {element.latitude && element.longitude && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location
            </h4>
            <div className="text-sm text-gray-600">
              {element.latitude.toFixed(6)}, {element.longitude.toFixed(6)}
            </div>
            {element.address && (
              <div className="text-sm text-gray-600 mt-1">
                {element.address}
              </div>
            )}
          </div>
        )}

        {/* Properties */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            Properties
          </h4>
          {renderProperties()}
        </div>

        {/* Real-time Measurements */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Real-time Data
            {measurements && Object.keys(measurements).length > 0 && (
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </h4>
          {renderMeasurements()}
        </div>

        {/* Description */}
        {element.description && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Description
            </h4>
            <p className="text-sm text-gray-600">
              {element.description}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-2 pt-2 border-t">
          <Button
            variant="secondary"
            size="sm"
            onClick={onEdit}
            className="flex items-center gap-2 flex-1"
          >
            <Edit className="h-3 w-3" />
            Edit
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onViewDetails}
            className="flex items-center gap-2 flex-1"
          >
            <ExternalLink className="h-3 w-3" />
            Details
          </Button>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
          <span>ID: {element.id.slice(0, 8)}...</span>
          <span>Updated: {new Date(element.updated_at).toLocaleTimeString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}
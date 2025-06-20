// src/components/elements/element-detail-modal.js
'use client';

import { useState } from 'react';
import { 
  X, 
  Edit, 
  MapPin, 
  Calendar, 
  Activity, 
  Zap, 
  Info,
  Settings,
  BarChart3,
  ExternalLink
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, cn } from '@/lib/utils';
import { useMeasurements } from '@/hooks/api/useMeasurements';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ElementDetailModal({ element, onClose, onEdit }) {
  console.log(element);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  
  // Get recent measurements for this element
  const { data: measurements, isLoading: measurementsLoading } = useMeasurements({
    element_id: element.id,
    start: '-24h',
    window: '1h'
  });

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'measurements', label: 'Measurements', icon: BarChart3 },
    { id: 'properties', label: 'Properties', icon: Settings },
    { id: 'connections', label: 'Connections', icon: Zap },
  ];

  // Get element type icon
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

  // Get status badge
  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-800 border-green-200',
      inactive: 'bg-gray-100 text-gray-800 border-gray-200',
      maintenance: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      fault: 'bg-red-100 text-red-800 border-red-200',
    };

    return (
      <span className={cn(
        'inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border',
        styles[status] || styles.inactive
      )}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Render type-specific properties
  const renderProperties = () => {
    const props = element.properties || {};
    
    switch (element.element_type) {
      case 'load':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Load Type</p>
              <p className="font-medium capitalize">{props.load_type || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Connection Type</p>
              <p className="font-medium">{props.connection_type?.replace('_', ' ') || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Rated Power</p>
              <p className="font-medium">{props.rated_power ? `${props.rated_power} MW` : 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Power Factor</p>
              <p className="font-medium">{props.power_factor || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Voltage Level</p>
              <p className="font-medium">{props.voltage_level ? `${props.voltage_level} kV` : 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Priority</p>
              <p className="font-medium capitalize">{props.priority || 'Unknown'}</p>
            </div>
          </div>
        );

      case 'generator':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Generation Type</p>
              <p className="font-medium capitalize">{props.generation_type || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Rated Capacity</p>
              <p className="font-medium">{props.rated_capacity ? `${props.rated_capacity} MW` : 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Min Capacity</p>
              <p className="font-medium">{props.min_capacity ? `${props.min_capacity} MW` : 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Max Capacity</p>
              <p className="font-medium">{props.max_capacity ? `${props.max_capacity} MW` : 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Efficiency</p>
              <p className="font-medium">{props.efficiency ? `${(props.efficiency * 100).toFixed(1)}%` : 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Voltage Level</p>
              <p className="font-medium">{props.voltage_level ? `${props.voltage_level} kV` : 'Unknown'}</p>
            </div>
            {props.fuel_type && (
              <div className="col-span-2">
                <p className="text-sm text-gray-600">Fuel Type</p>
                <p className="font-medium">{props.fuel_type}</p>
              </div>
            )}
          </div>
        );

      case 'transformer':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Primary Voltage</p>
              <p className="font-medium">{props.primary_voltage ? `${props.primary_voltage} kV` : 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Secondary Voltage</p>
              <p className="font-medium">{props.secondary_voltage ? `${props.secondary_voltage} kV` : 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Rated Power</p>
              <p className="font-medium">{props.rated_power ? `${props.rated_power} MVA` : 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Tap</p>
              <p className="font-medium">{props.current_tap ?? 'Unknown'}</p>
            </div>
            {props.winding_configuration && (
              <div>
                <p className="text-sm text-gray-600">Winding Configuration</p>
                <p className="font-medium">{props.winding_configuration}</p>
              </div>
            )}
            {props.cooling_type && (
              <div>
                <p className="text-sm text-gray-600">Cooling Type</p>
                <p className="font-medium">{props.cooling_type}</p>
              </div>
            )}
          </div>
        );

      case 'line':
        return (
          <div className="space-y-6">
            {/* Basic Line Properties */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Length</p>
                <p className="font-medium">{props.length ? `${props.length.toFixed(2)} km` : 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Voltage Level</p>
                <p className="font-medium">{props.voltage_level ? `${props.voltage_level} kV` : 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Rated Current</p>
                <p className="font-medium">{props.rated_current ? `${props.rated_current} A` : 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Conductor Type</p>
                <p className="font-medium">{props.conductor_type || 'Unknown'}</p>
              </div>
              {props.resistance && (
                <div>
                  <p className="text-sm text-gray-600">Resistance</p>
                  <p className="font-medium">{props.resistance} Ω/km</p>
                </div>
              )}
              {props.reactance && (
                <div>
                  <p className="text-sm text-gray-600">Reactance</p>
                  <p className="font-medium">{props.reactance} Ω/km</p>
                </div>
              )}
            </div>

            {/* Line Coordinates */}
            {props.coordinates && props.coordinates.length > 0 && (
              <div className="space-y-3">
                <h6 className="font-medium text-gray-900">Line Coordinates ({props.coordinates.length} points)</h6>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {props.coordinates.map((coord, index) => (
                    <div key={coord.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">
                          {coord.point_type === 'start' ? '🟢' : 
                           coord.point_type === 'end' ? '🔴' :
                           coord.point_type === 'tower' ? '🗼' :
                           coord.point_type === 'junction' ? '🔗' : '📍'}
                        </span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="font-medium text-sm">Point {coord.sequence_order + 1}</p>
                            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full capitalize">
                              {coord.point_type}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">
                            {parseFloat(coord.latitude || '0').toFixed(6)}, {parseFloat(coord.longitude || '0').toFixed(6)}
                            {coord.elevation && ` (${coord.elevation}m)`}
                          </p>
                          {coord.description && (
                            <p className="text-xs text-gray-500">{coord.description}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const url = `https://maps.google.com/?q=${coord.latitude},${coord.longitude}`;
                          window.open(url, '_blank');
                        }}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        View on Map
                      </button>
                    </div>
                  ))}
                </div>
                
                {/* Line Path Summary */}
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Path Type:</span>
                    <span className="font-medium">
                      {props.coordinates.length === 2 ? 'Direct Line' : `Multi-segment (${props.coordinates.length - 1} segments)`}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Start Point:</span>
                    <span className="font-medium">
                      {props.coordinates[0]?.latitude.toFixed(4)}, {props.coordinates[0]?.longitude.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">End Point:</span>
                    <span className="font-medium">
                      {props.coordinates[props.coordinates.length - 1]?.latitude.toFixed(4)}, {props.coordinates[props.coordinates.length - 1]?.longitude.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'bus':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Voltage Level</p>
              <p className="font-medium">{props.voltage_level ? `${props.voltage_level} kV` : 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Bus Type</p>
              <p className="font-medium uppercase">{props.bus_type || 'Unknown'}</p>
            </div>
            {props.nominal_voltage && (
              <div>
                <p className="text-sm text-gray-600">Nominal Voltage</p>
                <p className="font-medium">{props.nominal_voltage} kV</p>
              </div>
            )}
            {props.voltage_tolerance_min && props.voltage_tolerance_max && (
              <div>
                <p className="text-sm text-gray-600">Voltage Tolerance</p>
                <p className="font-medium">
                  {props.voltage_tolerance_min} - {props.voltage_tolerance_max} pu
                </p>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="text-center text-gray-500 py-8">
            No specific properties available for this element type.
          </div>
        );
    }
  };

  // Render connections
  const renderConnections = () => {
    const connections = element.connections || [];
    
    if (connections.length === 0) {
      return (
        <div className="text-center text-gray-500 py-8">
          <Zap className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p>No connections found for this element.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {connections.map((connection) => (
          <div
            key={connection.id}
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={cn(
                  'w-3 h-3 rounded-full',
                  connection.is_connected ? 'bg-green-500' : 'bg-red-500'
                )} />
                <div>
                  <p className="font-medium">{connection.connected_element_name}</p>
                  <p className="text-sm text-gray-600 capitalize">
                    {connection.connection_type} connection
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/elements/${connection.connected_element_id}`)}
                className="flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                View
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render measurements chart
  const renderMeasurements = () => {
    if (measurementsLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading measurements...</p>
          </div>
        </div>
      );
    }

    const data = measurements?.data || [];
    
    if (data.length === 0) {
      return (
        <div className="text-center text-gray-500 py-8">
          <BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p>No measurement data available for the last 24 hours.</p>
        </div>
      );
    }

    // Get available measurement fields
    const availableFields = Object.keys(data[0] || {}).filter(
      key => key !== 'timestamp' && typeof data[0][key] === 'number'
    );

    return (
      <div className="space-y-6">
        {availableFields.map((field) => (
          <Card key={field}>
            <CardHeader>
              <CardTitle className="text-base capitalize">
                {field.replace('_', ' ')} ({getUnit(field)})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                    formatter={(value) => [value.toFixed(2), field]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey={field} 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  // Get unit for measurement field
  const getUnit = (field) => {
    const units = {
      voltage: 'kV',
      current: 'A',
      active_power: 'MW',
      reactive_power: 'MVAr',
      power_factor: '',
      frequency: 'Hz',
      temperature: '°C',
      energy_import: 'MWh',
      energy_export: 'MWh',
    };
    return units[field] || '';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-4">
            <span className="text-3xl">{getElementIcon(element.element_type)}</span>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{element.name}</h2>
              <div className="flex items-center space-x-3 mt-1">
                <span className="text-sm text-gray-600 capitalize">
                  {element.element_type}
                </span>
                {getStatusBadge(element.status)}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="secondary"
              onClick={onEdit}
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Element ID</p>
                      <p className="font-medium font-mono text-sm">{element.id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Type</p>
                      <p className="font-medium capitalize">{element.element_type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <div className="mt-1">{getStatusBadge(element.status)}</div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Created</p>
                      <p className="font-medium">{formatDate(element.created_at)}</p>
                    </div>
                    {element.description && (
                      <div className="col-span-2">
                        <p className="text-sm text-gray-600">Description</p>
                        <p className="font-medium">{element.description}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Location */}
              {(element.latitude || element.longitude || element.address) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Location
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {element.latitude && element.longitude && (
                        <>
                          <div>
                            <p className="text-sm text-gray-600">Coordinates</p>
                            <p className="font-medium">
                              {parseFloat(element.latitude || "0").toFixed(6)}, {parseFloat(element.longitude || "0").toFixed(6)}
                            </p>
                          </div>
                          <div className="flex items-center">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => router.push(`/map?highlight=${element.id}`)}
                              className="flex items-center gap-2"
                            >
                              <MapPin className="h-4 w-4" />
                              View on Map
                            </Button>
                          </div>
                        </>
                      )}
                      {element.address && (
                        <div className="col-span-2">
                          <p className="text-sm text-gray-600">Address</p>
                          <p className="font-medium">{element.address}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Equipment Details */}
              {(element.manufacturer || element.model || element.commissioning_date) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Equipment Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {element.manufacturer && (
                        <div>
                          <p className="text-sm text-gray-600">Manufacturer</p>
                          <p className="font-medium">{element.manufacturer}</p>
                        </div>
                      )}
                      {element.model && (
                        <div>
                          <p className="text-sm text-gray-600">Model</p>
                          <p className="font-medium">{element.model}</p>
                        </div>
                      )}
                      {element.commissioning_date && (
                        <div>
                          <p className="text-sm text-gray-600">Commissioning Date</p>
                          <p className="font-medium">{formatDate(element.commissioning_date)}</p>
                        </div>
                      )}
                      {element.installation_date && (
                        <div>
                          <p className="text-sm text-gray-600">Installation Date</p>
                          <p className="font-medium">{formatDate(element.installation_date)}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'properties' && (
            <Card>
              <CardHeader>
                <CardTitle>Technical Properties</CardTitle>
              </CardHeader>
              <CardContent>
                {renderProperties()}
              </CardContent>
            </Card>
          )}

          {activeTab === 'measurements' && renderMeasurements()}

          {activeTab === 'connections' && (
            <Card>
              <CardHeader>
                <CardTitle>Network Connections</CardTitle>
              </CardHeader>
              <CardContent>
                {renderConnections()}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
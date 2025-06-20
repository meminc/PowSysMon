// src/components/map/map-measurements-overlay.js
'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MapMeasurementsOverlay({ 
  elements, 
  measurements, 
  className 
}) {
  const [overlayElements, setOverlayElements] = useState([]);

  useEffect(() => {
    // Filter elements that have both location and measurements
    const elementsWithData = elements.filter(element => 
      element.latitude && 
      element.longitude && 
      measurements[element.id]
    );

    setOverlayElements(elementsWithData);
  }, [elements, measurements]);

  const getMeasurementColor = (element, data) => {
    // Check for alarm conditions
    if (element.element_type === 'generator' && data.active_power) {
      const props = element.properties || {};
      const capacity = props.rated_capacity || 1;
      const utilization = data.active_power / capacity;
      
      if (utilization > 0.95) return 'border-red-500 bg-red-100 text-red-900';
      if (utilization > 0.8) return 'border-yellow-500 bg-yellow-100 text-yellow-900';
      return 'border-green-500 bg-green-100 text-green-900';
    }

    if (element.element_type === 'load' && data.active_power) {
      const props = element.properties || {};
      const rated = props.rated_power || 1;
      const load = data.active_power / rated;
      
      if (load > 1.1) return 'border-red-500 bg-red-100 text-red-900';
      if (load > 0.9) return 'border-yellow-500 bg-yellow-100 text-yellow-900';
      return 'border-blue-500 bg-blue-100 text-blue-900';
    }

    if (data.voltage) {
      // Voltage monitoring (assuming 1.0 pu nominal)
      const voltage_pu = data.voltage / (element.properties?.voltage_level || data.voltage);
      
      if (voltage_pu < 0.95 || voltage_pu > 1.05) {
        return 'border-red-500 bg-red-100 text-red-900';
      }
      if (voltage_pu < 0.97 || voltage_pu > 1.03) {
        return 'border-yellow-500 bg-yellow-100 text-yellow-900';
      }
    }

    return 'border-gray-400 bg-white text-gray-900';
  };

  const formatValue = (value, unit = '') => {
    if (typeof value !== 'number') return 'N/A';
    
    if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(1)}k${unit}`;
    }
    
    return `${value.toFixed(1)}${unit}`;
  };

  const getDisplayData = (element, data) => {
    switch (element.element_type) {
      case 'generator':
        return {
          primary: data.active_power ? `${formatValue(data.active_power, 'MW')}` : null,
          secondary: data.voltage ? `${formatValue(data.voltage, 'kV')}` : null,
          icon: '⚡'
        };
      
      case 'load':
        return {
          primary: data.active_power ? `${formatValue(data.active_power, 'MW')}` : null,
          secondary: data.voltage ? `${formatValue(data.voltage, 'kV')}` : null,
          icon: '🏭'
        };
      
      case 'transformer':
        return {
          primary: data.current ? `${formatValue(data.current, 'A')}` : null,
          secondary: data.temperature ? `${formatValue(data.temperature, '°C')}` : null,
          icon: '⚙️'
        };
      
      case 'bus':
        return {
          primary: data.voltage ? `${formatValue(data.voltage, 'kV')}` : null,
          secondary: data.frequency ? `${formatValue(data.frequency, 'Hz')}` : null,
          icon: '🔌'
        };
      
      default:
        return {
          primary: data.voltage ? `${formatValue(data.voltage, 'kV')}` : null,
          secondary: data.active_power ? `${formatValue(data.active_power, 'MW')}` : null,
          icon: '📍'
        };
    }
  };

  const hasAlarmCondition = (element, data) => {
    const colorClass = getMeasurementColor(element, data);
    return colorClass.includes('red') || colorClass.includes('yellow');
  };

  return (
    <div className={cn("absolute inset-0 pointer-events-none", className)}>
      {overlayElements.map(element => {
        const data = measurements[element.id];
        const displayData = getDisplayData(element, data);
        const colorClass = getMeasurementColor(element, data);
        const hasAlarm = hasAlarmCondition(element, data);

        // Convert lat/lng to screen coordinates (this is a simplified approach)
        // In a real implementation, you'd use the map's projection methods
        const style = {
          position: 'absolute',
          left: `${((element.longitude + 180) / 360) * 100}%`,
          top: `${((90 - element.latitude) / 180) * 100}%`,
          transform: 'translate(-50%, -100%)',
          zIndex: hasAlarm ? 20 : 10
        };

        return (
          <div
            key={element.id}
            style={style}
            className={cn(
              "pointer-events-auto transform transition-all duration-300",
              "hover:scale-110 hover:z-30"
            )}
          >
            <div className={cn(
              "relative px-2 py-1 rounded-lg border-2 shadow-lg text-xs font-medium",
              "backdrop-blur-sm bg-opacity-90",
              colorClass,
              hasAlarm && "animate-pulse"
            )}>
              {/* Alarm indicator */}
              {hasAlarm && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-2 h-2 text-white" />
                </div>
              )}

              {/* Main content */}
              <div className="flex items-center space-x-1">
                <span className="text-xs">{displayData.icon}</span>
                <div className="flex flex-col leading-none">
                  {displayData.primary && (
                    <div className="font-bold">{displayData.primary}</div>
                  )}
                  {displayData.secondary && (
                    <div className="text-xs opacity-75">{displayData.secondary}</div>
                  )}
                </div>
              </div>

              {/* Real-time indicator */}
              <div className="absolute -bottom-1 -right-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-ping" />
                <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full" />
              </div>

              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                  <div className="font-medium">{element.name}</div>
                  <div className="space-y-0.5">
                    {data.voltage && (
                      <div>Voltage: {data.voltage.toFixed(2)} kV</div>
                    )}
                    {data.current && (
                      <div>Current: {data.current.toFixed(1)} A</div>
                    )}
                    {data.active_power && (
                      <div>Power: {data.active_power.toFixed(2)} MW</div>
                    )}
                    {data.frequency && (
                      <div>Frequency: {data.frequency.toFixed(2)} Hz</div>
                    )}
                    {data.temperature && (
                      <div>Temperature: {data.temperature.toFixed(1)} °C</div>
                    )}
                  </div>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white bg-opacity-90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Real-time Data
        </h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded border-2 border-green-500 bg-green-100" />
            <span>Normal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded border-2 border-yellow-500 bg-yellow-100" />
            <span>Warning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded border-2 border-red-500 bg-red-100" />
            <span>Alarm</span>
          </div>
          <div className="flex items-center gap-2 mt-2 pt-1 border-t">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Live Data</span>
          </div>
        </div>
      </div>
    </div>
  );
}
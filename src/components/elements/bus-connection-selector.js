// src/components/elements/bus-connection-selector.js
'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, Search, MapPin, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BusConnectionSelector({
  label,
  buses = [],
  value,
  onChange,
  error,
  voltageLevel,
  excludeBusId,
  placeholder = "Select a bus..."
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter and sort buses
  const filteredBuses = useMemo(() => {
    let filtered = buses.filter(bus => {
      // Exclude specified bus (for preventing same bus selection)
      if (excludeBusId && bus.id === excludeBusId) return false;
      
      // Search filter
      if (searchQuery) {
        return bus.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
               bus.id.toLowerCase().includes(searchQuery.toLowerCase());
      }
      
      return true;
    });

    // Sort by voltage compatibility, then by name
    return filtered.sort((a, b) => {
      const aVoltage = a.properties?.voltage_level;
      const bVoltage = b.properties?.voltage_level;
      const targetVoltage = parseFloat(voltageLevel);
      
      if (voltageLevel && aVoltage && bVoltage) {
        const aMatch = aVoltage === targetVoltage;
        const bMatch = bVoltage === targetVoltage;
        
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
      }
      
      return a.name.localeCompare(b.name);
    });
  }, [buses, searchQuery, excludeBusId, voltageLevel]);

  const selectedBus = buses.find(bus => bus.id === value);

  const getVoltageCompatibility = (bus) => {
    if (!voltageLevel || !bus.properties?.voltage_level) return 'unknown';
    
    const busVoltage = bus.properties.voltage_level;
    const targetVoltage = parseFloat(voltageLevel);
    
    if (busVoltage === targetVoltage) return 'compatible';
    return 'incompatible';
  };

  const getStatusIcon = (bus) => {
    switch (bus.status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'maintenance':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'fault':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-400" />;
    }
  };

  const getCompatibilityClass = (bus) => {
    const compatibility = getVoltageCompatibility(bus);
    
    switch (compatibility) {
      case 'compatible':
        return 'border-green-200 bg-green-50 hover:bg-green-100';
      case 'incompatible':
        return 'border-red-200 bg-red-50 hover:bg-red-100 opacity-75';
      default:
        return 'border-gray-200 bg-white hover:bg-gray-50';
    }
  };

  const handleSelect = (bus) => {
    onChange(bus.id);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      
      {/* Selected Value Display */}
      <div
        className={cn(
          "w-full px-3 py-2 border rounded-md cursor-pointer transition-colors",
          "flex items-center justify-between",
          error ? "border-red-500" : "border-gray-300 hover:border-gray-400",
          isOpen && "border-blue-500 ring-1 ring-blue-500"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-2 flex-1">
          {selectedBus ? (
            <>
              {getStatusIcon(selectedBus)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {selectedBus.name}
                </p>
                <p className="text-xs text-gray-500">
                  {selectedBus.properties?.voltage_level 
                    ? `${selectedBus.properties.voltage_level} kV` 
                    : 'Unknown voltage'
                  }
                  {selectedBus.properties?.bus_type && 
                    ` • ${selectedBus.properties.bus_type.toUpperCase()}`
                  }
                </p>
              </div>
              {voltageLevel && (
                <div className={cn(
                  "px-2 py-1 rounded text-xs font-medium",
                  getVoltageCompatibility(selectedBus) === 'compatible'
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                )}>
                  {getVoltageCompatibility(selectedBus) === 'compatible' ? '✓' : '⚠'}
                </div>
              )}
            </>
          ) : (
            <span className="text-gray-500 text-sm">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={cn(
          "h-4 w-4 text-gray-400 transition-transform",
          isOpen && "rotate-180"
        )} />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg">
          {/* Search */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search buses..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-60 overflow-y-auto">
            {filteredBuses.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 text-center">
                {searchQuery ? 'No buses match your search' : 'No buses available'}
              </div>
            ) : (
              <div className="py-1">
                {voltageLevel && (
                  <div className="px-3 py-2 bg-blue-50 border-b">
                    <p className="text-xs text-blue-700 font-medium">
                      Target voltage: {voltageLevel} kV
                    </p>
                  </div>
                )}
                
                {filteredBuses.map((bus) => {
                  const compatibility = getVoltageCompatibility(bus);
                  const isSelected = bus.id === value;
                  
                  return (
                    <div
                      key={bus.id}
                      className={cn(
                        "px-3 py-2 cursor-pointer transition-colors border-l-4",
                        getCompatibilityClass(bus),
                        isSelected && "bg-blue-100 border-l-blue-500",
                        compatibility === 'incompatible' && "cursor-not-allowed"
                      )}
                      onClick={() => {
                        if (compatibility !== 'incompatible') {
                          handleSelect(bus);
                        }
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(bus)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={cn(
                              "text-sm font-medium truncate",
                              compatibility === 'incompatible' ? "text-gray-400" : "text-gray-900"
                            )}>
                              {bus.name}
                            </p>
                            {compatibility === 'compatible' && (
                              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                            )}
                            {compatibility === 'incompatible' && (
                              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-4 mt-1">
                            <span className={cn(
                              "text-xs",
                              compatibility === 'incompatible' ? "text-gray-400" : "text-gray-500"
                            )}>
                              {bus.properties?.voltage_level 
                                ? `${bus.properties.voltage_level} kV` 
                                : 'Unknown voltage'
                              }
                            </span>
                            
                            {bus.properties?.bus_type && (
                              <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full font-medium",
                                compatibility === 'incompatible' 
                                  ? "bg-gray-100 text-gray-400"
                                  : "bg-gray-100 text-gray-600"
                              )}>
                                {bus.properties.bus_type.toUpperCase()}
                              </span>
                            )}
                          </div>
                          
                          {bus.description && (
                            <p className={cn(
                              "text-xs mt-1 truncate",
                              compatibility === 'incompatible' ? "text-gray-400" : "text-gray-500"
                            )}>
                              {bus.description}
                            </p>
                          )}
                          
                          {compatibility === 'incompatible' && voltageLevel && (
                            <p className="text-xs text-red-600 mt-1">
                              Voltage mismatch: Expected {voltageLevel} kV, got {bus.properties?.voltage_level} kV
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Info */}
          {voltageLevel && (
            <div className="p-3 border-t bg-gray-50">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 border-2 border-green-500 bg-green-100 rounded" />
                    <span>Compatible</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 border-2 border-red-500 bg-red-100 rounded" />
                    <span>Incompatible</span>
                  </div>
                </div>
                <span>{filteredBuses.filter(b => getVoltageCompatibility(b) === 'compatible').length} compatible</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsOpen(false);
            setSearchQuery('');
          }}
        />
      )}
    </div>
  );
}
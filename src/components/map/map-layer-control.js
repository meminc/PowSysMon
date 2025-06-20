// src/components/map/map-layer-control.js
'use client';

import { useState } from 'react';
import { Layers, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function MapLayerControl({ layerVisibility, onLayerToggle }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const layers = [
    {
      id: 'buses',
      name: 'Buses',
      icon: '🔌',
      color: 'text-blue-600',
      description: 'Distribution and transmission buses'
    },
    {
      id: 'generators',
      name: 'Generators',
      icon: '⚡',
      color: 'text-green-600',
      description: 'Power generation facilities'
    },
    {
      id: 'loads',
      name: 'Loads',
      icon: '🏭',
      color: 'text-orange-600',
      description: 'Electrical loads and consumers'
    },
    {
      id: 'transformers',
      name: 'Transformers',
      icon: '⚙️',
      color: 'text-purple-600',
      description: 'Power transformers'
    },
    {
      id: 'lines',
      name: 'Transmission Lines',
      icon: '📏',
      color: 'text-red-600',
      description: 'Power transmission lines'
    },
    {
      id: 'measurements',
      name: 'Real-time Data',
      icon: '📊',
      color: 'text-cyan-600',
      description: 'Live measurement overlays'
    },
    {
      id: 'alarms',
      name: 'Alarms',
      icon: '🚨',
      color: 'text-red-500',
      description: 'Active alarms and alerts'
    },
    {
      id: 'labels',
      name: 'Element Labels',
      icon: '🏷️',
      color: 'text-gray-600',
      description: 'Show element names'
    }
  ];

  const visibleCount = layers.filter(layer => layerVisibility[layer.id]).length;

  return (
    <Card className="w-64">
      <CardHeader 
        className="pb-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Map Layers
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{visibleCount}/{layers.length}</span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </CardTitle>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-2">
            {layers.map(layer => (
              <div
                key={layer.id}
                className={cn(
                  "flex items-center justify-between p-2 rounded-lg border transition-colors cursor-pointer",
                  layerVisibility[layer.id] 
                    ? "bg-blue-50 border-blue-200" 
                    : "bg-gray-50 border-gray-200 opacity-60"
                )}
                onClick={() => onLayerToggle(layer.id, !layerVisibility[layer.id])}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{layer.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{layer.name}</span>
                      {layerVisibility[layer.id] ? (
                        <Eye className="h-3 w-3 text-green-600" />
                      ) : (
                        <EyeOff className="h-3 w-3 text-gray-400" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{layer.description}</p>
                  </div>
                </div>
                
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={layerVisibility[layer.id] || false}
                    onChange={(e) => onLayerToggle(layer.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className={cn(
                    "w-9 h-5 rounded-full transition-colors",
                    layerVisibility[layer.id] ? "bg-blue-600" : "bg-gray-200"
                  )}>
                    <div className={cn(
                      "w-4 h-4 rounded-full bg-white shadow-md transform transition-transform",
                      layerVisibility[layer.id] ? "translate-x-4" : "translate-x-0.5",
                      "mt-0.5"
                    )} />
                  </div>
                </label>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="mt-4 pt-3 border-t space-y-2">
            <button
              onClick={() => {
                layers.forEach(layer => onLayerToggle(layer.id, true));
              }}
              className="w-full text-left text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Show All Layers
            </button>
            <button
              onClick={() => {
                layers.forEach(layer => onLayerToggle(layer.id, false));
              }}
              className="w-full text-left text-sm text-gray-600 hover:text-gray-700 font-medium"
            >
              Hide All Layers
            </button>
            <button
              onClick={() => {
                // Show only essential layers
                const essentialLayers = ['buses', 'generators', 'loads', 'lines'];
                layers.forEach(layer => 
                  onLayerToggle(layer.id, essentialLayers.includes(layer.id))
                );
              }}
              className="w-full text-left text-sm text-gray-600 hover:text-gray-700 font-medium"
            >
              Essential Only
            </button>
          </div>

          {/* Layer Statistics */}
          <div className="mt-4 pt-3 border-t">
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>Visible Layers:</span>
                <span className="font-medium">{visibleCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Layers:</span>
                <span className="font-medium">{layers.length}</span>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
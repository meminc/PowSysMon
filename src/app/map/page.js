// src/app/(dashboard)/map/page.js
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { 
  Layers, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Settings,
  Filter,
  Eye,
  EyeOff,
  MapPin,
  Activity,
  AlertCircle,
  Maximize2,
  Search,
  Navigation
} from 'lucide-react';
import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import Button from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Input from '@/components/ui/form/input';
import LoadingSpinner from '@/components/common/loading-spinner';
import ElementInfoPanel from '@/components/map/element-info-panel';
import MapLayerControl from '@/components/map/map-layer-control';
import MapMeasurementsOverlay from '@/components/map/map-measurements-overlay';
import { useElements } from '@/hooks/api/useElements';
import { useTopology } from '@/hooks/api/useTopology';
import useRealtimeData from '@/hooks/useRealtimeData';
import { cn } from '@/lib/utils';

// Dynamic import for Leaflet map to avoid SSR issues
const NetworkMapComponent = dynamic(
  () => import('@/components/map/network-map-component'),
  { ssr: false, loading: () => <LoadingSpinner text="Loading map..." /> }
);

export default function NetworkMapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mapRef = useRef(null);
  
  // State management
  const [mapCenter, setMapCenter] = useState([40.7128, -74.0060]); // Default to NYC
  const [mapZoom, setMapZoom] = useState(10);
  const [selectedElement, setSelectedElement] = useState(null);
  const [highlightedElement, setHighlightedElement] = useState(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showMeasurements, setShowMeasurements] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapMode, setMapMode] = useState('geographic'); // 'geographic' or 'schematic'
  
  // Layer visibility
  const [layerVisibility, setLayerVisibility] = useState({
    buses: true,
    generators: true,
    loads: true,
    transformers: true,
    lines: true,
    measurements: true,
    alarms: true,
    labels: true
  });

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    voltage_level: '',
    element_type: ''
  });

  // Data fetching
  const { data: elementsData, isLoading: elementsLoading } = useElements({ limit: 1000 });
  const { data: topologyData, isLoading: topologyLoading } = useTopology({ format: 'graph' });
  const { measurements, connectionStatus } = useRealtimeData();

  const elements = elementsData?.data || [];
  const topology = topologyData || { nodes: [], links: [] };

  // Handle URL parameters for highlighting elements
  useEffect(() => {
    const highlight = searchParams.get('highlight');
    if (highlight) {
      setHighlightedElement(highlight);
      // Find element and center map on it
      const element = elements.find(e => e.id === highlight);
      if (element && element.latitude && element.longitude) {
        setMapCenter([element.latitude, element.longitude]);
        setMapZoom(14);
      }
    }
  }, [searchParams, elements]);

  // Filter elements based on search and filters
  const filteredElements = elements.filter(element => {
    // Search filter
    if (searchQuery && !element.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Status filter
    if (filters.status && element.status !== filters.status) {
      return false;
    }
    
    // Element type filter
    if (filters.element_type && element.element_type !== filters.element_type) {
      return false;
    }
    
    // Voltage level filter
    if (filters.voltage_level) {
      const props = element.properties || {};
      const elementVoltage = props.voltage_level || props.primary_voltage || props.secondary_voltage;
      if (!elementVoltage || elementVoltage != filters.voltage_level) {
        return false;
      }
    }
    
    return true;
  });

  // Handle element selection
  const handleElementSelect = (element) => {
    setSelectedElement(element);
    if (element && element.latitude && element.longitude) {
      setMapCenter([element.latitude, element.longitude]);
      setMapZoom(Math.max(mapZoom, 12));
    }
  };

  // Handle map controls
  const handleZoomIn = () => {
    if (mapRef.current) {
      mapRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current) {
      mapRef.current.zoomOut();
    }
  };

  const handleResetView = () => {
    if (elements.length > 0) {
      // Calculate bounds to fit all elements
      const bounds = calculateElementsBounds(elements);
      if (mapRef.current && bounds) {
        mapRef.current.fitBounds(bounds);
      }
    }
  };

  const handleFullscreen = () => {
    setShowSidebar(!showSidebar);
  };

  // Search elements
  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.length > 2) {
      const matchingElement = elements.find(e => 
        e.name.toLowerCase().includes(query.toLowerCase())
      );
      if (matchingElement) {
        handleElementSelect(matchingElement);
      }
    }
  };

  // Calculate bounds for all elements
  const calculateElementsBounds = (elements) => {
    const validElements = elements.filter(e => e.latitude && e.longitude);
    if (validElements.length === 0) return null;

    const latitudes = validElements.map(e => e.latitude);
    const longitudes = validElements.map(e => e.longitude);
    
    return [
      [Math.min(...latitudes), Math.min(...longitudes)],
      [Math.max(...latitudes), Math.max(...longitudes)]
    ];
  };

  if (elementsLoading || topologyLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1">
            <LoadingSpinner fullScreen text="Loading network map..." />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        {showSidebar && <Sidebar />}
        <main className={cn("flex-1 relative", !showSidebar && "ml-0")}>
          {/* Map Controls */}
          <div className="absolute top-4 left-4 z-[1000] space-y-2">
            {/* Search */}
            <Card className="w-80">
              <CardContent className="p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search elements..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Map Mode Toggle */}
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">View:</span>
                  <Button
                    variant={mapMode === 'geographic' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setMapMode('geographic')}
                  >
                    Geographic
                  </Button>
                  <Button
                    variant={mapMode === 'schematic' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setMapMode('schematic')}
                  >
                    Schematic
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardContent className="p-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Elements:</span>
                    <span className="font-medium">{filteredElements.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Active:</span>
                    <span className="font-medium text-green-600">
                      {filteredElements.filter(e => e.status === 'active').length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Alarms:</span>
                    <span className="font-medium text-red-600">
                      {filteredElements.filter(e => e.status === 'fault').length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Connection:</span>
                    <span className={cn(
                      "font-medium",
                      connectionStatus === 'connected' ? 'text-green-600' : 'text-gray-400'
                    )}>
                      {connectionStatus === 'connected' ? 'Live' : 'Offline'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Zoom Controls */}
          <div className="absolute top-4 right-4 z-[1000] space-y-2">
            <div className="flex flex-col space-y-1">
              <Button variant="secondary" size="sm" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="sm" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="sm" onClick={handleResetView}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="sm" onClick={handleFullscreen}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Layer Controls */}
          <div className="absolute bottom-4 left-4 z-[1000]">
            <MapLayerControl
              layerVisibility={layerVisibility}
              onLayerToggle={(layer, visible) => 
                setLayerVisibility(prev => ({ ...prev, [layer]: visible }))
              }
            />
          </div>

          {/* Measurements Toggle */}
          <div className="absolute bottom-4 right-4 z-[1000]">
            <Button
              variant={showMeasurements ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setShowMeasurements(!showMeasurements)}
              className="flex items-center gap-2"
            >
              {showMeasurements ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              Real-time Data
            </Button>
          </div>

          {/* Main Map */}
          <div className="relative w-full h-screen">
            <NetworkMapComponent
              ref={mapRef}
              elements={filteredElements}
              topology={topology}
              measurements={measurements}
              center={mapCenter}
              zoom={mapZoom}
              layerVisibility={layerVisibility}
              selectedElement={selectedElement}
              highlightedElement={highlightedElement}
              mapMode={mapMode}
              showMeasurements={showMeasurements}
              onElementSelect={handleElementSelect}
              onMapMove={(center, zoom) => {
                setMapCenter(center);
                setMapZoom(zoom);
              }}
            />

            {/* Measurements Overlay */}
            {showMeasurements && (
              <MapMeasurementsOverlay
                elements={filteredElements}
                measurements={measurements}
                className="absolute top-0 left-0 w-full h-full pointer-events-none z-[500]"
              />
            )}
          </div>

          {/* Element Info Panel */}
          {selectedElement && (
            <div className="absolute top-4 right-20 z-[1000] w-80">
              <ElementInfoPanel
                element={selectedElement}
                measurements={measurements[selectedElement.id]}
                onClose={() => setSelectedElement(null)}
                onEdit={() => router.push(`/elements/${selectedElement.id}/edit`)}
                onViewDetails={() => router.push(`/elements/${selectedElement.id}`)}
              />
            </div>
          )}

          {/* Network Status Bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-white border-t p-2 z-[999]">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
                  )} />
                  <span>Real-time: {connectionStatus}</span>
                </div>
                <div>Map Center: {mapCenter[0].toFixed(4)}, {mapCenter[1].toFixed(4)}</div>
                <div>Zoom: {mapZoom}</div>
                <div>Elements: {filteredElements.length}</div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/elements')}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Manage Elements
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/topology')}
                  className="flex items-center gap-2"
                >
                  <Activity className="h-4 w-4" />
                  Network Topology
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
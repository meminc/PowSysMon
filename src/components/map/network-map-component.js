// src/components/map/network-map-component.js
'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/images/marker-icon-2x.png',
  iconUrl: '/images/marker-icon.png',
  shadowUrl: '/images/marker-shadow.png',
});

const NetworkMapComponent = forwardRef(({
  elements = [],
  topology = { nodes: [], links: [] },
  measurements = {},
  center = [40.7128, -74.0060],
  zoom = 10,
  layerVisibility = {},
  selectedElement = null,
  highlightedElement = null,
  mapMode = 'geographic',
  showMeasurements = true,
  onElementSelect,
  onMapMove
}, ref) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({});
  const markersRef = useRef({});
  const linesRef = useRef({});

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Create map instance
    const map = L.map(mapRef.current, {
      center: center,
      zoom: zoom,
      zoomControl: false,
      attributionControl: false
    });

    // Add tile layers
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri'
    });

    const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CARTO'
    });

    // Add default layer
    osmLayer.addTo(map);

    // Store layer references
    layersRef.current = {
      osm: osmLayer,
      satellite: satelliteLayer,
      dark: darkLayer,
      elements: L.layerGroup().addTo(map),
      lines: L.layerGroup().addTo(map),
      measurements: L.layerGroup().addTo(map)
    };

    // Add layer control
    const baseMaps = {
      "OpenStreetMap": osmLayer,
      "Satellite": satelliteLayer,
      "Dark": darkLayer
    };

    L.control.layers(baseMaps, {}, { position: 'topright' }).addTo(map);

    // Map event listeners
    map.on('moveend', () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      onMapMove?.([center.lat, center.lng], zoom);
    });

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map center and zoom
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(center, zoom);
    }
  }, [center, zoom]);

  // Update elements on map
  useEffect(() => {
    if (!mapInstanceRef.current || !layersRef.current.elements) return;

    // Clear existing markers
    layersRef.current.elements.clearLayers();
    markersRef.current = {};

    // Add element markers
    elements.forEach(element => {
      if (!element.latitude || !element.longitude) return;

      const marker = createElementMarker(element);
      if (marker) {
        marker.addTo(layersRef.current.elements);
        markersRef.current[element.id] = marker;
      }
    });
  }, [elements, layerVisibility]);

  // Update transmission lines
  useEffect(() => {
    if (!mapInstanceRef.current || !layersRef.current.lines) return;

    // Clear existing lines
    layersRef.current.lines.clearLayers();
    linesRef.current = {};

    // Add transmission lines
    elements.filter(e => e.element_type === 'line').forEach(line => {
      const lineLayer = createTransmissionLine(line);
      if (lineLayer) {
        lineLayer.addTo(layersRef.current.lines);
        linesRef.current[line.id] = lineLayer;
      }
    });
  }, [elements, layerVisibility]);

  // Update measurements overlay
  useEffect(() => {
    if (!mapInstanceRef.current || !layersRef.current.measurements || !showMeasurements) return;

    // Clear existing measurements
    layersRef.current.measurements.clearLayers();

    // Add measurement overlays
    Object.entries(measurements).forEach(([elementId, data]) => {
      const element = elements.find(e => e.id === elementId);
      if (element && element.latitude && element.longitude) {
        const measurementMarker = createMeasurementOverlay(element, data);
        if (measurementMarker) {
          measurementMarker.addTo(layersRef.current.measurements);
        }
      }
    });
  }, [measurements, showMeasurements, elements]);

  // Handle element selection
  useEffect(() => {
    // Reset all markers to default state
    Object.values(markersRef.current).forEach(marker => {
      marker.setStyle?.(getElementStyle(marker.element, false, false));
    });

    // Highlight selected element
    if (selectedElement && markersRef.current[selectedElement.id]) {
      const marker = markersRef.current[selectedElement.id];
      marker.setStyle?.(getElementStyle(selectedElement, true, false));
    }

    // Highlight highlighted element
    if (highlightedElement && markersRef.current[highlightedElement]) {
      const marker = markersRef.current[highlightedElement];
      marker.setStyle?.(getElementStyle(marker.element, false, true));
    }
  }, [selectedElement, highlightedElement]);

  // Create element marker
  const createElementMarker = (element) => {
    if (!layerVisibility[element.element_type + 's']) return null;

    const icon = getElementIcon(element);
    const marker = L.marker([element.latitude, element.longitude], { icon });

    // Store element reference
    marker.element = element;

    // Create popup content
    const popupContent = createPopupContent(element);
    marker.bindPopup(popupContent);

    // Click handler
    marker.on('click', () => {
      onElementSelect?.(element);
    });

    return marker;
  };

  // Create transmission line
  const createTransmissionLine = (line) => {
    if (!layerVisibility.lines || !line.properties?.coordinates) return null;

    const coordinates = line.properties.coordinates;
    if (coordinates.length < 2) return null;

    // Create line path
    const latLngs = coordinates
      .sort((a, b) => a.sequence_order - b.sequence_order)
      .map(coord => [coord.latitude, coord.longitude]);

    const polyline = L.polyline(latLngs, {
      color: getLineColor(line),
      weight: getLineWeight(line),
      opacity: 0.8,
      dashArray: line.status === 'maintenance' ? '10, 10' : null
    });

    // Store line reference
    polyline.element = line;

    // Add popup
    const popupContent = createLinePopupContent(line);
    polyline.bindPopup(popupContent);

    // Click handler
    polyline.on('click', () => {
      onElementSelect?.(line);
    });

    // Add coordinate markers for line points
    coordinates.forEach((coord, index) => {
      if (coord.point_type === 'tower' || coord.point_type === 'junction') {
        const pointMarker = L.circleMarker([coord.latitude, coord.longitude], {
          radius: 4,
          fillColor: coord.point_type === 'tower' ? '#8b5cf6' : '#3b82f6',
          color: 'white',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
        });

        pointMarker.bindTooltip(`${coord.point_type}: ${coord.description || `Point ${index + 1}`}`);
        pointMarker.addTo(layersRef.current.lines);
      }
    });

    return polyline;
  };

  // Create measurement overlay
  const createMeasurementOverlay = (element, data) => {
    if (!data || !layerVisibility.measurements) return null;

    const divIcon = L.divIcon({
      className: 'measurement-overlay',
      html: `
        <div class="bg-black bg-opacity-75 text-white text-xs p-1 rounded">
          ${data.voltage ? `${data.voltage.toFixed(1)}kV<br>` : ''}
          ${data.active_power ? `${data.active_power.toFixed(1)}MW` : ''}
        </div>
      `,
      iconSize: [60, 30],
      iconAnchor: [30, 35]
    });

    return L.marker([element.latitude, element.longitude], { icon: divIcon });
  };

  // Get element icon
  const getElementIcon = (element) => {
    const iconConfig = getElementIconConfig(element);
    
    return L.divIcon({
      className: 'element-marker',
      html: `
        <div class="flex items-center justify-center w-8 h-8 rounded-full border-2 ${iconConfig.bgClass} ${iconConfig.borderClass}">
          <span class="text-lg">${iconConfig.emoji}</span>
        </div>
        ${layerVisibility.labels ? `
          <div class="text-xs font-medium mt-1 text-center whitespace-nowrap ${iconConfig.textClass}">
            ${element.name}
          </div>
        ` : ''}
      `,
      iconSize: [40, layerVisibility.labels ? 60 : 40],
      iconAnchor: [20, layerVisibility.labels ? 60 : 20]
    });
  };

  // Get element icon configuration
  const getElementIconConfig = (element) => {
    const configs = {
      bus: {
        emoji: '🔌',
        bgClass: 'bg-blue-100',
        borderClass: 'border-blue-500',
        textClass: 'text-blue-700'
      },
      generator: {
        emoji: '⚡',
        bgClass: 'bg-green-100',
        borderClass: 'border-green-500',
        textClass: 'text-green-700'
      },
      load: {
        emoji: '🏭',
        bgClass: 'bg-orange-100',
        borderClass: 'border-orange-500',
        textClass: 'text-orange-700'
      },
      transformer: {
        emoji: '⚙️',
        bgClass: 'bg-purple-100',
        borderClass: 'border-purple-500',
        textClass: 'text-purple-700'
      }
    };

    const config = configs[element.element_type] || configs.bus;

    // Modify based on status
    if (element.status === 'fault') {
      config.borderClass = 'border-red-500 animate-pulse';
      config.bgClass = 'bg-red-100';
    } else if (element.status === 'maintenance') {
      config.borderClass = 'border-yellow-500';
      config.bgClass = 'bg-yellow-100';
    }

    return config;
  };

  // Get element style
  const getElementStyle = (element, selected, highlighted) => {
    let style = {
      radius: 8,
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    };

    if (selected) {
      style.radius = 12;
      style.weight = 4;
      style.color = '#2563eb';
    } else if (highlighted) {
      style.radius = 10;
      style.weight = 3;
      style.color = '#7c3aed';
    }

    return style;
  };

  // Get line color based on voltage level
  const getLineColor = (line) => {
    const voltage = line.properties?.voltage_level || 0;
    
    if (voltage >= 500) return '#dc2626'; // Red for extra high voltage
    if (voltage >= 230) return '#ea580c'; // Orange for high voltage
    if (voltage >= 69) return '#d97706';  // Amber for medium voltage
    if (voltage >= 12) return '#65a30d'; // Green for low voltage
    return '#6b7280'; // Gray for unknown
  };

  // Get line weight based on voltage level
  const getLineWeight = (line) => {
    const voltage = line.properties?.voltage_level || 0;
    
    if (voltage >= 500) return 6;
    if (voltage >= 230) return 5;
    if (voltage >= 69) return 4;
    if (voltage >= 12) return 3;
    return 2;
  };

  // Create popup content
  const createPopupContent = (element) => {
    const props = element.properties || {};
    
    return `
      <div class="p-2 min-w-48">
        <div class="flex items-center space-x-2 mb-2">
          <span class="text-lg">${getElementIconConfig(element).emoji}</span>
          <div>
            <h3 class="font-medium">${element.name}</h3>
            <p class="text-sm text-gray-600 capitalize">${element.element_type}</p>
          </div>
        </div>
        
        <div class="space-y-1 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-600">Status:</span>
            <span class="font-medium capitalize ${element.status === 'active' ? 'text-green-600' : 
              element.status === 'fault' ? 'text-red-600' : 'text-yellow-600'}">${element.status}</span>
          </div>
          
          ${props.voltage_level ? `
            <div class="flex justify-between">
              <span class="text-gray-600">Voltage:</span>
              <span class="font-medium">${props.voltage_level} kV</span>
            </div>
          ` : ''}
          
          ${props.rated_power ? `
            <div class="flex justify-between">
              <span class="text-gray-600">Power:</span>
              <span class="font-medium">${props.rated_power} MW</span>
            </div>
          ` : ''}
          
          ${props.rated_capacity ? `
            <div class="flex justify-between">
              <span class="text-gray-600">Capacity:</span>
              <span class="font-medium">${props.rated_capacity} MW</span>
            </div>
          ` : ''}
        </div>
        
        <div class="mt-3 pt-2 border-t">
          <button class="text-blue-600 hover:text-blue-700 text-sm font-medium" 
                  onclick="window.selectElement('${element.id}')">
            View Details →
          </button>
        </div>
      </div>
    `;
  };

  // Create line popup content
  const createLinePopupContent = (line) => {
    const props = line.properties || {};
    const coords = props.coordinates || [];
    
    return `
      <div class="p-2 min-w-48">
        <div class="flex items-center space-x-2 mb-2">
          <span class="text-lg">📏</span>
          <div>
            <h3 class="font-medium">${line.name}</h3>
            <p class="text-sm text-gray-600">Transmission Line</p>
          </div>
        </div>
        
        <div class="space-y-1 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-600">Length:</span>
            <span class="font-medium">${props.length?.toFixed(2) || 'Unknown'} km</span>
          </div>
          
          <div class="flex justify-between">
            <span class="text-gray-600">Voltage:</span>
            <span class="font-medium">${props.voltage_level || 'Unknown'} kV</span>
          </div>
          
          <div class="flex justify-between">
            <span class="text-gray-600">Points:</span>
            <span class="font-medium">${coords.length} coordinates</span>
          </div>
          
          ${props.conductor_type ? `
            <div class="flex justify-between">
              <span class="text-gray-600">Conductor:</span>
              <span class="font-medium">${props.conductor_type}</span>
            </div>
          ` : ''}
        </div>
        
        <div class="mt-3 pt-2 border-t">
          <button class="text-blue-600 hover:text-blue-700 text-sm font-medium" 
                  onclick="window.selectElement('${line.id}')">
            View Details →
          </button>
        </div>
      </div>
    `;
  };

  // Expose map methods via ref
  useImperativeHandle(ref, () => ({
    getMap: () => mapInstanceRef.current,
    zoomIn: () => mapInstanceRef.current?.zoomIn(),
    zoomOut: () => mapInstanceRef.current?.zoomOut(),
    fitBounds: (bounds) => mapInstanceRef.current?.fitBounds(bounds),
    panTo: (latlng) => mapInstanceRef.current?.panTo(latlng),
    setView: (latlng, zoom) => mapInstanceRef.current?.setView(latlng, zoom)
  }));

  // Global function for popup button clicks
  useEffect(() => {
    window.selectElement = (elementId) => {
      const element = elements.find(e => e.id === elementId);
      if (element) {
        onElementSelect?.(element);
      }
    };

    return () => {
      delete window.selectElement;
    };
  }, [elements, onElementSelect]);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-full"
      style={{ minHeight: '400px' }}
    />
  );
});

NetworkMapComponent.displayName = 'NetworkMapComponent';

export default NetworkMapComponent;
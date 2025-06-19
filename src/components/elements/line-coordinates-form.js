// src/components/elements/line-coordinates-form.js
'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, MapPin, Move, Navigation } from 'lucide-react';
import Button from '@/components/ui/button';
import Input from '@/components/ui/form/input';
import { cn } from '@/lib/utils';

export default function LineCoordinatesForm({ register, errors, watch, setValue }) {
  const [coordinates, setCoordinates] = useState([
    { latitude: '', longitude: '', elevation: '', point_type: 'start', description: 'Starting point' },
    { latitude: '', longitude: '', elevation: '', point_type: 'end', description: 'Ending point' }
  ]);

  const [draggedIndex, setDraggedIndex] = useState(null);
  const [showMap, setShowMap] = useState(false);

  // Watch for form data changes
  const watchedCoordinates = watch('line_properties.coordinates');

  useEffect(() => {
    if (watchedCoordinates && Array.isArray(watchedCoordinates) && JSON.stringify(watchedCoordinates) !== JSON.stringify(coordinates)) {
      setCoordinates(watchedCoordinates);watchedCoordinates 
    }
  }, [watchedCoordinates]);

  // Update form data when coordinates change
  useEffect(() => {
    setValue('line_properties.coordinates', coordinates);
    // Calculate and update total length
    const totalLength = calculateTotalLength(coordinates);
    setValue('line_properties.length', totalLength.toFixed(2));
  }, [coordinates, setValue]);

  const addCoordinate = () => {
    const newCoordinates = [...coordinates];
    // Insert before the last point (which should be 'end')
    newCoordinates.splice(-1, 0, {
      latitude: '',
      longitude: '',
      elevation: '',
      point_type: 'intermediate',
      description: `Point ${newCoordinates.length}`
    });
    setCoordinates(newCoordinates);
  };

  const removeCoordinate = (index) => {
    if (coordinates.length <= 2) return; // Keep minimum 2 points
    
    const newCoordinates = coordinates.filter((_, i) => i !== index);
    setCoordinates(newCoordinates);
  };

  const updateCoordinate = (index, field, value) => {
    const newCoordinates = [...coordinates];
    newCoordinates[index] = { ...newCoordinates[index], [field]: value };
    setCoordinates(newCoordinates);
  };

  const moveCoordinate = (fromIndex, toIndex) => {
    if (fromIndex === 0 || fromIndex === coordinates.length - 1) return; // Can't move start/end
    if (toIndex === 0 || toIndex === coordinates.length - 1) return; // Can't move to start/end
    
    const newCoordinates = [...coordinates];
    const [movedItem] = newCoordinates.splice(fromIndex, 1);
    newCoordinates.splice(toIndex, 0, movedItem);
    setCoordinates(newCoordinates);
  };

  // Calculate total length using Haversine formula
  const calculateTotalLength = (coords) => {
    let totalLength = 0;
    
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      
      if (prev.latitude && prev.longitude && curr.latitude && curr.longitude) {
        totalLength += haversineDistance(
          parseFloat(prev.latitude), parseFloat(prev.longitude),
          parseFloat(curr.latitude), parseFloat(curr.longitude)
        );
      }
    }
    
    return totalLength;
  };

  const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getPointTypeIcon = (type) => {
    switch (type) {
      case 'start': return '🟢';
      case 'end': return '🔴';
      case 'tower': return '🗼';
      case 'junction': return '🔗';
      default: return '📍';
    }
  };

  const getPointTypeColor = (type) => {
    switch (type) {
      case 'start': return 'border-green-300 bg-green-50';
      case 'end': return 'border-red-300 bg-red-50';
      case 'tower': return 'border-purple-300 bg-purple-50';
      case 'junction': return 'border-blue-300 bg-blue-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900">Line Properties & Coordinates</h4>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setShowMap(!showMap)}
          className="flex items-center gap-2"
        >
          <MapPin className="h-4 w-4" />
          {showMap ? 'Hide Map' : 'Show Map'}
        </Button>
      </div>

      {/* Basic Line Properties */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Voltage Level (kV) *
          </label>
          <Input
            type="number"
            step="0.1"
            {...register('line_properties.voltage_level')}
            error={errors.line_properties?.voltage_level?.message}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Total Length (km)
          </label>
          <Input
            type="number"
            step="0.01"
            {...register('line_properties.length')}
            readOnly
            className="bg-gray-100"
            placeholder="Auto-calculated"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Conductor Type
          </label>
          <Input
            {...register('line_properties.conductor_type')}
            placeholder="e.g., ACSR, AAAC"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rated Current (A)
          </label>
          <Input
            type="number"
            step="0.1"
            {...register('line_properties.rated_current')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Resistance (Ω/km)
          </label>
          <Input
            type="number"
            step="0.001"
            {...register('line_properties.resistance')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reactance (Ω/km)
          </label>
          <Input
            type="number"
            step="0.001"
            {...register('line_properties.reactance')}
          />
        </div>
      </div>

      {/* Coordinates Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="font-medium text-gray-900">Line Coordinates ({coordinates.length} points)</h5>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addCoordinate}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Point
          </Button>
        </div>

        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
          <p className="flex items-center gap-2">
            <Navigation className="h-4 w-4" />
            Define the path of your transmission line by adding coordinate points. 
            The line will follow the path from start to end through all intermediate points.
          </p>
        </div>

        {/* Coordinates List */}
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {coordinates.map((coord, index) => (
            <div
              key={index}
              className={cn(
                'p-4 border-2 rounded-lg transition-all',
                getPointTypeColor(coord.point_type),
                draggedIndex === index && 'opacity-50'
              )}
              draggable={index !== 0 && index !== coordinates.length - 1}
              onDragStart={() => setDraggedIndex(index)}
              onDragEnd={() => setDraggedIndex(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedIndex !== null && draggedIndex !== index) {
                  moveCoordinate(draggedIndex, index);
                }
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getPointTypeIcon(coord.point_type)}</span>
                  <div>
                    <h6 className="font-medium">
                      Point {index + 1} 
                      {coord.point_type === 'start' && ' (Start)'}
                      {coord.point_type === 'end' && ' (End)'}
                    </h6>
                    <p className="text-xs text-gray-600">{coord.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {index !== 0 && index !== coordinates.length - 1 && (
                    <>
                      <Move className="h-4 w-4 text-gray-400 cursor-move" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCoordinate(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Latitude *
                  </label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="40.7128"
                    value={coord.latitude}
                    onChange={(e) => updateCoordinate(index, 'latitude', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Longitude *
                  </label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="-74.0060"
                    value={coord.longitude}
                    onChange={(e) => updateCoordinate(index, 'longitude', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Elevation (m)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Optional"
                    value={coord.elevation}
                    onChange={(e) => updateCoordinate(index, 'elevation', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Point Type
                  </label>
                  <select
                    value={coord.point_type}
                    onChange={(e) => updateCoordinate(index, 'point_type', e.target.value)}
                    disabled={index === 0 || index === coordinates.length - 1}
                    className="w-full h-8 px-2 text-sm border border-gray-300 rounded-md disabled:bg-gray-100"
                  >
                    <option value="start">Start</option>
                    <option value="end">End</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="tower">Tower</option>
                    <option value="junction">Junction</option>
                  </select>
                </div>
              </div>

              {index !== 0 && index !== coordinates.length - 1 && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <Input
                    placeholder="Optional description for this point"
                    value={coord.description}
                    onChange={(e) => updateCoordinate(index, 'description', e.target.value)}
                    className="text-sm"
                  />
                </div>
              )}

              {/* Distance from previous point */}
              {index > 0 && coord.latitude && coord.longitude && 
               coordinates[index - 1].latitude && coordinates[index - 1].longitude && (
                <div className="mt-2 text-xs text-gray-600">
                  Distance from previous point: {
                    haversineDistance(
                      parseFloat(coordinates[index - 1].latitude),
                      parseFloat(coordinates[index - 1].longitude),
                      parseFloat(coord.latitude),
                      parseFloat(coord.longitude)
                    ).toFixed(2)
                  } km
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total Points:</span>
            <span className="font-medium">{coordinates.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Calculated Length:</span>
            <span className="font-medium">{calculateTotalLength(coordinates).toFixed(2)} km</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Line Type:</span>
            <span className="font-medium">
              {coordinates.length === 2 ? 'Straight Line' : `Multi-segment (${coordinates.length - 1} segments)`}
            </span>
          </div>
        </div>
      </div>

      {/* Map placeholder */}
      {showMap && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <MapPin className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600">Interactive map view</p>
          <p className="text-sm text-gray-500 mt-2">
            Click on the map to add/edit coordinate points
          </p>
          {/* Here you would integrate with a mapping library like Leaflet or Google Maps */}
        </div>
      )}
    </div>
  );
}
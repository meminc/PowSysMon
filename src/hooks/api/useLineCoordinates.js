// src/hooks/api/useLineCoordinates.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api/client';
import toast from 'react-hot-toast';

export function useLineCoordinates(lineId) {
  return useQuery({
    queryKey: ['line-coordinates', lineId],
    queryFn: () => api.get(`/elements/lines/${lineId}/coordinates`).then(res => res.data),
    enabled: !!lineId,
  });
}

export function useUpdateLineCoordinates() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ lineId, coordinates }) => 
      api.put(`/elements/lines/${lineId}/coordinates`, { coordinates }).then(res => res.data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['line-coordinates', variables.lineId] });
      queryClient.invalidateQueries({ queryKey: ['elements', variables.lineId] });
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      toast.success('Line coordinates updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update line coordinates');
    },
  });
}

// Helper function to calculate distance between two points
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper function to calculate total line length
export function calculateTotalLength(coordinates) {
  let totalLength = 0;
  
  for (let i = 1; i < coordinates.length; i++) {
    const prev = coordinates[i - 1];
    const curr = coordinates[i];
    
    if (prev.latitude && prev.longitude && curr.latitude && curr.longitude) {
      totalLength += calculateDistance(
        parseFloat(prev.latitude), parseFloat(prev.longitude),
        parseFloat(curr.latitude), parseFloat(curr.longitude)
      );
    }
  }
  
  return totalLength;
}

// Helper function to validate coordinates
export function validateCoordinates(coordinates) {
  const errors = [];
  
  if (!coordinates || coordinates.length < 2) {
    errors.push('At least 2 coordinate points are required');
    return errors;
  }
  
  // Check if first point is marked as start
  if (coordinates[0].point_type !== 'start') {
    errors.push('First point must be marked as "start"');
  }
  
  // Check if last point is marked as end
  if (coordinates[coordinates.length - 1].point_type !== 'end') {
    errors.push('Last point must be marked as "end"');
  }
  
  // Validate each coordinate
  coordinates.forEach((coord, index) => {
    if (!coord.latitude || coord.latitude < -90 || coord.latitude > 90) {
      errors.push(`Point ${index + 1}: Invalid latitude`);
    }
    
    if (!coord.longitude || coord.longitude < -180 || coord.longitude > 180) {
      errors.push(`Point ${index + 1}: Invalid longitude`);
    }
  });
  
  return errors;
}
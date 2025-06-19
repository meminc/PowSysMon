// src/hooks/api/useMeasurements.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api/client';
import toast from 'react-hot-toast';

export function useMeasurements(params) {
  return useQuery({
    queryKey: ['measurements', params],
    queryFn: () => api.get('/measurements', { params }).then(res => res.data),
    enabled: !!params.element_id,
  });
}

export function useSubmitMeasurement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => api.post('/measurements', data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['measurements'] });
      toast.success('Measurement submitted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to submit measurement');
    },
  });
}

export function useSubmitBatchMeasurements() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => api.post('/measurements', data).then(res => res.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['measurements'] });
      toast.success(`${data.data.successful} measurements submitted successfully`);
      if (data.data.failed > 0) {
        toast.error(`${data.data.failed} measurements failed`);
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to submit measurements');
    },
  });
}
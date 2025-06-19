// src/hooks/api/useEvents.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api/client';
import toast from 'react-hot-toast';

export function useEvents(params = {}) {
  return useQuery({
    queryKey: ['events', params],
    queryFn: () => api.get('/events', { params }).then(res => res.data),
    refetchInterval: params.status === 'active' ? 10000 : false, // Refresh active events every 10s
  });
}

export function useEvent(id) {
  return useQuery({
    queryKey: ['events', id],
    queryFn: () => api.get(`/events/${id}`).then(res => res.data.data),
    enabled: !!id,
  });
}

export function useAcknowledgeEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id) => api.put(`/events/${id}`, { action: 'acknowledge' }).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event acknowledged');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to acknowledge event');
    },
  });
}

export function useResolveEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, resolution_notes }) => 
      api.put(`/events/${id}`, { action: 'resolve', resolution_notes }).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event resolved');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to resolve event');
    },
  });
}
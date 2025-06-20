// src/hooks/api/useTopology.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api/client';
import toast from 'react-hot-toast';

export function useTopology(params = {}) {
  return useQuery({
    queryKey: ['topology', params],
    queryFn: () => api.get('/topology', { params }).then(res => res.data.data),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useCreateConnection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => api.post('/topology', data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topology'] });
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      toast.success('Connection created successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create connection');
    },
  });
}

export function useDeleteConnection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id) => api.delete(`/topology/connections/${id}`).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topology'] });
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      toast.success('Connection removed successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to remove connection');
    },
  });
}
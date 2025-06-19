// src/hooks/api/useElements.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api/client';
import toast from 'react-hot-toast';

export function useElements(params = {}) {
  return useQuery({
    queryKey: ['elements', params],
    queryFn: () => api.get('/elements', { params }).then(res => res.data),
  });
}

export function useElement(id) {
  return useQuery({
    queryKey: ['elements', id],
    queryFn: () => api.get(`/elements/${id}`).then(res => res.data),
    enabled: !!id,
  });
}

export function useCreateElement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => api.post('/elements', data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      toast.success('Element created successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create element');
    },
  });
}

export function useUpdateElement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/elements/${id}`, data).then(res => res.data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      queryClient.invalidateQueries({ queryKey: ['elements', variables.id] });
      toast.success('Element updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update element');
    },
  });
}

export function useDeleteElement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id) => api.delete(`/elements/${id}`).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      toast.success('Element deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete element');
    },
  });
}
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

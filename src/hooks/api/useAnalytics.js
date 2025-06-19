// src/hooks/api/useAnalytics.js
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api/client';

export function useSystemSummary() {
  return useQuery({
    queryKey: ['analytics', 'system_summary'],
    queryFn: () => api.get('/analytics?type=system_summary').then(res => res.data.data),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useLoadProfile(period = '24h') {
  return useQuery({
    queryKey: ['analytics', 'load_profile', period],
    queryFn: () => api.get(`/analytics?type=load_profile&period=${period}`).then(res => res.data.data),
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useGenerationMix() {
  return useQuery({
    queryKey: ['analytics', 'generation_mix'],
    queryFn: () => api.get('/analytics?type=generation_mix').then(res => res.data.data),
    refetchInterval: 60000,
  });
}

export function useNetworkLosses(period = '24h') {
  return useQuery({
    queryKey: ['analytics', 'network_losses', period],
    queryFn: () => api.get(`/analytics?type=network_losses&period=${period}`).then(res => res.data.data),
  });
}

export function useReliabilityMetrics(period = '30d') {
  return useQuery({
    queryKey: ['analytics', 'reliability_metrics', period],
    queryFn: () => api.get(`/analytics?type=reliability_metrics&period=${period}`).then(res => res.data.data),
  });
}
// src/hooks/useAuth.js
import { create } from 'zustand';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import api from '@/lib/api/client';

const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { user, tokens } = response.data.data;
      
      set({ 
        user, 
        token: tokens.access, 
        isAuthenticated: true,
        isLoading: false 
      });
      
      // Store token in localStorage and cookie
      localStorage.setItem('token', tokens.access);
      document.cookie = `token=${tokens.access}; path=/; max-age=${7 * 24 * 60 * 60}`; // 7 days
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error?.message || 'Login failed' 
      };
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      set({ user: null, token: null, isAuthenticated: false });
      localStorage.removeItem('token');
      document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    }
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        // Verify token with backend
        const response = await api.get('/auth/me');
        set({ 
          user: response.data.data,
          token, 
          isAuthenticated: true, 
          isLoading: false 
        });
      } catch (error) {
        // Token is invalid
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        localStorage.removeItem('token');
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
      }
    } else {
      set({ isLoading: false });
    }
  },
}));

export default function useAuth() {
  const auth = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    auth.checkAuth();
  }, []);

  const requireAuth = () => {
    if (!auth.isAuthenticated && !auth.isLoading) {
      router.push('/login');
    }
  };

  return { ...auth, requireAuth };
}
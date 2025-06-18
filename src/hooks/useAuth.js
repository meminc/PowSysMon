import { create } from 'zustand';
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
      
      // Store token
      localStorage.setItem('token', tokens.access);
      document.cookie = `token=${tokens.access}; path=/; max-age=${7 * 24 * 60 * 60}`;
      
      set({ 
        user, 
        token: tokens.access, 
        isAuthenticated: true,
        isLoading: false 
      });
      
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
      window.location.href = '/login';
    }
  },

  checkAuth: () => {
    const token = localStorage.getItem('token');
    if (token) {
      set({ token, isAuthenticated: true, isLoading: false });
      // TODO: Optionally verify token with backend
    } else {
      set({ isLoading: false });
    }
  },
}));

export default function useAuth() {
  const store = useAuthStore();

  useEffect(() => {
    store.checkAuth();
  }, []);

  return store;
}
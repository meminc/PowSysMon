// src/app/page.js
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import LoadingSpinner from '@/components/common/loading-spinner';
import useAuth from '@/hooks/useAuth';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Loading..." />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <div>
            <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
            <p className="text-gray-600">Welcome back, {user?.name || 'User'}!</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Total Elements</h3>
                <p className="text-2xl font-bold text-gray-900 mt-2">0</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Active Alarms</h3>
                <p className="text-2xl font-bold text-red-600 mt-2">0</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Total Load</h3>
                <p className="text-2xl font-bold text-gray-900 mt-2">0 MW</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">System Status</h3>
                <p className="text-2xl font-bold text-green-600 mt-2">Normal</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
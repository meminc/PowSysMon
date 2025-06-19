// src/app/page.js
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import LoadingSpinner from '@/components/common/loading-spinner';
import SystemOverview from '@/components/dashboard/system-overview';
import LoadProfileChart from '@/components/dashboard/load-profile-chart';
import GenerationMixChart from '@/components/dashboard/generation-mix-chart';
import RecentEvents from '@/components/dashboard/recent-events';
import NetworkStatus from '@/components/dashboard/network-status';
import useAuth from '@/hooks/useAuth';
import useRealtimeData from '@/hooks/useRealtimeData';
import { useSystemSummary } from '@/hooks/api/useAnalytics';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { data: systemSummary, isLoading: summaryLoading } = useSystemSummary();
  const { measurements, connectionStatus } = useRealtimeData();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading || summaryLoading) {
    return <LoadingSpinner fullScreen text="Loading dashboard..." />;
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
          {/* Dashboard Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600">Welcome back, {user?.name || 'User'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">System Time</p>
                <p className="text-lg font-medium">{currentTime.toLocaleTimeString()}</p>
              </div>
            </div>
          </div>

          {/* System Overview Cards */}
          <SystemOverview data={systemSummary} />

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Load Profile Chart */}
            <LoadProfileChart />

            {/* Generation Mix Chart */}
            <GenerationMixChart />
          </div>

          {/* Bottom Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            {/* Network Status */}
            <div className="lg:col-span-2">
              <NetworkStatus measurements={measurements} connectionStatus={connectionStatus} />
            </div>

            {/* Recent Events */}
            <div>
              <RecentEvents />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
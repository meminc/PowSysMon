// src/app/(dashboard)/elements/[id]/page.js
'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import Button from '@/components/ui/button';
import LoadingSpinner from '@/components/common/loading-spinner';
import ElementDetailModal from '@/components/elements/element-detail-modal';
import { useElement } from '@/hooks/api/useElements';

export default function ElementDetailPage({ params }) {
  const router = useRouter();
  const { id } = params;
  const { data, isLoading, error } = useElement(id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6">
            <LoadingSpinner fullScreen text="Loading element details..." />
          </main>
        </div>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6">
            <div className="text-center py-12">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Element Not Found</h2>
              <p className="text-gray-600 mb-4">The element you're looking for doesn't exist.</p>
              <Button onClick={() => router.push('/elements')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Elements
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="mb-6">
            <Button 
              variant="secondary" 
              onClick={() => router.push('/elements')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Elements
            </Button>
          </div>
          
          <ElementDetailModal
            element={data.data}
            onClose={() => router.push('/elements')}
            onEdit={() => router.push(`/elements/${id}/edit`)}
          />
        </main>
      </div>
    </div>
  );
}
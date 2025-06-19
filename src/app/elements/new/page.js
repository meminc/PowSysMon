// src/app/elements/new/page.js
'use client';

import { useRouter } from 'next/navigation';
import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ElementForm from '@/components/elements/element-form';
import Button from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import useAuth from '@/hooks/useAuth';

export default function NewElementPage() {
  const router = useRouter();
  const { requireAuth } = useAuth();

  requireAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          {/* Page Header */}
          <div className="mb-6">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/elements')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Create New Element</h1>
                <p className="text-gray-600">Add a new element to the grid system</p>
              </div>
            </div>
          </div>

          <div className="max-w-4xl">
            <Card>
              <CardHeader>
                <CardTitle>Element Details</CardTitle>
              </CardHeader>
              <CardContent>
                <ElementForm 
                  onSuccess={(element) => {
                    router.push(`/elements/${element.id}`);
                  }}
                  onCancel={() => router.push('/elements')}
                />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
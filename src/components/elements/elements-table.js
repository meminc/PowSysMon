// src/components/elements/elements-table.js
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Eye, 
  Edit2, 
  Trash2, 
  MoreVertical,
  Zap,
  Factory,
  GitBranch,
  Circle,
  Box
} from 'lucide-react';
import Button from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDate } from 'date-fns';
import { useDeleteElement } from '@/hooks/api/useElements';
import toast from 'react-hot-toast';

export default function ElementsTable({ elements, pagination, onPageChange, isLoading }) {
  const router = useRouter();
  const deleteElement = useDeleteElement();
  const [selectedElement, setSelectedElement] = useState(null);

  const getElementIcon = (type) => {
    const icons = {
      generator: <Zap className="h-5 w-5 text-yellow-600" />,
      load: <Factory className="h-5 w-5 text-blue-600" />,
      transformer: <Box className="h-5 w-5 text-purple-600" />,
      line: <GitBranch className="h-5 w-5 text-green-600" />,
      bus: <Circle className="h-5 w-5 text-gray-600" />
    };
    return icons[type] || <Circle className="h-5 w-5 text-gray-400" />;
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      maintenance: 'bg-yellow-100 text-yellow-800',
      fault: 'bg-red-100 text-red-800'
    };

    return (
      <span className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        styles[status] || styles.inactive
      )}>
        {status}
      </span>
    );
  };

  const handleDelete = async (element) => {
    if (window.confirm(`Are you sure you want to delete ${element.name}?`)) {
      try {
        await deleteElement.mutateAsync(element.id);
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
  };

  const getElementDetails = (element) => {
    const details = [];
    
    if (element.properties) {
      switch (element.element_type) {
        case 'generator':
          if (element.properties.generation_type) {
            details.push(`${element.properties.generation_type} generation`);
          }
          if (element.properties.rated_capacity) {
            details.push(`${element.properties.rated_capacity} MW`);
          }
          break;
        case 'load':
          if (element.properties.load_type) {
            details.push(`${element.properties.load_type} load`);
          }
          if (element.properties.rated_power) {
            details.push(`${element.properties.rated_power} kW`);
          }
          break;
        case 'transformer':
          if (element.properties.primary_voltage && element.properties.secondary_voltage) {
            details.push(`${element.properties.primary_voltage}/${element.properties.secondary_voltage} kV`);
          }
          if (element.properties.rated_power) {
            details.push(`${element.properties.rated_power} MVA`);
          }
          break;
        case 'line':
          if (element.properties.voltage_level) {
            details.push(`${element.properties.voltage_level} kV`);
          }
          if (element.properties.length) {
            details.push(`${element.properties.length} km`);
          }
          break;
        case 'bus':
          if (element.properties.voltage_level) {
            details.push(`${element.properties.voltage_level} kV`);
          }
          if (element.properties.bus_type) {
            details.push(`${element.properties.bus_type} bus`);
          }
          break;
      }
    }
    
    return details.join(' • ');
  };

  if (!isLoading && elements.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
          <Zap className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No elements found</h3>
        <p className="text-gray-500 mb-6">Get started by creating your first element</p>
        <Button onClick={() => router.push('/elements/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Element
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Element
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {elements.map((element) => (
              <tr key={element.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {getElementIcon(element.element_type)}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {element.name}
                      </div>
                      {element.description && (
                        <div className="text-sm text-gray-500">
                          {element.description}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900 capitalize">
                    {element.element_type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-600">
                    {getElementDetails(element)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(element.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(new Date(element.created_at), 'MMM d, yyyy')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/elements/${element.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/elements/${element.id}/edit`)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(element)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="px-6 py-4 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} results
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={!pagination.hasPrev}
              >
                Previous
              </Button>
              {[...Array(Math.min(5, pagination.pages))].map((_, i) => {
                const page = i + 1;
                return (
                  <Button
                    key={page}
                    variant={page === pagination.page ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => onPageChange(page)}
                  >
                    {page}
                  </Button>
                );
              })}
              {pagination.pages > 5 && <span className="px-2">...</span>}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={!pagination.hasNext}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
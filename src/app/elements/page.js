// src/app/(dashboard)/elements/page.js
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Upload,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  MapPin,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react';
import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import Button from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Input from '@/components/ui/form/input';
import LoadingSpinner from '@/components/common/loading-spinner';
import ElementFormModal from '@/components/elements/element-form-modal';
import ElementDetailModal from '@/components/elements/element-detail-modal';
import DeleteConfirmModal from '@/components/common/delete-confirm-modal';
import { useElements } from '@/hooks/api/useElements';
import { useDeleteElement } from '@/hooks/api/useElements';
import { cn, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

const ELEMENT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'bus', label: 'Bus' },
  { value: 'generator', label: 'Generator' },
  { value: 'load', label: 'Load' },
  { value: 'transformer', label: 'Transformer' },
  { value: 'line', label: 'Line' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'fault', label: 'Fault' },
];

export default function ElementsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState({
    search: undefined,
    type: undefined,
    status: undefined,
    page: 1,
    limit: 20
  });
  const [selectedElements, setSelectedElements] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(null);

  const { data, isLoading, error } = useElements(filters);
  const deleteElement = useDeleteElement();

  const elements = data?.data || [];
  const pagination = data?.pagination || {};

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset to first page when filtering
    }));
  };

  // Handle search with debounce
  const handleSearch = (value) => {
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
      handleFilterChange('search', value);
    }, 500);
  };

  // Handle element selection
  const handleSelectElement = (elementId) => {
    setSelectedElements(prev => {
      if (prev.includes(elementId)) {
        return prev.filter(id => id !== elementId);
      } else {
        return [...prev, elementId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedElements.length === elements.length) {
      setSelectedElements([]);
    } else {
      setSelectedElements(elements.map(e => e.id));
    }
  };

  // Handle actions
  const handleView = (element) => {
    setSelectedElement(element);
    setShowDetailModal(true);
    setDropdownOpen(null);
  };

  const handleEdit = (element) => {
    setSelectedElement(element);
    setShowCreateModal(true);
    setDropdownOpen(null);
  };

  const handleDelete = (element) => {
    setSelectedElement(element);
    setShowDeleteModal(true);
    setDropdownOpen(null);
  };

  const confirmDelete = async () => {
    try {
      await deleteElement.mutateAsync(selectedElement.id);
      setShowDeleteModal(false);
      setSelectedElement(null);
      toast.success('Element deleted successfully');
    } catch (error) {
      toast.error('Failed to delete element');
    }
  };

  // Element type icons
  const getElementIcon = (type) => {
    const icons = {
      bus: '🔌',
      generator: '⚡',
      load: '🏭',
      transformer: '⚙️',
      line: '📏',
    };
    return icons[type] || '📍';
  };

  // Status badges
  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-800 border-green-200',
      inactive: 'bg-gray-100 text-gray-800 border-gray-200',
      maintenance: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      fault: 'bg-red-100 text-red-800 border-red-200',
    };

    const icons = {
      active: <CheckCircle className="h-3 w-3" />,
      inactive: <AlertCircle className="h-3 w-3" />,
      maintenance: <Clock className="h-3 w-3" />,
      fault: <AlertCircle className="h-3 w-3" />,
    };

    return (
      <span className={cn(
        'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border',
        styles[status] || styles.inactive
      )}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Get element properties display
  const getElementProperties = (element) => {
    const props = element.properties || {};
    switch (element.element_type) {
      case 'generator':
        return `${props.rated_capacity?.toFixed(1) || 0} MW (${props.generation_type || 'Unknown'})`;
      case 'load':
        return `${props.rated_power?.toFixed(1) || 0} MW (${props.load_type || 'Unknown'})`;
      case 'transformer':
        return `${props.primary_voltage || 0}/${props.secondary_voltage || 0} kV`;
      case 'line':
        return `${props.length?.toFixed(2) || 0} km, ${props.voltage_level || 0} kV`;
      case 'bus':
        return `${props.voltage_level || 0} kV (${props.bus_type || 'PQ'})`;
      default:
        return 'No details available';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          {/* Page Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Grid Elements</h1>
                <p className="text-gray-600">Manage your power grid infrastructure</p>
              </div>
              <div className="flex items-center space-x-3">
                <Button variant="secondary" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Import
                </Button>
                <Button variant="secondary" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
                <Button 
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Element
                </Button>
              </div>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Elements</p>
                  <p className="text-2xl font-bold">{pagination.total || 0}</p>
                </div>
                <Zap className="h-8 w-8 text-blue-600" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-green-600">
                    {elements.filter(e => e.status === 'active').length}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-green-600" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Maintenance</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {elements.filter(e => e.status === 'maintenance').length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Faults</p>
                  <p className="text-2xl font-bold text-red-600">
                    {elements.filter(e => e.status === 'fault').length}
                  </p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
            </Card>
          </div>

          {/* Filters and Search */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search elements by name or description..."
                      className="pl-10"
                      onChange={(e) => handleSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* Type Filter */}
                <div className="w-full lg:w-48">
                  <select
                    className="w-full h-10 px-3 border border-gray-300 rounded-md"
                    value={filters.type}
                    onChange={(e) => handleFilterChange('type', e.target.value)}
                  >
                    {ELEMENT_TYPES.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div className="w-full lg:w-48">
                  <select
                    className="w-full h-10 px-3 border border-gray-300 rounded-md"
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                  >
                    {STATUS_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <Button variant="secondary" className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  More Filters
                </Button>
              </div>

              {/* Selected Actions */}
              {selectedElements.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-900">
                    {selectedElements.length} element(s) selected
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary">
                      Bulk Edit
                    </Button>
                    <Button size="sm" variant="danger">
                      Delete Selected
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Elements Table */}
          <Card>
            <CardHeader>
              <CardTitle>Elements List</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8">
                  <LoadingSpinner text="Loading elements..." />
                </div>
              ) : error ? (
                <div className="p-8 text-center text-red-600">
                  Failed to load elements. Please try again.
                </div>
              ) : elements.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Zap className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No elements found</h3>
                  <p className="text-gray-500 mb-4">
                    Get started by creating your first grid element.
                  </p>
                  <Button onClick={() => setShowCreateModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Element
                  </Button>
                </div>
              ) : (
                <>
                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left">
                            <input
                              type="checkbox"
                              checked={selectedElements.length === elements.length}
                              onChange={handleSelectAll}
                              className="rounded border-gray-300"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                            Element
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                            Type
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                            Properties
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                            Location
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                            Updated
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {elements.map((element) => (
                          <tr 
                            key={element.id} 
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleView(element)}
                          >
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedElements.includes(element.id)}
                                onChange={() => handleSelectElement(element.id)}
                                className="rounded border-gray-300"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">
                                  {getElementIcon(element.element_type)}
                                </span>
                                <div>
                                  <p className="font-medium text-gray-900">{element.name}</p>
                                  <p className="text-sm text-gray-500">{element.description}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-medium text-gray-900 capitalize">
                                {element.element_type}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {getStatusBadge(element.status)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-600">
                                {getElementProperties(element)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {element.latitude && element.longitude ? (
                                <div className="flex items-center gap-1 text-sm text-gray-600">
                                  <MapPin className="h-3 w-3" />
                                  {element.latitude}, {element.longitude}
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400">No location</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-600">
                                {formatDate(element.updated_at)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="relative">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDropdownOpen(dropdownOpen === element.id ? null : element.id)}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                                {dropdownOpen === element.id && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-10"
                                      onClick={() => setDropdownOpen(null)}
                                    />
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-20 py-1">
                                      <button
                                        onClick={() => handleView(element)}
                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                      >
                                        <Eye className="h-4 w-4" />
                                        View Details
                                      </button>
                                      <button
                                        onClick={() => handleEdit(element)}
                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                      >
                                        <Edit className="h-4 w-4" />
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => router.push(`/map?highlight=${element.id}`)}
                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                      >
                                        <MapPin className="h-4 w-4" />
                                        Show on Map
                                      </button>
                                      <div className="border-t">
                                        <button
                                          onClick={() => handleDelete(element)}
                                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {pagination.pages > 1 && (
                    <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                        {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                        {pagination.total} results
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!pagination.hasPrev}
                          onClick={() => handleFilterChange('page', pagination.page - 1)}
                        >
                          Previous
                        </Button>
                        {[...Array(Math.min(5, pagination.pages))].map((_, i) => {
                          const page = i + 1;
                          return (
                            <Button
                              key={page}
                              variant={pagination.page === page ? "primary" : "secondary"}
                              size="sm"
                              onClick={() => handleFilterChange('page', page)}
                            >
                              {page}
                            </Button>
                          );
                        })}
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!pagination.hasNext}
                          onClick={() => handleFilterChange('page', pagination.page + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <ElementFormModal
          element={selectedElement}
          onClose={() => {
            setShowCreateModal(false);
            setSelectedElement(null);
          }}
        />
      )}

      {showDetailModal && selectedElement && (
        <ElementDetailModal
          element={selectedElement}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedElement(null);
          }}
          onEdit={() => {
            setShowDetailModal(false);
            setShowCreateModal(true);
          }}
        />
      )}

      {showDeleteModal && selectedElement && (
        <DeleteConfirmModal
          isOpen={showDeleteModal}
          title="Delete Element"
          message={`Are you sure you want to delete "${selectedElement.name}"? This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => {
            setShowDeleteModal(false);
            setSelectedElement(null);
          }}
          isLoading={deleteElement.isPending}
        />
      )}
    </div>
  );
}
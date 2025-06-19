// src/components/elements/element-filters.js
'use client';

import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import Input from '@/components/ui/form/input';
import Button from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function ElementFilters({ filters, onChange, totalElements }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchValue, setSearchValue] = useState(filters.search || '');

  const elementTypes = [
    { value: '', label: 'All Types' },
    { value: 'generator', label: 'Generators' },
    { value: 'load', label: 'Loads' },
    { value: 'transformer', label: 'Transformers' },
    { value: 'line', label: 'Lines' },
    { value: 'bus', label: 'Buses' }
  ];

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'fault', label: 'Fault' }
  ];

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onChange({ search: searchValue });
  };

  const handleTypeChange = (type) => {
    onChange({ type });
  };

  const handleStatusChange = (status) => {
    onChange({ status });
  };

  const clearFilters = () => {
    setSearchValue('');
    onChange({
      type: '',
      status: '',
      search: ''
    });
  };

  const hasActiveFilters = filters.type || filters.status || filters.search;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="flex items-center space-x-4">
          <form onSubmit={handleSearchSubmit} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search elements by name or description..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchValue && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchValue('');
                    onChange({ search: '' });
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
          </form>
          <Button
            variant="secondary"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                {[filters.type, filters.status, filters.search].filter(Boolean).length}
              </span>
            )}
          </Button>
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="border-t pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Element Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Element Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {elementTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => handleTypeChange(type.value)}
                      className={cn(
                        'px-3 py-2 text-sm rounded-lg border transition-colors',
                        filters.type === type.value
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {statusOptions.map((status) => (
                    <button
                      key={status.value}
                      onClick={() => handleStatusChange(status.value)}
                      className={cn(
                        'px-3 py-2 text-sm rounded-lg border transition-colors',
                        filters.status === status.value
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-end">
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    onClick={clearFilters}
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="mt-4 text-sm text-gray-600">
        {totalElements > 0 && (
          <span>
            Found <span className="font-medium text-gray-900">{totalElements}</span> elements
            {hasActiveFilters && ' matching your filters'}
          </span>
        )}
      </div>
    </div>
  );
}
// src/components/common/delete-confirm-modal.js
'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';
import Button from '@/components/ui/button';

export default function DeleteConfirmModal({
  isOpen,
  title = 'Confirm Delete',
  message = 'Are you sure you want to delete this item? This action cannot be undone.',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isLoading = false,
  variant = 'danger' // 'danger' or 'warning'
}) {

  if (!isOpen) return null;

  

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          {/* Icon */}
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>

          {/* Title */}
          <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
            {title}
          </h3>

          {/* Message */}
          <p className="text-sm text-gray-500 text-center mb-6">
            {message}
          </p>

          {/* Actions */}
          <div className="flex space-x-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={onCancel}
              disabled={isLoading}
            >
              {cancelText}
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                confirmText
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
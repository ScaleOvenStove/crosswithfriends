/**
 * Simple dropzone hook to replace react-dropzone
 * Provides drag-and-drop file upload functionality
 */

import {useCallback, useState} from 'react';

interface UseDropzoneOptions {
  onDrop: (files: File[]) => void;
  accept?: Record<string, string[]>;
  multiple?: boolean;
  disabled?: boolean;
}

interface UseDropzoneReturn {
  getRootProps: () => {
    onDragEnter: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
  getInputProps: () => {
    type: 'file';
    accept?: string;
    multiple?: boolean;
    disabled?: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  };
  isDragActive: boolean;
}

export const useDropzone = (options: UseDropzoneOptions): UseDropzoneReturn => {
  const {onDrop, accept, multiple = false, disabled = false} = options;
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragActive(true);
      }
    },
    [disabled]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (disabled) {
        return;
      }

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onDrop(multiple ? files : [files[0]]);
      }
    },
    [disabled, multiple, onDrop]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        onDrop(multiple ? files : [files[0]]);
      }
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [multiple, onDrop]
  );

  // Convert accept object to MIME type string
  const acceptString = accept
    ? Object.entries(accept)
        .flatMap(([mime, extensions]) => [
          mime,
          ...extensions.map((ext) => (ext.startsWith('.') ? ext : `.${ext}`)),
        ])
        .join(',')
    : undefined;

  return {
    getRootProps: () => ({
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    }),
    getInputProps: () => ({
      type: 'file' as const,
      accept: acceptString,
      multiple,
      disabled,
      onChange: handleFileInput,
    }),
    isDragActive,
  };
};


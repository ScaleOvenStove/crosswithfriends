/**
 * FileUploader Component - Drag-and-drop file upload
 * Implements REQ-3.2: Puzzle Upload
 *
 * Features:
 * - Drag and drop area
 * - Click to select file
 * - File type validation
 * - File size validation
 * - Upload progress
 */

import { useState, useCallback } from 'react';
import { Box, Typography, Button, Alert, styled } from '@mui/material';
import { CloudUpload as UploadIcon } from '@mui/icons-material';
import { uploadPuzzleFile } from '@api/upload';
import { UploadProgress } from './UploadProgress';

interface FileUploaderProps {
  acceptedTypes?: string[];
  maxSizeMB?: number;
  onUploadSuccess?: (result: any) => void;
  onUploadError?: (error: Error) => void;
  isPublic?: boolean;
}

const DropZone = styled(Box)<{ isDragging?: boolean; hasError?: boolean }>(
  ({ theme, isDragging, hasError }) => ({
    border: `2px dashed ${
      hasError
        ? theme.palette.error.main
        : isDragging
          ? theme.palette.primary.main
          : theme.palette.divider
    }`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(4),
    textAlign: 'center',
    cursor: 'pointer',
    backgroundColor: isDragging ? theme.palette.action.hover : theme.palette.background.paper,
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
      borderColor: theme.palette.primary.main,
    },
  })
);

const FileInput = styled('input')({
  display: 'none',
});

/**
 * FileUploader component
 */
export const FileUploader = ({
  acceptedTypes = ['.puz', '.ipuz'],
  maxSizeMB = 10,
  onUploadSuccess,
  onUploadError,
  isPublic = true,
}: FileUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  /**
   * Validate file
   */
  const validateFile = (file: File): string | null => {
    // Check file type
    const lastDotIndex = file.name.lastIndexOf('.');
    const fileExt = lastDotIndex > -1 ? '.' + file.name.substring(lastDotIndex + 1).toLowerCase() : '';
    if (!fileExt || !acceptedTypes.includes(fileExt)) {
      return `Invalid file type. Accepted types: ${acceptedTypes.join(', ')}`;
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      return `File too large. Maximum size: ${maxSizeMB}MB`;
    }

    return null;
  };

  /**
   * Handle file upload
   */
  const handleUpload = useCallback(
    async (file: File) => {
      setError(null);
      setSelectedFile(file);

      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setIsUploading(true);
      setUploadProgress(0);

      try {
        // Simulate progress (since API doesn't provide real progress)
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 10, 90));
        }, 200);

        const result = await uploadPuzzleFile(file, isPublic);

        clearInterval(progressInterval);
        setUploadProgress(100);

        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          setSelectedFile(null);
          onUploadSuccess?.(result);
        }, 500);
      } catch (err) {
        setIsUploading(false);
        setUploadProgress(0);
        const error = err instanceof Error ? err : new Error('Upload failed');
        setError(error.message);
        onUploadError?.(error);
      }
    },
    [isPublic, maxSizeMB, acceptedTypes, onUploadSuccess, onUploadError]
  );

  /**
   * Handle drag events
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleUpload(files[0]);
    }
  };

  /**
   * Handle file input change
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleUpload(files[0]);
    }
  };

  /**
   * Open file picker
   */
  const openFilePicker = () => {
    document.getElementById('file-input')?.click();
  };

  return (
    <Box>
      {isUploading ? (
        <UploadProgress fileName={selectedFile?.name || 'Uploading...'} progress={uploadProgress} />
      ) : (
        <>
          <DropZone
            isDragging={isDragging}
            hasError={!!error}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={openFilePicker}
          >
            <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Drag and drop a puzzle file here
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              or
            </Typography>
            <Button variant="contained" component="span" sx={{ mt: 2 }}>
              Choose File
            </Button>
            <Typography variant="caption" display="block" color="text.secondary" mt={2}>
              Accepted formats: {acceptedTypes.join(', ')} (max {maxSizeMB}MB)
            </Typography>
          </DropZone>

          <FileInput
            id="file-input"
            type="file"
            accept={acceptedTypes.join(',')}
            onChange={handleFileSelect}
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </>
      )}
    </Box>
  );
};

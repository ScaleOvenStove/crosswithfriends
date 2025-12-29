/**
 * useFirebaseStorage - Hook for Firebase Storage operations
 * Provides file upload, delete, and listing functionality
 * Per codeguard-0-file-handling-and-uploads: Secure file handling with validation
 */

import { useState, useCallback } from 'react';
import {
  uploadFile,
  uploadFileWithProgress,
  deleteFile,
  listFiles,
  getFileURL,
  uploadAvatar,
  uploadPuzzleImage,
} from '@lib/firebase/storage';
import type { UploadTask } from 'firebase/storage';

interface UseFirebaseStorageOptions {
  onProgress?: (progress: number) => void;
  onComplete?: (url: string) => void;
  onError?: (error: Error) => void;
}

export const useFirebaseStorage = (options?: UseFirebaseStorageOptions) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  /**
   * Upload file to Firebase Storage
   * Per codeguard-0-file-handling-and-uploads: Client-side validation before upload
   */
  const upload = useCallback(
    async (path: string, file: File, allowedTypes?: string[]) => {
      try {
        setUploading(true);
        setProgress(0);
        setError(null);
        setUploadedUrl(null);

        const url = await uploadFile(path, file, allowedTypes);

        setUploadedUrl(url);
        setProgress(100);
        options?.onComplete?.(url);

        return url;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed';
        setError(errorMessage);
        options?.onError?.(err as Error);
        throw err;
      } finally {
        setUploading(false);
      }
    },
    [options]
  );

  /**
   * Upload file with progress tracking
   * Returns upload task that can be paused/resumed/canceled
   */
  const uploadWithProgress = useCallback(
    (path: string, file: File, allowedTypes?: string[]): UploadTask => {
      setUploading(true);
      setProgress(0);
      setError(null);
      setUploadedUrl(null);

      const handleProgress = (progressValue: number) => {
        setProgress(progressValue);
        options?.onProgress?.(progressValue);
      };

      const uploadTask = uploadFileWithProgress(path, file, handleProgress, allowedTypes);

      // Handle completion
      uploadTask.then(
        async (snapshot) => {
          const url = await snapshot.ref.getDownloadURL();
          setUploadedUrl(url);
          setProgress(100);
          setUploading(false);
          options?.onComplete?.(url);
        },
        (err) => {
          const errorMessage = err instanceof Error ? err.message : 'Upload failed';
          setError(errorMessage);
          setUploading(false);
          options?.onError?.(err as Error);
        }
      );

      return uploadTask;
    },
    [options]
  );

  /**
   * Upload user avatar
   * Per codeguard-0-file-handling-and-uploads: Specific validation for avatars
   */
  const uploadUserAvatar = useCallback(
    async (userId: string, file: File) => {
      try {
        setUploading(true);
        setProgress(0);
        setError(null);
        setUploadedUrl(null);

        const url = await uploadAvatar(userId, file);

        setUploadedUrl(url);
        setProgress(100);
        options?.onComplete?.(url);

        return url;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Avatar upload failed';
        setError(errorMessage);
        options?.onError?.(err as Error);
        throw err;
      } finally {
        setUploading(false);
      }
    },
    [options]
  );

  /**
   * Upload puzzle image
   */
  const uploadPuzzle = useCallback(
    async (puzzleId: string, file: File) => {
      try {
        setUploading(true);
        setProgress(0);
        setError(null);
        setUploadedUrl(null);

        const url = await uploadPuzzleImage(puzzleId, file);

        setUploadedUrl(url);
        setProgress(100);
        options?.onComplete?.(url);

        return url;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Puzzle upload failed';
        setError(errorMessage);
        options?.onError?.(err as Error);
        throw err;
      } finally {
        setUploading(false);
      }
    },
    [options]
  );

  /**
   * Delete file from storage
   */
  const remove = useCallback(async (url: string) => {
    try {
      setError(null);
      await deleteFile(url);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Delete failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * List all files in a directory
   */
  const list = useCallback(async (path: string) => {
    try {
      setError(null);
      return await listFiles(path);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'List files failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Get download URL for a file path
   */
  const getUrl = useCallback(async (path: string) => {
    try {
      setError(null);
      return await getFileURL(path);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Get URL failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setUploading(false);
    setProgress(0);
    setError(null);
    setUploadedUrl(null);
  }, []);

  return {
    // State
    uploading,
    progress,
    error,
    uploadedUrl,

    // Methods
    upload,
    uploadWithProgress,
    uploadUserAvatar,
    uploadPuzzle,
    remove,
    list,
    getUrl,
    reset,
  };
};

export default useFirebaseStorage;

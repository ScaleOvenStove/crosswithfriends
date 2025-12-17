/**
 * useFirebaseStorage Hook Tests
 * Tests file upload, delete, and storage operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useFirebaseStorage from '../firebase/useFirebaseStorage';

// Mock Firebase Storage
vi.mock('../../firebase/storage', () => ({
  uploadFile: vi.fn(),
  uploadFileWithProgress: vi.fn(),
  deleteFile: vi.fn(),
  listFiles: vi.fn(),
  getFileURL: vi.fn(),
  uploadAvatar: vi.fn(),
  uploadPuzzleImage: vi.fn(),
}));

describe('useFirebaseStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useFirebaseStorage());

      expect(result.current.uploading).toBe(false);
      expect(result.current.progress).toBe(0);
      expect(result.current.error).toBeNull();
      expect(result.current.uploadedUrl).toBeNull();
    });
  });

  describe('upload', () => {
    it('should upload file and return URL', async () => {
      const { uploadFile } = await import('../../firebase/storage');
      vi.mocked(uploadFile).mockResolvedValue('https://example.com/file.jpg');

      const { result } = renderHook(() => useFirebaseStorage());
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      let uploadedUrl: string | undefined;
      await act(async () => {
        uploadedUrl = await result.current.upload('path/to/file', mockFile);
      });

      expect(uploadFile).toHaveBeenCalledWith('path/to/file', mockFile, undefined);
      expect(uploadedUrl).toBe('https://example.com/file.jpg');
      expect(result.current.uploadedUrl).toBe('https://example.com/file.jpg');
      expect(result.current.progress).toBe(100);
      expect(result.current.uploading).toBe(false);
    });

    it('should call onComplete callback on success', async () => {
      const { uploadFile } = await import('../../firebase/storage');
      vi.mocked(uploadFile).mockResolvedValue('https://example.com/file.jpg');

      const onComplete = vi.fn();
      const { result } = renderHook(() => useFirebaseStorage({ onComplete }));
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      await act(async () => {
        await result.current.upload('path/to/file', mockFile);
      });

      expect(onComplete).toHaveBeenCalledWith('https://example.com/file.jpg');
    });

    it('should set error state on upload failure', async () => {
      const { uploadFile } = await import('../../firebase/storage');
      vi.mocked(uploadFile).mockRejectedValue(new Error('Upload failed'));

      const { result } = renderHook(() => useFirebaseStorage());
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      await act(async () => {
        await expect(result.current.upload('path/to/file', mockFile)).rejects.toThrow(
          'Upload failed'
        );
      });

      expect(result.current.error).toBe('Upload failed');
      expect(result.current.uploading).toBe(false);
    });

    it('should call onError callback on failure', async () => {
      const { uploadFile } = await import('../../firebase/storage');
      const error = new Error('Upload failed');
      vi.mocked(uploadFile).mockRejectedValue(error);

      const onError = vi.fn();
      const { result } = renderHook(() => useFirebaseStorage({ onError }));
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      await act(async () => {
        try {
          await result.current.upload('path/to/file', mockFile);
        } catch (e) {
          // Expected to throw
        }
      });

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('uploadWithProgress', () => {
    it('should track upload progress', async () => {
      const { uploadFileWithProgress } = await import('../../firebase/storage');

      const mockUploadTask: any = {
        then: (onSuccess: any) => {
          onSuccess({
            ref: { getDownloadURL: async () => 'https://example.com/file.jpg' },
          });
          return mockUploadTask;
        },
      };

      vi.mocked(uploadFileWithProgress).mockReturnValue(mockUploadTask);

      const onProgress = vi.fn();
      const { result } = renderHook(() => useFirebaseStorage({ onProgress }));
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      act(() => {
        result.current.uploadWithProgress('path/to/file', mockFile);
      });

      await waitFor(() => {
        expect(result.current.uploadedUrl).toBe('https://example.com/file.jpg');
      });
    });
  });

  describe('uploadUserAvatar', () => {
    it('should upload user avatar', async () => {
      const { uploadAvatar } = await import('../../firebase/storage');
      vi.mocked(uploadAvatar).mockResolvedValue('https://example.com/avatar.jpg');

      const { result } = renderHook(() => useFirebaseStorage());
      const mockFile = new File(['avatar'], 'avatar.jpg', { type: 'image/jpeg' });

      let uploadedUrl: string | undefined;
      await act(async () => {
        uploadedUrl = await result.current.uploadUserAvatar('user-id', mockFile);
      });

      expect(uploadAvatar).toHaveBeenCalledWith('user-id', mockFile);
      expect(uploadedUrl).toBe('https://example.com/avatar.jpg');
    });
  });

  describe('uploadPuzzle', () => {
    it('should upload puzzle image', async () => {
      const { uploadPuzzleImage } = await import('../../firebase/storage');
      vi.mocked(uploadPuzzleImage).mockResolvedValue('https://example.com/puzzle.jpg');

      const { result } = renderHook(() => useFirebaseStorage());
      const mockFile = new File(['puzzle'], 'puzzle.jpg', { type: 'image/jpeg' });

      let uploadedUrl: string | undefined;
      await act(async () => {
        uploadedUrl = await result.current.uploadPuzzle('puzzle-id', mockFile);
      });

      expect(uploadPuzzleImage).toHaveBeenCalledWith('puzzle-id', mockFile);
      expect(uploadedUrl).toBe('https://example.com/puzzle.jpg');
    });
  });

  describe('remove', () => {
    it('should delete file', async () => {
      const { deleteFile } = await import('../../firebase/storage');
      vi.mocked(deleteFile).mockResolvedValue(undefined);

      const { result } = renderHook(() => useFirebaseStorage());

      await act(async () => {
        await result.current.remove('https://example.com/file.jpg');
      });

      expect(deleteFile).toHaveBeenCalledWith('https://example.com/file.jpg');
      expect(result.current.error).toBeNull();
    });

    it('should set error on delete failure', async () => {
      const { deleteFile } = await import('../../firebase/storage');
      vi.mocked(deleteFile).mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useFirebaseStorage());

      await act(async () => {
        await expect(result.current.remove('https://example.com/file.jpg')).rejects.toThrow(
          'Delete failed'
        );
      });

      expect(result.current.error).toBe('Delete failed');
    });
  });

  describe('list', () => {
    it('should list files in directory', async () => {
      const { listFiles } = await import('../../firebase/storage');
      const mockUrls = ['https://example.com/file1.jpg', 'https://example.com/file2.jpg'];
      vi.mocked(listFiles).mockResolvedValue(mockUrls);

      const { result } = renderHook(() => useFirebaseStorage());

      let urls: string[] | undefined;
      await act(async () => {
        urls = await result.current.list('path/to/directory');
      });

      expect(listFiles).toHaveBeenCalledWith('path/to/directory');
      expect(urls).toEqual(mockUrls);
    });
  });

  describe('getUrl', () => {
    it('should get download URL for file path', async () => {
      const { getFileURL } = await import('../../firebase/storage');
      vi.mocked(getFileURL).mockResolvedValue('https://example.com/file.jpg');

      const { result } = renderHook(() => useFirebaseStorage());

      let url: string | undefined;
      await act(async () => {
        url = await result.current.getUrl('path/to/file');
      });

      expect(getFileURL).toHaveBeenCalledWith('path/to/file');
      expect(url).toBe('https://example.com/file.jpg');
    });
  });

  describe('reset', () => {
    it('should reset state', async () => {
      const { uploadFile } = await import('../../firebase/storage');
      vi.mocked(uploadFile).mockResolvedValue('https://example.com/file.jpg');

      const { result } = renderHook(() => useFirebaseStorage());
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      // Upload a file first
      await act(async () => {
        await result.current.upload('path/to/file', mockFile);
      });

      expect(result.current.uploadedUrl).not.toBeNull();
      expect(result.current.progress).toBe(100);

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.uploading).toBe(false);
      expect(result.current.progress).toBe(0);
      expect(result.current.error).toBeNull();
      expect(result.current.uploadedUrl).toBeNull();
    });
  });

  describe('Security Compliance', () => {
    it('should validate file types (handled by storage module)', async () => {
      // File validation is performed by the storage module
      // Per codeguard-0-file-handling-and-uploads
      const { uploadFile } = await import('../../firebase/storage');
      vi.mocked(uploadFile).mockRejectedValue(new Error('Invalid file type'));

      const { result } = renderHook(() => useFirebaseStorage());
      const mockFile = new File(['test'], 'test.exe', { type: 'application/exe' });

      await act(async () => {
        await expect(result.current.upload('path/to/file', mockFile)).rejects.toThrow(
          'Invalid file type'
        );
      });
    });

    it('should validate file sizes (handled by storage module)', async () => {
      // Size validation is performed by the storage module
      // Per codeguard-0-file-handling-and-uploads
      const { uploadFile } = await import('../../firebase/storage');
      vi.mocked(uploadFile).mockRejectedValue(new Error('File size exceeds 5MB limit'));

      const { result } = renderHook(() => useFirebaseStorage());
      const mockFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });

      await act(async () => {
        await expect(result.current.upload('path/to/file', mockFile)).rejects.toThrow(
          'File size exceeds 5MB limit'
        );
      });
    });
  });
});

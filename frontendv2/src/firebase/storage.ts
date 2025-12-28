/**
 * Firebase Cloud Storage Module
 * Handles file uploads (avatars, puzzle images, etc.)
 * Per codeguard-0-file-handling-and-uploads: Secure file upload practices
 */

import {
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
} from 'firebase/storage';
import type {
  StorageReference as _StorageReference,
  UploadTask,
  UploadResult,
} from 'firebase/storage';
import { storage, isFirebaseConfigured } from './config';

// Check if storage is available
const ensureStorage = () => {
  if (!isFirebaseConfigured || !storage) {
    throw new Error(
      'Firebase Storage is not configured. Set VITE_FIREBASE_* environment variables.'
    );
  }
  return storage;
};

// Allowed file types per codeguard-0-file-handling-and-uploads
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Validate file for security
 * Per codeguard-0-file-handling-and-uploads: Validate type, size, and content
 */
const validateFile = (file: File, allowedTypes: string[]): void => {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
  }

  // Check file type (client-side validation only, server should also validate)
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
  }
};

/**
 * Generate safe filename
 * Per codeguard-0-file-handling-and-uploads: Generate random filenames (UUID)
 */
const generateSafeFilename = (originalName: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop() || '';

  return `${timestamp}-${random}.${extension}`;
};

/**
 * Upload file to Firebase Storage
 * Returns download URL
 */
export const uploadFile = async (
  path: string,
  file: File,
  allowedTypes: string[] = ALLOWED_IMAGE_TYPES
): Promise<string> => {
  const storageInstance = ensureStorage();

  // Validate file
  validateFile(file, allowedTypes);

  // Generate safe filename
  const safeFilename = generateSafeFilename(file.name);
  const fullPath = `${path}/${safeFilename}`;

  // Create storage reference
  const storageRef = ref(storageInstance, fullPath);

  // Upload file
  const result: UploadResult = await uploadBytes(storageRef, file);

  // Get download URL
  const downloadURL = await getDownloadURL(result.ref);

  return downloadURL;
};

/**
 * Upload file with progress tracking
 * Returns upload task for monitoring progress
 */
export const uploadFileWithProgress = (
  path: string,
  file: File,
  onProgress?: (progress: number) => void,
  allowedTypes: string[] = ALLOWED_IMAGE_TYPES
): UploadTask => {
  const storageInstance = ensureStorage();

  // Validate file
  validateFile(file, allowedTypes);

  // Generate safe filename
  const safeFilename = generateSafeFilename(file.name);
  const fullPath = `${path}/${safeFilename}`;

  // Create storage reference
  const storageRef = ref(storageInstance, fullPath);

  // Create upload task
  const uploadTask = uploadBytesResumable(storageRef, file);

  // Monitor progress if callback provided
  if (onProgress) {
    uploadTask.on('state_changed', (snapshot) => {
      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      onProgress(progress);
    });
  }

  return uploadTask;
};

/**
 * Upload user avatar
 */
export const uploadAvatar = async (userId: string, file: File): Promise<string> => {
  return uploadFile(`avatars/${userId}`, file, ALLOWED_IMAGE_TYPES);
};

/**
 * Upload puzzle image
 */
export const uploadPuzzleImage = async (puzzleId: string, file: File): Promise<string> => {
  return uploadFile(`puzzles/${puzzleId}`, file, ALLOWED_IMAGE_TYPES);
};

/**
 * Delete file from storage
 */
export const deleteFile = async (url: string): Promise<void> => {
  const storageInstance = ensureStorage();
  const fileRef = ref(storageInstance, url);
  await deleteObject(fileRef);
};

/**
 * List files in a directory
 */
export const listFiles = async (path: string): Promise<string[]> => {
  const storageInstance = ensureStorage();
  const storageRef = ref(storageInstance, path);
  const result = await listAll(storageRef);

  // Get download URLs for all files
  const urls = await Promise.all(result.items.map((itemRef) => getDownloadURL(itemRef)));

  return urls;
};

/**
 * Get download URL for a file
 */
export const getFileURL = async (path: string): Promise<string> => {
  const storageInstance = ensureStorage();
  const storageRef = ref(storageInstance, path);
  return getDownloadURL(storageRef);
};

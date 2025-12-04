/**
 * AvatarUpload Component
 * Allows users to upload and manage their avatar
 * Per codeguard-0-file-handling-and-uploads: Secure file upload with validation
 */

import { useState, useRef } from 'react';
import { uploadAvatar } from '@lib/firebase/storage';

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl?: string;
  onUploadComplete: (url: string) => void;
}

// Per codeguard-0-file-handling-and-uploads: Validate file type and size
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const AvatarUpload = ({ userId, currentAvatarUrl, onUploadComplete }: AvatarUploadProps) => {
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Per codeguard-0-file-handling-and-uploads: Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.';
    }

    // Per codeguard-0-file-handling-and-uploads: Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.`;
    }

    return null;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to Firebase Storage
    try {
      setUploading(true);
      setProgress(0);

      // Per codeguard-0-file-handling-and-uploads: Generate safe filename and upload
      const downloadURL = await uploadAvatar(userId, file);

      setProgress(100);
      onUploadComplete(downloadURL);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      setPreview(currentAvatarUrl || null);
    } finally {
      setUploading(false);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="avatar-upload">
      <div className="avatar-preview-container">
        {preview ? (
          <img src={preview} alt="Avatar preview" className="avatar-preview" />
        ) : (
          <div className="avatar-placeholder">
            <span>No avatar</span>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleFileSelect}
        className="avatar-input-hidden"
        disabled={uploading}
      />

      <div className="avatar-actions">
        <button
          type="button"
          onClick={handleButtonClick}
          disabled={uploading}
          className="btn-primary"
        >
          {uploading ? 'Uploading...' : 'Choose Avatar'}
        </button>

        {uploading && (
          <div className="upload-progress">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
            <span className="progress-text">{progress}%</span>
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="avatar-guidelines">
        <p className="guidelines-text">
          Max size: {MAX_FILE_SIZE / 1024 / 1024}MB
          <br />
          Formats: JPEG, PNG, GIF, WebP
        </p>
      </div>
    </div>
  );
};

export default AvatarUpload;

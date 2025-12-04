/**
 * ProfileEditor Component
 * Allows users to edit their profile information
 */

import { useState } from 'react';

interface ProfileEditorProps {
  currentName: string;
  currentColor: string;
  onSave: (name: string, color: string) => void;
  onCancel: () => void;
}

const ProfileEditor = ({ currentName, currentColor, onSave, onCancel }: ProfileEditorProps) => {
  const [name, setName] = useState(currentName);
  const [color, setColor] = useState(currentColor);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError('Name cannot be empty');
      return;
    }

    if (name.length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }

    if (name.length > 50) {
      setError('Name must be less than 50 characters');
      return;
    }

    onSave(name.trim(), color);
  };

  return (
    <form onSubmit={handleSubmit} className="profile-editor">
      <div className="form-group">
        <label htmlFor="displayName">Display Name</label>
        <input
          id="displayName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-text"
          placeholder="Enter your display name"
          maxLength={50}
          required
        />
        <span className="char-count">{name.length}/50</span>
      </div>

      <div className="form-group">
        <label htmlFor="userColor">User Color</label>
        <div className="color-picker-group">
          <input
            id="userColor"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="color-input"
          />
          <div className="color-preview-large" style={{ backgroundColor: color }} />
          <span className="color-value">{color}</span>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="form-actions">
        <button type="submit" className="btn-primary">
          Save Changes
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
};

export default ProfileEditor;

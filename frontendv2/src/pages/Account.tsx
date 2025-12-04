/**
 * Account Page - Enhanced user profile with avatar upload and profile editor
 * Implements REQ-6.2: User Profile with Firebase Storage integration
 */

import './Account.css';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Nav from '@components/common/Nav';
import { useUser } from '@hooks/index';
import { useUserStore } from '@stores/userStore';
import ProfileEditor from '@components/Account/ProfileEditor';
import AvatarUpload from '@components/Account/AvatarUpload';

const Account = () => {
  const { user, changeName, changeColor } = useUser();
  const { history } = useUserStore();
  const [editingProfile, setEditingProfile] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  const handleProfileSave = (name: string, color: string) => {
    changeName(name);
    changeColor(color);
    setEditingProfile(false);
  };

  const handleAvatarUpload = (url: string) => {
    setAvatarUrl(url);
    // Here you would also update the user's avatar URL in your backend/Firebase
    console.log('Avatar uploaded:', url);
  };

  if (!user) {
    return (
      <div className="account-page">
        <Nav />
        <div className="container">
          <div className="error-message">
            <p>Please log in to view your account</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="account-page">
      <Nav />
      <div className="container">
        <header className="account-header">
          <h1>Account</h1>
          <p className="account-subtitle">Manage your profile and preferences</p>
        </header>

        <div className="account-sections">
          {/* Profile Section */}
          <section className="account-card profile-section">
            <div className="section-header">
              <h2>Profile</h2>
              {!editingProfile && (
                <button onClick={() => setEditingProfile(true)} className="btn-secondary">
                  Edit Profile
                </button>
              )}
            </div>

            {editingProfile ? (
              <ProfileEditor
                currentName={user.displayName}
                currentColor={user.color}
                onSave={handleProfileSave}
                onCancel={() => setEditingProfile(false)}
              />
            ) : (
              <div className="profile-display">
                <div className="profile-info">
                  <div className="profile-field">
                    <label>User ID</label>
                    <p className="user-id">{user.id}</p>
                  </div>

                  <div className="profile-field">
                    <label>Display Name</label>
                    <p className="display-name">{user.displayName}</p>
                  </div>

                  <div className="profile-field">
                    <label>User Color</label>
                    <div className="color-display">
                      <div className="color-preview" style={{ backgroundColor: user.color }} />
                      <span className="color-value">{user.color}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Avatar Section */}
          <section className="account-card avatar-section">
            <h2>Avatar</h2>
            <AvatarUpload
              userId={user.id}
              currentAvatarUrl={avatarUrl}
              onUploadComplete={handleAvatarUpload}
            />
          </section>

          {/* Statistics Summary */}
          <section className="account-card stats-summary">
            <div className="section-header">
              <h2>Statistics</h2>
              <Link to="/stats" className="btn-secondary">
                View Full Stats
              </Link>
            </div>

            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-value">{history.solvedPuzzles.length}</span>
                <span className="stat-label">Puzzles Solved</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{history.compositions.length}</span>
                <span className="stat-label">Puzzles Created</span>
              </div>
            </div>
          </section>

          {/* Preferences Section */}
          <section className="account-card preferences-section">
            <h2>Preferences</h2>

            <div className="preference-group">
              <label className="preference-label">
                <input type="checkbox" />
                <span>Enable sound effects</span>
              </label>
            </div>

            <div className="preference-group">
              <label className="preference-label">
                <input type="checkbox" defaultChecked />
                <span>Show cell numbers</span>
              </label>
            </div>

            <div className="preference-group">
              <label className="preference-label">
                <input type="checkbox" defaultChecked />
                <span>Highlight current word</span>
              </label>
            </div>
          </section>

          {/* Data Management */}
          <section className="account-card data-section">
            <h2>Data Management</h2>

            <div className="data-actions">
              <button className="btn-secondary">Export My Data</button>
              <button className="btn-danger">Delete Account</button>
            </div>

            <p className="data-notice">
              Export includes all your puzzles, games, and statistics. Account deletion is permanent
              and cannot be undone.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Account;

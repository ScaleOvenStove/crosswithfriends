/* eslint-disable react/jsx-no-bind */
import './css/account.css';

import {useContext, useState, useEffect} from 'react';
import {Helmet} from 'react-helmet-async';
import {useLocation, useNavigate, Link} from 'react-router';
import Nav from '../components/common/Nav';
import Footer from '../components/common/Footer';
import AuthContext from '../lib/AuthContext';
import LoginModal from '../components/Auth/LoginModal';
import {
  changeDisplayName,
  changePassword,
  setPassword as apiSetPassword,
  changeEmail,
  getLinkGoogleUrl,
  unlinkGoogle,
  deleteAccount,
  toggleProfileVisibility,
} from '../api/auth';
import {getUserStats} from '../api/user_stats';

function AccountSection({title, children}) {
  return (
    <div className="account-section">
      <div className="account-section--title">{title}</div>
      <div className="account-section--content">{children}</div>
    </div>
  );
}

function DisplayNameSection({user, accessToken, onSaved}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(user.displayName || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await changeDisplayName(accessToken, value);
      onSaved();
      setEditing(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <AccountSection title="Display Name">
        <span>{user.displayName}</span>
        <button
          className="btn btn--small"
          onClick={() => {
            setValue(user.displayName || '');
            setEditing(true);
          }}
        >
          Edit
        </button>
      </AccountSection>
    );
  }

  return (
    <AccountSection title="Display Name">
      <div className="form-field form-field--small">
        <input
          id="account-display-name"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      {error && <span className="text-error text-caption">{error}</span>}
      <div className="account-section--actions">
        <button className="btn btn--small" onClick={() => setEditing(false)}>
          Cancel
        </button>
        <button className="btn btn--small btn--contained btn--primary" onClick={handleSave} disabled={saving}>
          Save
        </button>
      </div>
    </AccountSection>
  );
}

function ProfileVisibilitySection({user, accessToken, onSaved}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isPublic = !!user.profileIsPublic;

  const handleToggle = async () => {
    setError('');
    setSaving(true);
    try {
      await toggleProfileVisibility(accessToken, !isPublic);
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountSection title="Profile Visibility">
      <p className="text-body2">
        Your profile is currently <strong>{isPublic ? 'Public' : 'Private'}</strong>.
        {isPublic
          ? ' Other users can see your stats and solve history.'
          : ' Only you can see your stats and solve history.'}
      </p>
      <button className="btn btn--small btn--outlined" onClick={handleToggle} disabled={saving}>
        {isPublic ? 'Make Private' : 'Make Public'}
      </button>
      {error && <span className="text-error text-caption">{error}</span>}
    </AccountSection>
  );
}

function EmailSection({user, accessToken}) {
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await changeEmail(accessToken, newEmail, password);
      setSuccess('Verification email sent to ' + newEmail);
      setEditing(false);
      setNewEmail('');
      setPassword('');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <AccountSection title="Email">
        <span>{user.email}</span>
        {user.hasPassword && (
          <button className="btn btn--small" onClick={() => setEditing(true)}>
            Change
          </button>
        )}
        {!user.hasPassword && (
          <span className="text-caption text-secondary">Set a password to change email</span>
        )}
        {success && (
          <span className="text-caption" style={{color: '#4caf50', width: '100%'}}>
            {success}
          </span>
        )}
      </AccountSection>
    );
  }

  return (
    <AccountSection title="Email">
      <div className="form-field form-field--small">
        <label htmlFor="account-new-email">New Email</label>
        <input
          id="account-new-email"
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />
      </div>
      <div className="form-field form-field--small">
        <label htmlFor="account-confirm-pw">Confirm Password</label>
        <input
          id="account-confirm-pw"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <span className="text-error text-caption">{error}</span>}
      <div className="account-section--actions">
        <button
          className="btn btn--small"
          onClick={() => {
            setEditing(false);
            setError('');
          }}
        >
          Cancel
        </button>
        <button className="btn btn--small btn--contained btn--primary" onClick={handleSave} disabled={saving}>
          Save
        </button>
      </div>
    </AccountSection>
  );
}

function PasswordSection({user, accessToken, onSaved}) {
  const [mode, setMode] = useState(null); // null | 'change' | 'set'
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChange = async () => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await changePassword(accessToken, currentPassword, newPassword);
      setSuccess('Password changed. Other sessions have been logged out.');
      setMode(null);
      setCurrentPassword('');
      setNewPassword('');
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSet = async () => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await apiSetPassword(accessToken, newPassword);
      setSuccess('Password set successfully.');
      setMode(null);
      setNewPassword('');
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!mode) {
    return (
      <AccountSection title="Password">
        {success && (
          <span className="text-caption" style={{color: '#4caf50'}}>
            {success}
          </span>
        )}
        {user.hasPassword ? (
          <button className="btn btn--small" onClick={() => setMode('change')}>
            Change Password
          </button>
        ) : (
          <>
            <p className="text-body2 text-secondary">No password set</p>
            <button className="btn btn--small" onClick={() => setMode('set')}>
              Set Password
            </button>
          </>
        )}
      </AccountSection>
    );
  }

  return (
    <AccountSection title="Password">
      {mode === 'change' && (
        <div className="form-field form-field--small">
          <label htmlFor="account-current-pw">Current Password</label>
          <input
            id="account-current-pw"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
      )}
      <div className="form-field form-field--small">
        <label htmlFor="account-new-pw">{mode === 'change' ? 'New Password' : 'Password'}</label>
        <input
          id="account-new-pw"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <div className="form-field--helper">At least 8 characters</div>
      </div>
      {error && <span className="text-error text-caption">{error}</span>}
      <div className="account-section--actions">
        <button
          className="btn btn--small"
          onClick={() => {
            setMode(null);
            setError('');
            setCurrentPassword('');
            setNewPassword('');
          }}
        >
          Cancel
        </button>
        <button
          className="btn btn--small btn--contained btn--primary"
          onClick={mode === 'change' ? handleChange : handleSet}
          disabled={saving}
        >
          {mode === 'change' ? 'Change Password' : 'Set Password'}
        </button>
      </div>
    </AccountSection>
  );
}

function GoogleSection({user, accessToken, onSaved}) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [unlinked, setUnlinked] = useState(false);

  const handleUnlink = async () => {
    setError('');
    setSaving(true);
    try {
      await unlinkGoogle(accessToken);
      setUnlinked(true);
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountSection title="Google Account">
      {user.hasGoogle ? (
        <>
          <p className="text-body2">Google account linked</p>
          {user.hasPassword ? (
            <button className="btn btn--small" onClick={handleUnlink} disabled={saving}>
              Unlink
            </button>
          ) : (
            <span className="text-caption text-secondary">Set a password before unlinking Google</span>
          )}
        </>
      ) : (
        <>
          <button
            className="btn btn--small btn--outlined"
            onClick={() => {
              window.location.href = getLinkGoogleUrl(accessToken);
            }}
          >
            Link Google Account
          </button>
          {unlinked && (
            <span className="text-caption text-secondary" style={{width: '100%'}}>
              To also revoke access, visit your{' '}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                style={{color: 'inherit'}}
              >
                Google Account settings
              </a>
              .
            </span>
          )}
        </>
      )}
      {error && <span className="text-error text-caption">{error}</span>}
    </AccountSection>
  );
}

function DeleteAccountSection({user, accessToken, onDeleted}) {
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [solveCount, setSolveCount] = useState(null);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const stats = await getUserStats(user.id, accessToken);
      if (stats?.stats?.totalSolved != null) {
        setSolveCount(stats.stats.totalSolved);
      }
    } catch (_e) {
      // Non-critical — just won't show count
    }
  };

  const handleDelete = async () => {
    setError('');
    setSaving(true);
    try {
      await deleteAccount(accessToken, user.hasPassword ? password : undefined);
      onDeleted();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!confirming) {
    return (
      <AccountSection title="Delete Account">
        <button className="btn btn--small btn--danger" onClick={handleConfirm}>
          Delete Account
        </button>
      </AccountSection>
    );
  }

  return (
    <AccountSection title="Delete Account">
      <p className="text-body2" style={{color: '#d32f2f', width: '100%'}}>
        This action is permanent. Your account data
        {solveCount != null && solveCount > 0
          ? `, including ${solveCount} solved puzzle${solveCount === 1 ? '' : 's'},`
          : ''}{' '}
        will be deleted.
      </p>
      {user.hasPassword && (
        <div className="form-field form-field--small">
          <label htmlFor="account-delete-pw">Confirm Password</label>
          <input
            id="account-delete-pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      )}
      {error && <span className="text-error text-caption">{error}</span>}
      <div className="account-section--actions">
        <button
          className="btn btn--small"
          onClick={() => {
            setConfirming(false);
            setError('');
            setPassword('');
          }}
        >
          Cancel
        </button>
        <button
          className="btn btn--small btn--contained btn--danger"
          onClick={handleDelete}
          disabled={saving}
        >
          Delete My Account
        </button>
      </div>
    </AccountSection>
  );
}

export default function Account() {
  const {isAuthenticated, user, accessToken, refreshUser, handleLogout} = useContext(AuthContext);
  const [showLogin, setShowLogin] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [flash, setFlash] = useState(null);

  // Handle flash messages from URL params (e.g., after Google link redirect)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const errorParam = params.get('error');
    const successParam = params.get('success');
    if (errorParam) setFlash({type: 'error', text: errorParam});
    if (successParam) setFlash({type: 'success', text: successParam});
    if (errorParam || successParam) {
      navigate('/account', {replace: true});
      if (successParam) refreshUser();
    }
  }, [location.search, navigate, refreshUser]);

  return (
    <div className="account">
      <Helmet>
        <title>Account Settings - Cross with Friends</title>
      </Helmet>
      <Nav />
      <div className="account--title">Your Account</div>
      <div className="account--main">
        {flash && (
          <p
            style={{
              marginBottom: 16,
              padding: '8px 12px',
              borderRadius: 4,
              backgroundColor: flash.type === 'error' ? '#fdecea' : '#e8f5e9',
              color: flash.type === 'error' ? '#b71c1c' : '#2e7d32',
            }}
          >
            {flash.text}
          </p>
        )}

        {isAuthenticated && !user?.emailVerified && (
          <div className="account-verify-banner">
            Your email is not verified. <Link to="/verify-email">Verify your email</Link>
          </div>
        )}

        {isAuthenticated ? (
          <>
            <DisplayNameSection user={user} accessToken={accessToken} onSaved={refreshUser} />
            <ProfileVisibilitySection user={user} accessToken={accessToken} onSaved={refreshUser} />
            <EmailSection user={user} accessToken={accessToken} />
            <PasswordSection user={user} accessToken={accessToken} onSaved={refreshUser} />
            <GoogleSection user={user} accessToken={accessToken} onSaved={refreshUser} />
            <DeleteAccountSection
              user={user}
              accessToken={accessToken}
              onDeleted={() => {
                handleLogout();
                navigate('/');
              }}
            />
          </>
        ) : (
          <div style={{padding: 20, textAlign: 'center'}}>
            <p>Log in to access your account and track your game progress.</p>
            <button
              onClick={() => setShowLogin(true)}
              style={{
                padding: '10px 24px',
                fontSize: 14,
                cursor: 'pointer',
                marginTop: 12,
              }}
            >
              Log In
            </button>
            <LoginModal open={showLogin} onClose={() => setShowLogin(false)} />
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

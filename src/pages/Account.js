import './css/account.css';

import React, {useContext, useState, useEffect} from 'react';
import {useLocation, useHistory, Link} from 'react-router-dom';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
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
} from '../api/auth';

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
        <Button
          size="small"
          onClick={() => {
            setValue(user.displayName || '');
            setEditing(true);
          }}
        >
          Edit
        </Button>
      </AccountSection>
    );
  }

  return (
    <AccountSection title="Display Name">
      <TextField
        value={value}
        onChange={(e) => setValue(e.target.value)}
        size="small"
        fullWidth
        margin="dense"
      />
      {error && (
        <Typography color="error" variant="caption">
          {error}
        </Typography>
      )}
      <div className="account-section--actions">
        <Button size="small" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button size="small" color="primary" variant="contained" onClick={handleSave} disabled={saving}>
          Save
        </Button>
      </div>
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
          <Button size="small" onClick={() => setEditing(true)}>
            Change
          </Button>
        )}
        {!user.hasPassword && (
          <Typography variant="caption" color="textSecondary">
            Set a password to change email
          </Typography>
        )}
        {success && (
          <Typography style={{color: '#4caf50', width: '100%'}} variant="caption">
            {success}
          </Typography>
        )}
      </AccountSection>
    );
  }

  return (
    <AccountSection title="Email">
      <TextField
        label="New Email"
        type="email"
        value={newEmail}
        onChange={(e) => setNewEmail(e.target.value)}
        size="small"
        fullWidth
        margin="dense"
      />
      <TextField
        label="Confirm Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        size="small"
        fullWidth
        margin="dense"
      />
      {error && (
        <Typography color="error" variant="caption">
          {error}
        </Typography>
      )}
      <div className="account-section--actions">
        <Button
          size="small"
          onClick={() => {
            setEditing(false);
            setError('');
          }}
        >
          Cancel
        </Button>
        <Button size="small" color="primary" variant="contained" onClick={handleSave} disabled={saving}>
          Save
        </Button>
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
          <Typography style={{color: '#4caf50'}} variant="caption">
            {success}
          </Typography>
        )}
        {user.hasPassword ? (
          <Button size="small" onClick={() => setMode('change')}>
            Change Password
          </Button>
        ) : (
          <>
            <Typography variant="body2" color="textSecondary">
              No password set
            </Typography>
            <Button size="small" onClick={() => setMode('set')}>
              Set Password
            </Button>
          </>
        )}
      </AccountSection>
    );
  }

  return (
    <AccountSection title="Password">
      {mode === 'change' && (
        <TextField
          label="Current Password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          size="small"
          fullWidth
          margin="dense"
        />
      )}
      <TextField
        label={mode === 'change' ? 'New Password' : 'Password'}
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        size="small"
        fullWidth
        margin="dense"
        helperText="At least 8 characters"
      />
      {error && (
        <Typography color="error" variant="caption">
          {error}
        </Typography>
      )}
      <div className="account-section--actions">
        <Button
          size="small"
          onClick={() => {
            setMode(null);
            setError('');
            setCurrentPassword('');
            setNewPassword('');
          }}
        >
          Cancel
        </Button>
        <Button
          size="small"
          color="primary"
          variant="contained"
          onClick={mode === 'change' ? handleChange : handleSet}
          disabled={saving}
        >
          {mode === 'change' ? 'Change Password' : 'Set Password'}
        </Button>
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
          <Typography variant="body2">Google account linked</Typography>
          {user.hasPassword ? (
            <Button size="small" onClick={handleUnlink} disabled={saving}>
              Unlink
            </Button>
          ) : (
            <Typography variant="caption" color="textSecondary">
              Set a password before unlinking Google
            </Typography>
          )}
        </>
      ) : (
        <>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              window.location.href = getLinkGoogleUrl(accessToken);
            }}
          >
            Link Google Account
          </Button>
          {unlinked && (
            <Typography variant="caption" color="textSecondary" style={{width: '100%'}}>
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
            </Typography>
          )}
        </>
      )}
      {error && (
        <Typography color="error" variant="caption">
          {error}
        </Typography>
      )}
    </AccountSection>
  );
}

function DeleteAccountSection({user, accessToken, onDeleted}) {
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
        <Button size="small" style={{color: '#d32f2f'}} onClick={() => setConfirming(true)}>
          Delete Account
        </Button>
      </AccountSection>
    );
  }

  return (
    <AccountSection title="Delete Account">
      <Typography variant="body2" style={{color: '#d32f2f', width: '100%'}}>
        This action is permanent. Your account data will be deleted.
      </Typography>
      {user.hasPassword && (
        <TextField
          label="Confirm Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          size="small"
          fullWidth
          margin="dense"
        />
      )}
      {error && (
        <Typography color="error" variant="caption">
          {error}
        </Typography>
      )}
      <div className="account-section--actions">
        <Button
          size="small"
          onClick={() => {
            setConfirming(false);
            setError('');
            setPassword('');
          }}
        >
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          style={{backgroundColor: '#d32f2f', color: '#fff'}}
          onClick={handleDelete}
          disabled={saving}
        >
          Delete My Account
        </Button>
      </div>
    </AccountSection>
  );
}

export default function Account() {
  const {isAuthenticated, user, accessToken, refreshUser, handleLogout} = useContext(AuthContext);
  const [showLogin, setShowLogin] = useState(false);
  const location = useLocation();
  const history = useHistory();
  const [flash, setFlash] = useState(null);

  // Handle flash messages from URL params (e.g., after Google link redirect)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const errorParam = params.get('error');
    const successParam = params.get('success');
    if (errorParam) setFlash({type: 'error', text: errorParam});
    if (successParam) setFlash({type: 'success', text: successParam});
    if (errorParam || successParam) {
      history.replace('/account');
      if (successParam) refreshUser();
    }
  }, [location.search, history, refreshUser]);

  return (
    <div className="account">
      <Nav />
      <div className="account--title">Your Account</div>
      <div className="account--main">
        {flash && (
          <Typography
            style={{
              marginBottom: 16,
              padding: '8px 12px',
              borderRadius: 4,
              backgroundColor: flash.type === 'error' ? '#fdecea' : '#e8f5e9',
              color: flash.type === 'error' ? '#b71c1c' : '#2e7d32',
            }}
          >
            {flash.text}
          </Typography>
        )}

        {isAuthenticated && !user?.emailVerified && (
          <div className="account-verify-banner">
            Your email is not verified. <Link to="/verify-email">Verify your email</Link>
          </div>
        )}

        {isAuthenticated ? (
          <>
            <DisplayNameSection user={user} accessToken={accessToken} onSaved={refreshUser} />
            <EmailSection user={user} accessToken={accessToken} />
            <PasswordSection user={user} accessToken={accessToken} onSaved={refreshUser} />
            <GoogleSection user={user} accessToken={accessToken} onSaved={refreshUser} />
            <DeleteAccountSection
              user={user}
              accessToken={accessToken}
              onDeleted={() => {
                handleLogout();
                history.push('/');
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

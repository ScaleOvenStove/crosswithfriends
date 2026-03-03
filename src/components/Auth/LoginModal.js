import {useState, useContext, useCallback} from 'react';
import {useNavigate} from 'react-router';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import AuthContext from '../../lib/AuthContext';
import {login, signup, getGoogleAuthUrl} from '../../api/auth';
import './css/loginModal.css';

export default function LoginModal({open, onClose}) {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const {handleLoginSuccess} = useContext(AuthContext);
  const navigate = useNavigate();

  const resetForm = useCallback(() => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setError('');
    setLoading(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleLogin = useCallback(
    async (e) => {
      e.preventDefault();
      setError('');
      setLoading(true);
      try {
        const tokens = await login(email, password);
        await handleLoginSuccess(tokens);
        handleClose();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [email, password, handleLoginSuccess, handleClose]
  );

  const handleSignup = useCallback(
    async (e) => {
      e.preventDefault();
      setError('');
      setLoading(true);
      try {
        const tokens = await signup(email, password, displayName);
        await handleLoginSuccess(tokens);
        handleClose();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [email, password, displayName, handleLoginSuccess, handleClose]
  );

  const handleGoogleLogin = useCallback(() => {
    window.location.href = getGoogleAuthUrl();
  }, []);

  const handleTabChange = useCallback((value) => {
    setTab(value);
    setError('');
  }, []);

  const handleEmailChange = useCallback((e) => {
    setEmail(e.target.value);
  }, []);

  const handlePasswordChange = useCallback((e) => {
    setPassword(e.target.value);
  }, []);

  const handleDisplayNameChange = useCallback((e) => {
    setDisplayName(e.target.value);
  }, []);

  const handleForgotPassword = useCallback(() => {
    handleClose();
    navigate('/forgot-password');
  }, [handleClose, navigate]);

  const handleOpenChange = useCallback(
    (isOpen) => {
      if (!isOpen) handleClose();
    },
    [handleClose]
  );

  const handleForgotKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') handleForgotPassword();
    },
    [handleForgotPassword]
  );

  const handleInteractOutside = useCallback((e) => {
    const target = e.detail?.originalEvent?.target;
    // Allow overlay clicks to close the dialog; block everything else
    // (e.g. password-manager extension popups) from dismissing it.
    if (target?.classList?.contains('login-modal--overlay')) return;
    e.preventDefault();
  }, []);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="login-modal--overlay" />
        <DialogPrimitive.Content className="login-modal--panel" onInteractOutside={handleInteractOutside}>
          <TabsPrimitive.Root value={tab} onValueChange={handleTabChange}>
            <TabsPrimitive.List className="login-modal--tabs">
              <TabsPrimitive.Trigger value="login" className="login-modal--tab">
                Log In
              </TabsPrimitive.Trigger>
              <TabsPrimitive.Trigger value="signup" className="login-modal--tab">
                Sign Up
              </TabsPrimitive.Trigger>
            </TabsPrimitive.List>

            <div className="login-modal--body">
              {error && (
                <p className="text-error" style={{marginBottom: 12}}>
                  {error}
                </p>
              )}

              <TabsPrimitive.Content value="login">
                <form onSubmit={handleLogin}>
                  <div className="form-field">
                    <label htmlFor="login-email">Email</label>
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={handleEmailChange}
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="login-password">Password</label>
                    <input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={handlePasswordChange}
                      required
                    />
                  </div>
                  {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
                  <p
                    className="text-body2 text-secondary login-modal--forgot"
                    onClick={handleForgotPassword}
                    onKeyDown={handleForgotKeyDown}
                  >
                    Forgot password?
                  </p>
                  <div className="login-modal--actions">
                    <button type="button" className="btn" onClick={handleClose}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn--contained btn--primary" disabled={loading}>
                      {loading ? <span className="spinner spinner--small" /> : 'Log In'}
                    </button>
                  </div>
                </form>
              </TabsPrimitive.Content>

              <TabsPrimitive.Content value="signup">
                <form onSubmit={handleSignup}>
                  <div className="form-field">
                    <label htmlFor="signup-name">Display Name</label>
                    <input
                      id="signup-name"
                      type="text"
                      value={displayName}
                      onChange={handleDisplayNameChange}
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="signup-email">Email</label>
                    <input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={handleEmailChange}
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="signup-password">Password</label>
                    <input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={handlePasswordChange}
                      required
                    />
                    <div className="form-field--helper">At least 8 characters</div>
                  </div>
                  <div className="login-modal--actions">
                    <button type="button" className="btn" onClick={handleClose}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn--contained btn--primary" disabled={loading}>
                      {loading ? <span className="spinner spinner--small" /> : 'Sign Up'}
                    </button>
                  </div>
                </form>
              </TabsPrimitive.Content>

              <div style={{textAlign: 'center', margin: '16px 0 8px'}}>
                <p className="text-body2 text-secondary" style={{marginBottom: 12}}>
                  or
                </p>
                <button
                  type="button"
                  className="google-sign-in-btn"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    width: '100%',
                    padding: '10px 16px',
                    border: '1px solid #747775',
                    borderRadius: 4,
                    backgroundColor: '#fff',
                    cursor: loading ? 'default' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    fontSize: 14,
                    fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
                    fontWeight: 500,
                    color: '#3c4043',
                    letterSpacing: '0.25px',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                  Sign in with Google
                </button>
              </div>
            </div>
          </TabsPrimitive.Root>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

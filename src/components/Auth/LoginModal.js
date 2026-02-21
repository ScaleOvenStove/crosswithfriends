import React, {useState, useContext, useCallback} from 'react';
import {useHistory} from 'react-router-dom';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';
import AuthContext from '../../lib/AuthContext';
import {login, signup, getGoogleAuthUrl} from '../../api/auth';

export default function LoginModal({open, onClose}) {
  const [tab, setTab] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const {handleLoginSuccess} = useContext(AuthContext);
  const history = useHistory();

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

  const handleTabChange = useCallback((e, v) => {
    setTab(v);
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
    history.push('/forgot-password');
  }, [handleClose, history]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <Tabs
        value={tab}
        onChange={handleTabChange}
        variant="fullWidth"
        indicatorColor="primary"
        textColor="primary"
        style={{borderBottom: '1px solid #e0e0e0'}}
      >
        <Tab label="Log In" />
        <Tab label="Sign Up" />
      </Tabs>
      <DialogContent style={{paddingTop: 20}}>
        {error && (
          <Typography color="error" style={{marginBottom: 12}}>
            {error}
          </Typography>
        )}

        {tab === 0 ? (
          <form onSubmit={handleLogin}>
            <TextField
              label="Email"
              type="email"
              fullWidth
              margin="dense"
              value={email}
              onChange={handleEmailChange}
              required
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              margin="dense"
              value={password}
              onChange={handlePasswordChange}
              required
            />
            <Typography
              variant="body2"
              style={{textAlign: 'right', marginTop: 4, cursor: 'pointer'}}
              color="textSecondary"
              onClick={handleForgotPassword}
            >
              Forgot password?
            </Typography>
            <DialogActions style={{paddingLeft: 0, paddingRight: 0}}>
              <Button onClick={handleClose}>Cancel</Button>
              <Button type="submit" color="primary" variant="contained" disabled={loading}>
                {loading ? <CircularProgress size={20} /> : 'Log In'}
              </Button>
            </DialogActions>
          </form>
        ) : (
          <form onSubmit={handleSignup}>
            <TextField
              label="Display Name"
              fullWidth
              margin="dense"
              value={displayName}
              onChange={handleDisplayNameChange}
              required
            />
            <TextField
              label="Email"
              type="email"
              fullWidth
              margin="dense"
              value={email}
              onChange={handleEmailChange}
              required
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              margin="dense"
              value={password}
              onChange={handlePasswordChange}
              required
              helperText="At least 8 characters"
            />
            <DialogActions style={{paddingLeft: 0, paddingRight: 0}}>
              <Button onClick={handleClose}>Cancel</Button>
              <Button type="submit" color="primary" variant="contained" disabled={loading}>
                {loading ? <CircularProgress size={20} /> : 'Sign Up'}
              </Button>
            </DialogActions>
          </form>
        )}

        <div style={{textAlign: 'center', margin: '16px 0 8px'}}>
          <Typography variant="body2" color="textSecondary" style={{marginBottom: 12}}>
            or
          </Typography>
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
      </DialogContent>
    </Dialog>
  );
}

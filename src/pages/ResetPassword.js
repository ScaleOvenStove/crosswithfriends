import React, {useState} from 'react';
import {useLocation, Link} from 'react-router-dom';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';
import Nav from '../components/common/Nav';
import Footer from '../components/common/Footer';
import {resetPassword} from '../api/auth';

export default function ResetPassword() {
  const location = useLocation();
  const token = new URLSearchParams(location.search).get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setStatus('submitting');
    setError('');
    try {
      await resetPassword(token, newPassword);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  };

  if (!token) {
    return (
      <div className="account">
        <Nav />
        <div className="account--title">Reset Password</div>
        <div className="account--main" style={{textAlign: 'center', paddingTop: 40}}>
          <Typography style={{marginBottom: 16}}>Invalid or missing reset link.</Typography>
          <Link to="/forgot-password" style={{color: 'inherit'}}>
            Request a new reset link
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="account">
        <Nav />
        <div className="account--title">Reset Password</div>
        <div className="account--main" style={{textAlign: 'center', paddingTop: 40}}>
          <Typography variant="h6" style={{color: '#4caf50', marginBottom: 16}}>
            Password reset!
          </Typography>
          <Typography style={{marginBottom: 24}}>
            Your password has been reset. You can now log in.
          </Typography>
          <Link to="/" style={{color: 'inherit'}}>
            Go to home
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="account">
      <Nav />
      <div className="account--title">Reset Password</div>
      <div className="account--main" style={{paddingTop: 20}}>
        <form onSubmit={handleSubmit} style={{maxWidth: 400, margin: '0 auto'}}>
          <Typography style={{marginBottom: 16}}>Enter your new password below.</Typography>
          <TextField
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            fullWidth
            margin="dense"
            required
            helperText="At least 8 characters"
          />
          <TextField
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            fullWidth
            margin="dense"
            required
          />
          {(status === 'error' || error) && (
            <Typography color="error" variant="caption" style={{display: 'block', marginTop: 8}}>
              {error}
            </Typography>
          )}
          <div
            style={{marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}
          >
            <Link to="/forgot-password" style={{color: 'inherit', fontSize: 14}}>
              Request new link
            </Link>
            <Button type="submit" variant="contained" color="primary" disabled={status === 'submitting'}>
              {status === 'submitting' ? <CircularProgress size={20} /> : 'Reset Password'}
            </Button>
          </div>
        </form>
      </div>
      <Footer />
    </div>
  );
}

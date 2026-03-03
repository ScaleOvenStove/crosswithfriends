/* eslint-disable react/jsx-no-bind */
import {useState} from 'react';
import {Helmet} from 'react-helmet-async';
import {useLocation, Link} from 'react-router';
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
          <p style={{marginBottom: 16}}>Invalid or missing reset link.</p>
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
          <h6 className="text-h6" style={{color: '#4caf50', marginBottom: 16}}>
            Password reset!
          </h6>
          <p style={{marginBottom: 24}}>Your password has been reset. You can now log in.</p>
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
      <Helmet>
        <title>Reset Password - Cross with Friends</title>
      </Helmet>
      <Nav />
      <div className="account--title">Reset Password</div>
      <div className="account--main" style={{paddingTop: 20}}>
        <form onSubmit={handleSubmit} style={{maxWidth: 400, margin: '0 auto'}}>
          <p style={{marginBottom: 16}}>Enter your new password below.</p>
          <div className="form-field">
            <label htmlFor="reset-new-pw">New Password</label>
            <input
              id="reset-new-pw"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <div className="form-field--helper">At least 8 characters</div>
          </div>
          <div className="form-field">
            <label htmlFor="reset-confirm-pw">Confirm Password</label>
            <input
              id="reset-confirm-pw"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {(status === 'error' || error) && (
            <span className="text-error text-caption" style={{display: 'block', marginTop: 8}}>
              {error}
            </span>
          )}
          <div
            style={{marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}
          >
            <Link to="/forgot-password" style={{color: 'inherit', fontSize: 14}}>
              Request new link
            </Link>
            <button
              type="submit"
              className="btn btn--contained btn--primary"
              disabled={status === 'submitting'}
            >
              {status === 'submitting' ? <span className="spinner spinner--small" /> : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
      <Footer />
    </div>
  );
}

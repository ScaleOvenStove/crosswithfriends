import React, {useContext, useState, useEffect, useRef} from 'react';
import {useLocation, useHistory, Link} from 'react-router-dom';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';
import Nav from '../components/common/Nav';
import Footer from '../components/common/Footer';
import AuthContext from '../lib/AuthContext';
import {verifyEmail, resendVerification} from '../api/auth';

export default function VerifyEmail() {
  const {user, accessToken, refreshUser} = useContext(AuthContext);
  const location = useLocation();
  const history = useHistory();
  const token = new URLSearchParams(location.search).get('token');

  const [status, setStatus] = useState(token ? 'verifying' : 'idle'); // verifying | success | error | idle
  const [error, setError] = useState('');
  const [resendStatus, setResendStatus] = useState('idle'); // idle | sending | sent | error
  const [resendError, setResendError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const attemptedRef = useRef(false);

  // Auto-verify if token is present in URL (run only once)
  useEffect(() => {
    if (!token || attemptedRef.current) return;
    attemptedRef.current = true;
    (async () => {
      setStatus('verifying');
      try {
        await verifyEmail(token);
        setStatus('success');
        if (refreshUser) await refreshUser();
      } catch (e) {
        setStatus('error');
        setError(e.message);
      }
    })();
  }, [token]); // intentionally only re-run when token changes

  // Cooldown timer for resend button
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!accessToken) return;
    setResendStatus('sending');
    setResendError('');
    try {
      await resendVerification(accessToken);
      setResendStatus('sent');
      setCooldown(60);
    } catch (e) {
      setResendStatus('error');
      setResendError(e.message);
    }
  };

  // Token verification mode
  if (token) {
    return (
      <div className="account">
        <Nav />
        <div className="account--title">Email Verification</div>
        <div className="account--main" style={{textAlign: 'center', paddingTop: 40}}>
          {status === 'verifying' && (
            <>
              <CircularProgress style={{marginBottom: 16}} />
              <Typography>Verifying your email...</Typography>
            </>
          )}
          {status === 'success' && (
            <>
              <Typography variant="h6" style={{color: '#4caf50', marginBottom: 16}}>
                Email verified!
              </Typography>
              <Typography style={{marginBottom: 24}}>Your email has been verified successfully.</Typography>
              <Button variant="contained" color="primary" onClick={() => history.push('/')}>
                Go to Home
              </Button>
            </>
          )}
          {status === 'error' && (
            <>
              <Typography variant="h6" style={{color: '#d32f2f', marginBottom: 16}}>
                Verification failed
              </Typography>
              <Typography style={{marginBottom: 24}}>
                {error || 'The link may be expired or invalid.'}
              </Typography>
              {user && !user.emailVerified && (
                <Button variant="contained" color="primary" onClick={() => history.push('/verify-email')}>
                  Request a new link
                </Button>
              )}
            </>
          )}
        </div>
        <Footer />
      </div>
    );
  }

  // "Check your inbox" mode (verification gate redirect)
  return (
    <div className="account">
      <Nav />
      <div className="account--title">Verify Your Email</div>
      <div className="account--main" style={{textAlign: 'center', paddingTop: 20}}>
        <Typography style={{marginBottom: 8}}>
          We sent a verification email to <strong>{user?.email || 'your email address'}</strong>.
        </Typography>
        <Typography style={{marginBottom: 24}} color="textSecondary">
          Check your inbox and click the link to verify your account. If you don&apos;t see it, check your
          spam or junk folder.
        </Typography>

        <Button
          variant="contained"
          color="primary"
          onClick={handleResend}
          disabled={resendStatus === 'sending' || cooldown > 0}
          style={{marginBottom: 16}}
        >
          {resendStatus === 'sending' ? (
            <CircularProgress size={20} />
          ) : cooldown > 0 ? (
            `Resend in ${cooldown}s`
          ) : (
            'Resend Verification Email'
          )}
        </Button>

        {resendStatus === 'sent' && (
          <Typography style={{color: '#4caf50', marginBottom: 8}}>Verification email sent!</Typography>
        )}
        {resendStatus === 'error' && (
          <Typography style={{color: '#d32f2f', marginBottom: 8}}>{resendError}</Typography>
        )}

        <Typography variant="body2" color="textSecondary" style={{marginTop: 16}}>
          Wrong email?{' '}
          <Link to="/account" style={{color: 'inherit'}}>
            Change it in account settings
          </Link>
        </Typography>
      </div>
      <Footer />
    </div>
  );
}

/* eslint-disable react/jsx-no-bind, consistent-return, no-nested-ternary */
import {useContext, useState, useEffect, useRef} from 'react';
import {Helmet} from 'react-helmet-async';
import {useLocation, useNavigate, Link} from 'react-router';
import Nav from '../components/common/Nav';
import Footer from '../components/common/Footer';
import AuthContext from '../lib/AuthContext';
import {verifyEmail, resendVerification} from '../api/auth';

export default function VerifyEmail() {
  const {user, accessToken, refreshUser} = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <Helmet>
          <title>Verify Email - Cross with Friends</title>
        </Helmet>
        <Nav />
        <div className="account--title">Email Verification</div>
        <div className="account--main" style={{textAlign: 'center', paddingTop: 40}}>
          {status === 'verifying' && (
            <>
              <span className="spinner" style={{marginBottom: 16}} />
              <p>Verifying your email...</p>
            </>
          )}
          {status === 'success' && (
            <>
              <h6 className="text-h6" style={{color: '#4caf50', marginBottom: 16}}>
                Email verified!
              </h6>
              <p style={{marginBottom: 24}}>Your email has been verified successfully.</p>
              <button className="btn btn--contained btn--primary" onClick={() => navigate('/')}>
                Go to Home
              </button>
            </>
          )}
          {status === 'error' && (
            <>
              <h6 className="text-h6" style={{color: '#d32f2f', marginBottom: 16}}>
                Verification failed
              </h6>
              <p style={{marginBottom: 24}}>{error || 'The link may be expired or invalid.'}</p>
              {user && !user.emailVerified && (
                <button className="btn btn--contained btn--primary" onClick={() => navigate('/verify-email')}>
                  Request a new link
                </button>
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
      <Helmet>
        <title>Verify Email - Cross with Friends</title>
      </Helmet>
      <Nav />
      <div className="account--title">Verify Your Email</div>
      <div className="account--main" style={{textAlign: 'center', paddingTop: 20}}>
        <p style={{marginBottom: 8}}>
          We sent a verification email to <strong>{user?.email || 'your email address'}</strong>.
        </p>
        <p className="text-secondary" style={{marginBottom: 24}}>
          Check your inbox and click the link to verify your account. If you don&apos;t see it, check your
          spam or junk folder.
        </p>

        <button
          className="btn btn--contained btn--primary"
          onClick={handleResend}
          disabled={resendStatus === 'sending' || cooldown > 0}
          style={{marginBottom: 16}}
        >
          {resendStatus === 'sending' ? (
            <span className="spinner spinner--small" />
          ) : cooldown > 0 ? (
            `Resend in ${cooldown}s`
          ) : (
            'Resend Verification Email'
          )}
        </button>

        {resendStatus === 'sent' && (
          <p style={{color: '#4caf50', marginBottom: 8}}>Verification email sent!</p>
        )}
        {resendStatus === 'error' && <p style={{color: '#d32f2f', marginBottom: 8}}>{resendError}</p>}

        <p className="text-body2 text-secondary" style={{marginTop: 16}}>
          Wrong email?{' '}
          <Link to="/account" style={{color: 'inherit'}}>
            Change it in account settings
          </Link>
        </p>
      </div>
      <Footer />
    </div>
  );
}

/* eslint-disable react/jsx-no-bind */
import {useState} from 'react';
import {Helmet} from 'react-helmet-async';
import {Link} from 'react-router-dom';
import Nav from '../components/common/Nav';
import Footer from '../components/common/Footer';
import {forgotPassword} from '../api/auth';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setError('');
    try {
      await forgotPassword(email);
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  };

  return (
    <div className="account">
      <Helmet>
        <title>Forgot Password - Cross with Friends</title>
      </Helmet>
      <Nav />
      <div className="account--title">Reset Password</div>
      <div className="account--main" style={{paddingTop: 20}}>
        {status === 'sent' ? (
          <div style={{textAlign: 'center'}}>
            <p style={{marginBottom: 16}}>
              If an account exists with that email, we&apos;ve sent a password reset link.
            </p>
            <p className="text-secondary" style={{marginBottom: 24}}>
              Check your inbox and follow the link to reset your password. If you don&apos;t see it, check
              your spam or junk folder. The link expires in 1 hour.
            </p>
            <Link to="/" style={{color: 'inherit'}}>
              Back to home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{maxWidth: 400, margin: '0 auto'}}>
            <p style={{marginBottom: 16}}>
              Enter the email address associated with your account and we&apos;ll send you a link to reset
              your password.
            </p>
            <div className="form-field">
              <label htmlFor="forgot-email">Email</label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {status === 'error' && (
              <span className="text-error text-caption" style={{display: 'block', marginTop: 8}}>
                {error}
              </span>
            )}
            <div
              style={{marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}
            >
              <Link to="/" style={{color: 'inherit', fontSize: 14}}>
                Back to login
              </Link>
              <button
                type="submit"
                className="btn btn--contained btn--primary"
                disabled={status === 'sending'}
              >
                {status === 'sending' ? <span className="spinner spinner--small" /> : 'Send Reset Link'}
              </button>
            </div>
          </form>
        )}
      </div>
      <Footer />
    </div>
  );
}

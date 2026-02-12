import React, {useState} from 'react';
import {Link} from 'react-router-dom';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';
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
      <Nav />
      <div className="account--title">Reset Password</div>
      <div className="account--main" style={{paddingTop: 20}}>
        {status === 'sent' ? (
          <div style={{textAlign: 'center'}}>
            <Typography style={{marginBottom: 16}}>
              If an account exists with that email, we&apos;ve sent a password reset link.
            </Typography>
            <Typography color="textSecondary" style={{marginBottom: 24}}>
              Check your inbox and follow the link to reset your password. If you don&apos;t see it, check
              your spam or junk folder. The link expires in 1 hour.
            </Typography>
            <Link to="/" style={{color: 'inherit'}}>
              Back to home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{maxWidth: 400, margin: '0 auto'}}>
            <Typography style={{marginBottom: 16}}>
              Enter the email address associated with your account and we&apos;ll send you a link to reset
              your password.
            </Typography>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              margin="dense"
              required
            />
            {status === 'error' && (
              <Typography color="error" variant="caption" style={{display: 'block', marginTop: 8}}>
                {error}
              </Typography>
            )}
            <div
              style={{marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}
            >
              <Link to="/" style={{color: 'inherit', fontSize: 14}}>
                Back to login
              </Link>
              <Button type="submit" variant="contained" color="primary" disabled={status === 'sending'}>
                {status === 'sending' ? <CircularProgress size={20} /> : 'Send Reset Link'}
              </Button>
            </div>
          </form>
        )}
      </div>
      <Footer />
    </div>
  );
}

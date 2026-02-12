import React, {useEffect, useContext, useState} from 'react';
import {Link, useHistory, useLocation} from 'react-router-dom';
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';
import AuthContext from '../../lib/AuthContext';
import {getMe} from '../../api/auth';

export default function GoogleCallback() {
  const {handleLoginSuccess} = useContext(AuthContext);
  const history = useHistory();
  const location = useLocation();
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const errorParam = params.get('error');

    if (errorParam) {
      setError(errorParam);
      // Don't auto-redirect — let user read the error and navigate manually
      return;
    }

    if (!token) {
      setError('No authentication token received');
      return;
    }

    (async () => {
      try {
        const user = await getMe(token);
        if (user) {
          await handleLoginSuccess({accessToken: token, user});
        } else {
          setError('Failed to retrieve user info');
        }
      } catch (e) {
        setError('Authentication failed');
      } finally {
        history.replace('/');
      }
    })();
  }, [location.search, handleLoginSuccess, history]);

  if (error) {
    return (
      <div style={{textAlign: 'center', marginTop: 100}}>
        <Typography color="error" style={{marginBottom: 16}}>
          {error}
        </Typography>
        <Link to="/">Go back to home</Link>
      </div>
    );
  }

  return (
    <div style={{textAlign: 'center', marginTop: 100}}>
      <CircularProgress />
      <Typography style={{marginTop: 16}}>Signing you in...</Typography>
    </div>
  );
}

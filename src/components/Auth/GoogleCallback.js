import {useEffect, useContext, useState} from 'react';
import {Link, useNavigate, useLocation} from 'react-router';
import AuthContext from '../../lib/AuthContext';
import {getMe} from '../../api/auth';

export default function GoogleCallback() {
  const {handleLoginSuccess} = useContext(AuthContext);
  const navigate = useNavigate();
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
        if (!user) {
          setError('Failed to retrieve user info');
          return;
        }
        await handleLoginSuccess({accessToken: token, user});
        // Return the user to wherever they kicked off the OAuth flow from
        // (set in LoginModal.handleGoogleLogin). Falls back to '/' if it
        // wasn't set or got mangled. Only same-origin relative paths are
        // accepted so this can't be hijacked into an open-redirect.
        // Navigation only fires on success — leaving it in `finally`
        // unmounted the page mid-error and the user never saw why.
        let returnTo = '/';
        try {
          const stored = sessionStorage.getItem('post_login_return_to');
          sessionStorage.removeItem('post_login_return_to');
          if (stored && stored.startsWith('/') && !stored.startsWith('//')) {
            returnTo = stored;
          }
        } catch {
          // sessionStorage unavailable
        }
        navigate(returnTo, {replace: true});
      } catch (_e) {
        setError('Authentication failed');
      }
    })();
  }, [location.search, handleLoginSuccess, navigate]);

  if (error) {
    return (
      <div style={{textAlign: 'center', marginTop: 100}}>
        <p className="text-error" style={{marginBottom: 16}}>
          {error}
        </p>
        <Link to="/">Go back to home</Link>
      </div>
    );
  }

  return (
    <div style={{textAlign: 'center', marginTop: 100}}>
      <span className="spinner" />
      <p style={{marginTop: 16}}>Signing you in...</p>
    </div>
  );
}

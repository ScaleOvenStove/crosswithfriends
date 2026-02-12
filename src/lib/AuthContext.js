import React, {createContext, useState, useEffect, useCallback, useRef} from 'react';
import {refreshAccessToken, logout as apiLogout, getMe, linkIdentity} from '../api/auth';
import {setSocketAuthToken} from '../sockets/getSocket';
import getLocalId from '../localAuth';

const AuthContext = createContext({});

export function AuthProvider({children}) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef(null);

  // Sync auth token to socket connection
  useEffect(() => {
    setSocketAuthToken(accessToken);
  }, [accessToken]);

  // On mount, try to restore session via refresh token
  useEffect(() => {
    (async () => {
      try {
        const result = await refreshAccessToken();
        if (result) {
          setAccessToken(result.accessToken);
          const me = await getMe(result.accessToken);
          if (me) {
            setUser(me);
            // Auto-link the current dfac-id to the account
            try {
              await linkIdentity(result.accessToken, getLocalId());
            } catch (e) {
              // Non-critical if linking fails
            }
          }
        }
      } catch (e) {
        // No valid session, stay as guest
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Refresh access token before it expires (~14 min)
  useEffect(() => {
    if (accessToken) {
      refreshTimerRef.current = setTimeout(async () => {
        const result = await refreshAccessToken();
        if (result) {
          setAccessToken(result.accessToken);
        }
      }, 14 * 60 * 1000);
    }
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [accessToken]);

  const handleLoginSuccess = useCallback(async (tokens) => {
    setAccessToken(tokens.accessToken);
    setUser(tokens.user);
    // Link current dfac-id to the newly logged-in account
    try {
      await linkIdentity(tokens.accessToken, getLocalId());
    } catch (e) {
      // Non-critical
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await apiLogout();
    setAccessToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!accessToken) return;
    const me = await getMe(accessToken);
    if (me) setUser(me);
  }, [accessToken]);

  const value = {
    user,
    accessToken,
    isAuthenticated: !!user,
    loading,
    handleLoginSuccess,
    handleLogout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;

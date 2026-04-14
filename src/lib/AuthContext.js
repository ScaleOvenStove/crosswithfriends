import {createContext, useState, useEffect, useCallback, useRef} from 'react';
import {refreshAccessToken, logout as apiLogout, getMe, linkIdentity, updatePreferences} from '../api/auth';
import {setSocketAuthToken} from '../sockets/getSocket';
import getLocalId from '../localAuth';

const AuthContext = createContext({});

// Maps server preference keys to localStorage keys
const PREF_STORAGE_MAP = {
  vimMode: {key: 'vim-mode', type: 'json', default: false},
  skipFilledSquares: {key: 'skip-filled-squares', type: 'json', default: true},
  autoAdvanceCursor: {key: 'auto-advance-cursor', type: 'json', default: true},
  showProgress: {key: 'show-progress', type: 'json', default: true},
  darkMode: {key: 'dark_mode_preference', type: 'string', default: '0'},
  colorAttribution: {key: null, type: 'json', default: false},
  sound: {key: 'sound', type: 'json', default: true},
};

function readLocalStoragePrefs() {
  const prefs = {};
  for (const [prefKey, {key, type, default: defaultVal}] of Object.entries(PREF_STORAGE_MAP)) {
    if (!key) continue;
    try {
      const stored = localStorage.getItem(key);
      if (stored != null) {
        prefs[prefKey] = type === 'json' ? JSON.parse(stored) : stored;
      } else {
        prefs[prefKey] = defaultVal;
      }
    } catch {
      prefs[prefKey] = defaultVal;
    }
  }
  return prefs;
}

function writeLocalStoragePrefs(prefs) {
  for (const [prefKey, value] of Object.entries(prefs)) {
    const mapping = PREF_STORAGE_MAP[prefKey];
    if (!mapping?.key) continue;
    try {
      localStorage.setItem(mapping.key, mapping.type === 'json' ? JSON.stringify(value) : value);
    } catch {
      // localStorage may be unavailable
    }
  }
}

function syncPreferences(serverPrefs, accessTokenValue) {
  const hasServerPrefs = serverPrefs && Object.keys(serverPrefs).length > 0;

  if (hasServerPrefs) {
    // Server wins — write server values to localStorage
    writeLocalStoragePrefs(serverPrefs);
    return serverPrefs;
  }

  // Server empty — seed from localStorage
  const localPrefs = readLocalStoragePrefs();
  updatePreferences(accessTokenValue, localPrefs).catch(() => {});
  return localPrefs;
}

export function AuthProvider({children}) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState(null);
  const refreshTimerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const pendingPrefsRef = useRef({});
  const accessTokenRef = useRef(accessToken);

  // Keep ref in sync so debounced callbacks use the latest token
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

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
            const resolved = syncPreferences(me.preferences, result.accessToken);
            setPreferences(resolved);
            // Auto-link the current dfac-id to the account (fire-and-forget, don't block page load)
            linkIdentity(result.accessToken, getLocalId()).catch(() => {});
          }
        }
      } catch (_e) {
        // No valid session, stay as guest
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Refresh access token before it expires (~14 min)
  useEffect(() => {
    if (accessToken) {
      refreshTimerRef.current = setTimeout(
        async () => {
          const result = await refreshAccessToken();
          if (result) {
            setAccessToken(result.accessToken);
          }
        },
        14 * 60 * 1000
      );
    }
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [accessToken]);

  const handleLoginSuccess = useCallback(async (tokens) => {
    setAccessToken(tokens.accessToken);
    setUser(tokens.user);
    const resolved = syncPreferences(tokens.user?.preferences, tokens.accessToken);
    setPreferences(resolved);
    // Link current dfac-id to the newly logged-in account (fire-and-forget)
    linkIdentity(tokens.accessToken, getLocalId()).catch(() => {});
  }, []);

  const handleLogout = useCallback(async () => {
    await apiLogout();
    setAccessToken(null);
    setUser(null);
    setPreferences(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!accessToken) return;
    const me = await getMe(accessToken);
    if (me) setUser(me);
  }, [accessToken]);

  const savePreference = useCallback((key, value) => {
    // Update localStorage immediately
    const mapping = PREF_STORAGE_MAP[key];
    if (mapping?.key) {
      try {
        localStorage.setItem(mapping.key, mapping.type === 'json' ? JSON.stringify(value) : value);
      } catch {
        // localStorage may be unavailable
      }
    }

    // Update local state
    setPreferences((prev) => ({...prev, [key]: value}));

    // Debounced server write for authenticated users
    if (!accessTokenRef.current) return;
    pendingPrefsRef.current[key] = value;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      const pending = {...pendingPrefsRef.current};
      pendingPrefsRef.current = {};
      if (accessTokenRef.current) {
        updatePreferences(accessTokenRef.current, pending).catch(() => {});
      }
    }, 500);
  }, []);

  const value = {
    user,
    accessToken,
    isAuthenticated: !!user,
    loading,
    handleLoginSuccess,
    handleLogout,
    refreshUser,
    preferences,
    savePreference,
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export default AuthContext;

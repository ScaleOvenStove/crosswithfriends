/**
 * Firebase Configuration
 * SECURITY: All Firebase credentials come from environment variables
 * Never hardcode API keys or secrets per codeguard-1-hardcoded-credentials
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import type { Database } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import type { FirebaseStorage } from 'firebase/storage';
import { getAnalytics, type Analytics } from 'firebase/analytics';
import { config } from '@config/index';

// Validate Firebase configuration from environment variables
const validateFirebaseConfig = () => {
  const requiredKeys = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ];

  const missingKeys = requiredKeys.filter(
    (key) => !config.firebase[key as keyof typeof config.firebase]
  );

  if (missingKeys.length > 0) {
    console.warn(
      `[Firebase] Missing configuration keys: ${missingKeys.join(', ')}. ` +
        'Firebase features may not work. Set VITE_FIREBASE_* environment variables.'
    );
    return false;
  }

  return true;
};

// Firebase configuration object from environment variables
// Per codeguard-1-hardcoded-credentials: NEVER hardcode these values
const firebaseConfig = {
  apiKey: config.firebase.apiKey,
  authDomain: config.firebase.authDomain,
  databaseURL: config.firebase.databaseURL,
  projectId: config.firebase.projectId,
  storageBucket: config.firebase.storageBucket,
  messagingSenderId: config.firebase.messagingSenderId,
  appId: config.firebase.appId,
};

// Initialize Firebase
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let database: Database | null = null;
let storage: FirebaseStorage | null = null;
let analytics: Analytics | null = null;

// Check if Firebase should be initialized
const isFirebaseConfigured = validateFirebaseConfig();

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    database = getDatabase(app);
    storage = getStorage(app);

    // Initialize Analytics only in browser environment
    if (typeof window !== 'undefined') {
      try {
        analytics = getAnalytics(app);
        console.log('[Firebase] Analytics initialized');
      } catch (analyticsError) {
        // Analytics may fail in some environments (e.g., SSR, localhost without proper setup)
        console.warn('[Firebase] Analytics initialization skipped:', analyticsError);
      }
    }

    console.log('[Firebase] Initialized successfully');
  } catch (error) {
    console.error('[Firebase] Initialization error:', error);
  }
} else {
  console.warn('[Firebase] Skipping initialization due to missing configuration');
}

export { app, auth, database, storage, analytics, isFirebaseConfigured };
export default app;

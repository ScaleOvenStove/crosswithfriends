/**
 * Firebase Admin SDK Initialization
 * Used to verify Firebase ID tokens from the frontend
 */

import admin from 'firebase-admin';
import {logger} from './logger.js';
import {isInsecureModeAllowed} from './securityValidation.js';

let firebaseAdminInitialized = false;

/**
 * Initialize Firebase Admin SDK
 * Can be called multiple times safely (idempotent)
 */
export async function initializeFirebaseAdmin(): Promise<void> {
  if (firebaseAdminInitialized) {
    return;
  }

  // Check if admin module is loaded
  if (!admin || typeof admin !== 'object') {
    logger.warn('Firebase Admin module not loaded properly');
    return;
  }

  // Check if already initialized
  try {
    if (admin.apps && Array.isArray(admin.apps) && admin.apps.length > 0) {
      firebaseAdminInitialized = true;
      logger.info('Firebase Admin already initialized');
      return;
    }
  } catch (error) {
    // If apps property doesn't exist or isn't accessible, continue with initialization
    logger.debug({err: error}, 'Could not check existing Firebase Admin apps');
  }

  try {
    // Try to initialize with service account credentials
    // First check for explicit credentials file path
    const credentialsPath = process.env.FIREBASE_CREDENTIALS_PATH;
    if (credentialsPath) {
      // For ES modules, we need to use createRequire or read the file
      // Using fs.readFileSync for simplicity
      const fs = await import('fs');
      const path = await import('path');
      const serviceAccountPath = path.resolve(credentialsPath);
      const serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf8');
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      logger.info('Firebase Admin initialized with credentials file');
      firebaseAdminInitialized = true;
      return;
    }

    // Try to initialize with service account JSON in environment variable
    const credentialsJson = process.env.FIREBASE_CREDENTIALS_JSON;
    if (credentialsJson) {
      const serviceAccount = JSON.parse(credentialsJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      logger.info('Firebase Admin initialized with credentials JSON');
      firebaseAdminInitialized = true;
      return;
    }

    // Try to use default credentials (for GCP environments)
    // This will work if running on GCP or if GOOGLE_APPLICATION_CREDENTIALS is set
    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      logger.info('Firebase Admin initialized with application default credentials');
      firebaseAdminInitialized = true;
      return;
    } catch (defaultCredsError) {
      // Application default credentials not available
      logger.debug('Application default credentials not available');
    }

    // If no credentials found, log a warning but don't fail
    // This allows the server to start without Firebase (for development)
    logger.warn(
      'Firebase Admin not initialized: No credentials found. ' +
        'Set FIREBASE_CREDENTIALS_PATH, FIREBASE_CREDENTIALS_JSON, or GOOGLE_APPLICATION_CREDENTIALS. ' +
        'Firebase token verification will be disabled.'
    );
  } catch (error) {
    logger.error({err: error}, 'Failed to initialize Firebase Admin');
    // Don't throw - allow server to start without Firebase
  }
}

/**
 * Verify a Firebase ID token (development mode: decode without verification)
 * @param idToken - Firebase ID token string
 * @returns Decoded token with user ID, or null if invalid
 */
export async function verifyFirebaseToken(idToken: string): Promise<{uid: string; email?: string} | null> {
  // If Firebase Admin is initialized, use it for proper verification
  if (firebaseAdminInitialized) {
    // Check if apps exist and are initialized
    try {
      if (admin.apps && admin.apps.length > 0) {
        try {
          const decodedToken = await admin.auth().verifyIdToken(idToken);
          return {
            uid: decodedToken.uid,
            email: decodedToken.email,
          };
        } catch (error) {
          logger.debug({err: error}, 'Firebase token verification failed');
          return null;
        }
      }
    } catch {
      // Fall through to development mode
    }
  }

  // Development mode: decode token without verification (INSECURE - only for dev!)
  // This allows the server to work without Firebase Admin credentials
  // SECURITY: Use centralized check to prevent bypass in production
  if (isInsecureModeAllowed()) {
    try {
      // Decode JWT without verification (just extract the payload)
      const parts = idToken.split('.');
      if (parts.length !== 3 || !parts[1]) {
        return null;
      }

      const payloadB64 = parts[1];
      // payloadB64 is guaranteed to be string here due to check above
      const payloadJson = Buffer.from(payloadB64 as string, 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson) as {
        sub?: string;
        user_id?: string;
        uid?: string;
        email?: string;
      };

      // Firebase tokens use 'sub' or 'user_id' for the UID
      const uid = payload.sub || payload.user_id || payload.uid;
      if (!uid || typeof uid !== 'string') {
        logger.debug('Firebase token missing UID in payload');
        return null;
      }

      logger.warn({uid}, 'Firebase token decoded without verification (development mode only - INSECURE)');

      return {
        uid,
        email: payload.email,
      };
    } catch (error) {
      logger.debug({err: error}, 'Failed to decode Firebase token (development mode)');
      return null;
    }
  }

  logger.debug('Firebase Admin not initialized and not in development mode, cannot verify token');
  return null;
}

/**
 * Check if Firebase Admin is initialized
 */
export function isFirebaseAdminInitialized(): boolean {
  if (!firebaseAdminInitialized) {
    return false;
  }

  try {
    return admin.apps && admin.apps.length > 0;
  } catch {
    return false;
  }
}

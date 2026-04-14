import * as Sentry from '@sentry/node';
import bcrypt from 'bcrypt';
import express from 'express';
import Joi from 'joi';
import rateLimit, {ipKeyGenerator} from 'express-rate-limit';
import passport from '../auth/passport';
import {signAccessToken, verifyAccessToken} from '../auth/jwt';
import {requireAuth} from '../auth/middleware';
import {
  createLocalUser,
  getUserProfile,
  linkDfacId,
  updateDisplayName,
  updateEmail,
  updatePasswordHash,
  setPasswordHash,
  linkGoogleAccount,
  unlinkGoogleAccount,
  softDeleteUser,
  verifyPassword,
  markEmailVerified,
  findUserByEmail,
  updateProfileVisibility,
  updateUserPreferences,
  EmailCollisionError,
  UserRow,
} from '../model/user';
import {
  createRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
} from '../model/refresh_token';
import {
  createVerificationToken,
  validateVerificationToken,
  wasVerificationTokenRecentlyCreated,
  createPasswordResetToken,
  validatePasswordResetToken,
} from '../model/email_token';
import {sendVerificationEmail, sendPasswordResetEmail} from '../model/mailer';
import {pool} from '../model/pool';
import {backfillSolvesForDfacId} from '../model/puzzle_solve';
import {invalidateAuthPuzzleStatusCache} from '../model/user_games';

const router = express.Router();
const BCRYPT_ROUNDS = 12;

const REFRESH_COOKIE = 'cwf_refresh';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth',
};

const frontendOrigin = () =>
  process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3020');

const signupSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  displayName: Joi.string().min(1).max(64).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// Strict limit for unauthenticated credential endpoints (signup, login, password reset)
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {error: 'Too many requests, please try again later'},
});

// Key by user ID when authenticated, fall back to normalized IP for unauthenticated requests.
// ipKeyGenerator handles IPv6-mapped IPv4 addresses (e.g. ::ffff:127.0.0.1 → 127.0.0.1)
const userOrIpKey = (req: express.Request) => req.authUser?.userId || ipKeyGenerator(req.ip || 'unknown');

// Moderate limit for email-sending endpoints (verification, password reset)
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 emails per window
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: {error: 'Too many requests, please try again later'},
});

// General limit for authenticated account-mutation endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: {error: 'Too many requests, please try again later'},
});

function buildTokenResponse(user: UserRow, accessToken: string) {
  return {
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      emailVerified: !!user.email_verified_at,
      authProvider: user.auth_provider,
      hasPassword: !!user.password_hash,
      hasGoogle: !!user.oauth_id,
      profileIsPublic: !!user.profile_is_public,
      preferences: user.preferences || {},
    },
  };
}

/**
 * @openapi
 * /auth/signup:
 *   post:
 *     tags: [Auth]
 *     summary: Create a new account
 *     description: Register with email, password, and display name. Returns JWT tokens and sends a verification email.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, displayName]
 *             properties:
 *               email: {type: string, format: email}
 *               password: {type: string, minLength: 8, maxLength: 128}
 *               displayName: {type: string, minLength: 1, maxLength: 64}
 *     responses:
 *       200:
 *         description: Account created successfully
 *         content:
 *           application/json:
 *             schema: {$ref: '#/components/schemas/AuthResponse'}
 *       400: {description: Validation error}
 *       409: {description: Email already exists}
 *       429: {description: Rate limited (10 req/15min)}
 */
router.post('/signup', strictLimiter, async (req, res, next) => {
  try {
    const {error, value} = signupSchema.validate(req.body);
    if (error) {
      res.status(400).json({error: error.details[0].message});
      return;
    }

    const user = await createLocalUser(value.email, value.password, value.displayName);
    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      displayName: user.display_name,
    });
    const refreshToken = await createRefreshToken(user.id);

    // Send verification email (non-blocking — don't fail signup if email fails)
    const verificationToken = await createVerificationToken(user.id);
    sendVerificationEmail(user.email!, verificationToken).catch((emailErr) => {
      Sentry.captureException(emailErr);
      console.error('Failed to send verification email:', emailErr);
    });

    res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json(buildTokenResponse(user, accessToken));
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({error: 'An account with this email already exists'});
      return;
    }
    next(err);
  }
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password
 *     description: Authenticate and receive a JWT access token. A refresh token is set as an httpOnly cookie.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: {type: string, format: email}
 *               password: {type: string}
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema: {$ref: '#/components/schemas/AuthResponse'}
 *       400: {description: Validation error}
 *       401: {description: Invalid email or password}
 *       429: {description: Rate limited (10 req/15min)}
 */
router.post('/login', strictLimiter, (req, res, next) => {
  const {error} = loginSchema.validate(req.body);
  if (error) {
    res.status(400).json({error: error.details[0].message});
    return;
  }

  passport.authenticate('local', {session: false}, async (err: any, user: UserRow | false, info: any) => {
    if (err) {
      next(err);
      return;
    }
    if (!user) {
      res.status(401).json({error: info?.message || 'Invalid email or password'});
      return;
    }

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      displayName: user.display_name,
    });
    const refreshToken = await createRefreshToken(user.id);

    res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json(buildTokenResponse(user, accessToken));
  })(req, res, next);
});

/**
 * @openapi
 * /auth/google:
 *   get:
 *     tags: [Auth]
 *     summary: Initiate Google OAuth login
 *     description: Redirects to Google's OAuth consent screen. On success, redirects back with a token query param.
 *     responses:
 *       302: {description: Redirect to Google OAuth}
 *       501: {description: Google OAuth not configured}
 *       429: {description: Rate limited}
 */
router.get('/google', strictLimiter, (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    res.status(501).json({error: 'Google OAuth is not configured on this server'});
    return;
  }
  passport.authenticate('google', {scope: ['profile', 'email'], session: false})(req, res, next);
});

// Google OAuth callback (internal — not documented in API docs)
router.get(
  '/google/callback',
  (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      res.redirect('/');
      return;
    }

    // Check if this is a link-google flow (state param contains JWT with userId)
    const state = req.query.state as string | undefined;
    let linkUserId: string | null = null;
    if (state) {
      const payload = verifyAccessToken(state);
      if (payload) linkUserId = payload.userId;
    }

    passport.authenticate(
      'google',
      {session: false, failureRedirect: '/'},
      async (err: any, user: UserRow | false, info: any) => {
        if (err) {
          // Redirect errors to frontend instead of falling through to Express error handler
          const errorMsg = err.message || 'Google authentication failed';
          if (linkUserId) {
            res.redirect(`${frontendOrigin()}/account?error=${encodeURIComponent(errorMsg)}`);
          } else {
            res.redirect(`${frontendOrigin()}/auth/google/callback?error=${encodeURIComponent(errorMsg)}`);
          }
          return;
        }

        // Handle link-google flow
        if (linkUserId) {
          // Determine the Google oauth_id — either from the user passport returned,
          // or from info.googleId if there was an email collision (user's own email)
          const googleId = (user && user.oauth_id) || info?.googleId;

          if (!googleId) {
            const errorMsg = info?.message || 'Failed to link Google account';
            res.redirect(`${frontendOrigin()}/account?error=${encodeURIComponent(errorMsg)}`);
            return;
          }

          try {
            await linkGoogleAccount(linkUserId, googleId);
            // If passport auto-created a new Google user, clean it up
            if (user && user.id !== linkUserId) {
              await pool.query(`UPDATE users SET deleted_at = NOW() WHERE id = $1`, [user.id]);
            }
            res.redirect(
              `${frontendOrigin()}/account?success=${encodeURIComponent('Google account linked')}`
            );
          } catch (linkErr: any) {
            res.redirect(
              `${frontendOrigin()}/account?error=${encodeURIComponent(
                linkErr.message || 'Failed to link Google account'
              )}`
            );
          }
          return;
        }

        // Normal login flow
        if (!user) {
          // Email collision or other failure — redirect with error message
          const errorMsg = info?.message || 'Google authentication failed';
          res.redirect(`${frontendOrigin()}/auth/google/callback?error=${encodeURIComponent(errorMsg)}`);
          return;
        }
        req.user = user;
        next();
      }
    )(req, res, next);
  },
  async (req, res) => {
    const user = req.user as UserRow;
    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      displayName: user.display_name,
    });
    const refreshToken = await createRefreshToken(user.id);

    res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
    res.redirect(`${frontendOrigin()}/auth/google/callback?token=${encodeURIComponent(accessToken)}`);
  }
);

/**
 * @openapi
 * /auth/link-google:
 *   get:
 *     tags: [Auth]
 *     summary: Link Google account to existing user
 *     description: Initiates Google OAuth flow to link a Google account to the authenticated user. Requires a token query param.
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema: {type: string}
 *         description: JWT access token
 *     responses:
 *       302: {description: Redirect to Google OAuth}
 *       401: {description: Missing or invalid token}
 *       501: {description: Google OAuth not configured}
 */
router.get('/link-google', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    res.status(501).json({error: 'Google OAuth is not configured on this server'});
    return;
  }
  const token = req.query.token as string;
  if (!token) {
    res.status(401).json({error: 'Authentication required'});
    return;
  }
  const payload = verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({error: 'Invalid token'});
    return;
  }
  // Use the JWT as the state param so the callback knows this is a link flow
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    state: token,
  })(req, res);
});

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     description: Exchange the httpOnly refresh cookie for a new access token. The refresh token is rotated.
 *     responses:
 *       200:
 *         description: New access token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken: {type: string}
 *       401: {description: No or invalid refresh token}
 */
router.post('/refresh', async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) {
    res.status(401).json({error: 'No refresh token'});
    return;
  }

  const userId = await validateRefreshToken(token);
  if (!userId) {
    res.clearCookie(REFRESH_COOKIE, {path: '/api/auth'});
    res.status(401).json({error: 'Invalid or expired refresh token'});
    return;
  }

  const user = await getUserProfile(userId);
  if (!user) {
    res.clearCookie(REFRESH_COOKIE, {path: '/api/auth'});
    res.status(401).json({error: 'User not found'});
    return;
  }

  // Rotate refresh token
  await revokeRefreshToken(token);
  const newRefreshToken = await createRefreshToken(userId);
  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    displayName: user.display_name,
  });

  res.cookie(REFRESH_COOKIE, newRefreshToken, REFRESH_COOKIE_OPTIONS);
  res.json({accessToken});
});

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Log out
 *     description: Revokes the refresh token cookie and clears the cookie.
 *     responses:
 *       200:
 *         description: Logged out
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: {type: boolean}
 */
router.post('/logout', async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    await revokeRefreshToken(token);
  }
  res.clearCookie(REFRESH_COOKIE, {path: '/api/auth'});
  res.json({ok: true});
});

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 *     security: [{bearerAuth: []}]
 *     responses:
 *       200:
 *         description: Current user info
 *         content:
 *           application/json:
 *             schema: {$ref: '#/components/schemas/UserProfile'}
 *       401: {description: Not authenticated}
 *       404: {description: User not found}
 */
router.get('/me', requireAuth, async (req, res) => {
  const user = await getUserProfile(req.authUser!.userId);
  if (!user) {
    res.status(404).json({error: 'User not found'});
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    emailVerified: !!user.email_verified_at,
    authProvider: user.auth_provider,
    hasPassword: user.has_password,
    hasGoogle: user.has_google,
    profileIsPublic: !!user.profile_is_public,
    preferences: user.preferences || {},
  });
});

/**
 * @openapi
 * /auth/change-display-name:
 *   post:
 *     tags: [Auth]
 *     summary: Change display name
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [displayName]
 *             properties:
 *               displayName: {type: string, minLength: 1, maxLength: 64}
 *     responses:
 *       200:
 *         description: Display name updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: {type: boolean}
 *                 displayName: {type: string}
 *       400: {description: Invalid display name}
 *       429: {description: Rate limited (30 req/15min)}
 */
router.post('/change-display-name', authLimiter, requireAuth, async (req, res) => {
  const {displayName} = req.body;
  if (!displayName || typeof displayName !== 'string' || displayName.length < 1 || displayName.length > 64) {
    res.status(400).json({error: 'Display name must be 1-64 characters'});
    return;
  }
  await updateDisplayName(req.authUser!.userId, displayName);
  res.json({ok: true, displayName});
});

/**
 * @openapi
 * /auth/profile-visibility:
 *   post:
 *     tags: [Auth]
 *     summary: Set profile visibility
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isPublic]
 *             properties:
 *               isPublic: {type: boolean}
 *     responses:
 *       200:
 *         description: Visibility updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: {type: boolean}
 *                 profileIsPublic: {type: boolean}
 *       400: {description: Invalid input}
 *       429: {description: Rate limited}
 */
router.post('/profile-visibility', authLimiter, requireAuth, async (req, res) => {
  const {isPublic} = req.body;
  if (typeof isPublic !== 'boolean') {
    res.status(400).json({error: 'isPublic must be a boolean'});
    return;
  }
  await updateProfileVisibility(req.authUser!.userId, isPublic);
  res.json({ok: true, profileIsPublic: isPublic});
});

const preferencesSchema = Joi.object({
  vimMode: Joi.boolean(),
  skipFilledSquares: Joi.boolean(),
  autoAdvanceCursor: Joi.boolean(),
  showProgress: Joi.boolean(),
  darkMode: Joi.string().valid('0', '1', '2'),
  colorAttribution: Joi.boolean(),
  sound: Joi.boolean(),
}).unknown(false);

/**
 * @openapi
 * /auth/preferences:
 *   put:
 *     tags: [Auth]
 *     summary: Update user game preferences
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               vimMode: {type: boolean}
 *               skipFilledSquares: {type: boolean}
 *               autoAdvanceCursor: {type: boolean}
 *               showProgress: {type: boolean}
 *               darkMode: {type: string, enum: ['0', '1', '2']}
 *               colorAttribution: {type: boolean}
 *               sound: {type: boolean}
 *     responses:
 *       200:
 *         description: Preferences updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: {type: boolean}
 *                 preferences: {type: object}
 *       400: {description: Invalid input}
 *       429: {description: Rate limited}
 */
router.put('/preferences', authLimiter, requireAuth, async (req, res) => {
  const {error, value} = preferencesSchema.validate(req.body);
  if (error) {
    res.status(400).json({error: error.details[0].message});
    return;
  }
  const updated = await updateUserPreferences(req.authUser!.userId, value);
  res.json({ok: true, preferences: updated});
});

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change password
 *     description: Change password for users who already have one set. Revokes all refresh tokens and issues a new one.
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: {type: string}
 *               newPassword: {type: string, minLength: 8, maxLength: 128}
 *     responses:
 *       200:
 *         description: Password changed, new access token issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: {type: boolean}
 *                 accessToken: {type: string}
 *       400: {description: Missing fields or no password set}
 *       401: {description: Current password incorrect}
 *       429: {description: Rate limited}
 */
router.post('/change-password', authLimiter, requireAuth, async (req, res, next) => {
  try {
    const {currentPassword, newPassword} = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({error: 'Current password and new password are required'});
      return;
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
      res.status(400).json({error: 'New password must be 8-128 characters'});
      return;
    }

    const user = await getUserProfile(req.authUser!.userId);
    if (!user || !user.has_password) {
      res.status(400).json({error: 'No password set on this account'});
      return;
    }

    const valid = await verifyPassword(currentPassword, user.password_hash!);
    if (!valid) {
      res.status(401).json({error: 'Current password is incorrect'});
      return;
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await updatePasswordHash(req.authUser!.userId, newHash);

    // Revoke all existing refresh tokens and issue a new one
    await revokeAllUserTokens(req.authUser!.userId);
    const refreshToken = await createRefreshToken(req.authUser!.userId);
    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      displayName: user.display_name,
    });

    res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ok: true, accessToken});
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /auth/set-password:
 *   post:
 *     tags: [Auth]
 *     summary: Set password (Google-only users)
 *     description: Allows users who signed up via Google to add a password to their account.
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: {type: string, minLength: 8, maxLength: 128}
 *     responses:
 *       200:
 *         description: Password set
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: {type: boolean}
 *       400: {description: Invalid password or password already set}
 *       429: {description: Rate limited}
 */
router.post('/set-password', authLimiter, requireAuth, async (req, res, next) => {
  try {
    const {password} = req.body;
    if (!password || typeof password !== 'string' || password.length < 8 || password.length > 128) {
      res.status(400).json({error: 'Password must be 8-128 characters'});
      return;
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const updated = await setPasswordHash(req.authUser!.userId, hash);
    if (!updated) {
      res.status(400).json({error: 'Password is already set on this account'});
      return;
    }

    res.json({ok: true});
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /auth/change-email:
 *   post:
 *     tags: [Auth]
 *     summary: Change email address
 *     description: Sends a verification email to the new address. Email is updated after verification.
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newEmail, password]
 *             properties:
 *               newEmail: {type: string, format: email}
 *               password: {type: string}
 *     responses:
 *       200:
 *         description: Verification email sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: {type: boolean}
 *                 message: {type: string}
 *       400: {description: Invalid email or no password set}
 *       401: {description: Password incorrect}
 *       409: {description: Email already in use}
 *       429: {description: Rate limited (5 emails/15min)}
 */
router.post('/change-email', emailLimiter, requireAuth, async (req, res, next) => {
  try {
    const {newEmail, password} = req.body;
    const emailValidation = Joi.string().email().validate(newEmail);
    if (!newEmail || emailValidation.error) {
      res.status(400).json({error: 'Invalid email format'});
      return;
    }
    if (!password) {
      res.status(400).json({error: 'Password is required to change email'});
      return;
    }

    const user = await getUserProfile(req.authUser!.userId);
    if (!user || !user.has_password) {
      res.status(400).json({error: 'Set a password before changing your email'});
      return;
    }

    const valid = await verifyPassword(password, user.password_hash!);
    if (!valid) {
      res.status(401).json({error: 'Password is incorrect'});
      return;
    }

    // Check if the new email is already taken before sending verification
    const existingUser = await findUserByEmail(emailValidation.value);
    if (existingUser && existingUser.id !== req.authUser!.userId) {
      res.status(409).json({error: 'An account with this email already exists'});
      return;
    }

    // Send verification to the new email instead of changing immediately
    const token = await createVerificationToken(req.authUser!.userId, emailValidation.value);
    await sendVerificationEmail(emailValidation.value, token, true);
    res.json({ok: true, message: 'Verification email sent to your new address'});
  } catch (err) {
    if (err instanceof EmailCollisionError) {
      res.status(409).json({error: err.message});
      return;
    }
    next(err);
  }
});

/**
 * @openapi
 * /auth/unlink-google:
 *   post:
 *     tags: [Auth]
 *     summary: Unlink Google account
 *     description: Remove Google OAuth from the account. Requires a password to be set first (must keep at least one login method).
 *     security: [{bearerAuth: []}]
 *     responses:
 *       200:
 *         description: Google account unlinked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: {type: boolean}
 *       400: {description: No Google account linked or no password set}
 *       404: {description: User not found}
 *       429: {description: Rate limited}
 */
router.post('/unlink-google', authLimiter, requireAuth, async (req, res, next) => {
  try {
    const user = await getUserProfile(req.authUser!.userId);
    if (!user) {
      res.status(404).json({error: 'User not found'});
      return;
    }
    if (!user.has_google) {
      res.status(400).json({error: 'No Google account linked'});
      return;
    }
    if (!user.has_password) {
      res
        .status(400)
        .json({error: 'Set a password before unlinking Google (you need at least one login method)'});
      return;
    }

    await unlinkGoogleAccount(req.authUser!.userId);
    res.json({ok: true});
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /auth/delete-account:
 *   post:
 *     tags: [Auth]
 *     summary: Delete account
 *     description: Soft-deletes the user account. Requires password confirmation if the user has a password.
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password: {type: string, description: Required if the account has a password}
 *     responses:
 *       200:
 *         description: Account deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: {type: boolean}
 *       400: {description: Password required but not provided}
 *       401: {description: Password incorrect}
 *       404: {description: User not found}
 *       429: {description: Rate limited}
 */
router.post('/delete-account', authLimiter, requireAuth, async (req, res, next) => {
  try {
    const {password} = req.body;
    const user = await getUserProfile(req.authUser!.userId);
    if (!user) {
      res.status(404).json({error: 'User not found'});
      return;
    }

    // If user has a password, require it for confirmation
    if (user.has_password) {
      if (!password) {
        res.status(400).json({error: 'Password is required to delete your account'});
        return;
      }
      const valid = await verifyPassword(password, user.password_hash!);
      if (!valid) {
        res.status(401).json({error: 'Password is incorrect'});
        return;
      }
    }

    await revokeAllUserTokens(req.authUser!.userId);
    await softDeleteUser(req.authUser!.userId);

    res.clearCookie(REFRESH_COOKIE, {path: '/api/auth'});
    res.json({ok: true});
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /auth/verify-email:
 *   post:
 *     tags: [Auth]
 *     summary: Verify email address
 *     description: Verify an email address using the token from the verification email link.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: {type: string}
 *     responses:
 *       200:
 *         description: Email verified
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: {type: boolean}
 *                 message: {type: string}
 *       400: {description: Invalid or expired token}
 *       409: {description: Email collision during email change}
 *       429: {description: Rate limited}
 */
router.post('/verify-email', strictLimiter, async (req, res, next) => {
  try {
    const {token} = req.body;
    if (!token || typeof token !== 'string') {
      res.status(400).json({error: 'Token is required'});
      return;
    }

    const result = await validateVerificationToken(token);
    if (!result) {
      res.status(400).json({error: 'Invalid or expired verification link'});
      return;
    }

    // If this is an email change verification, update the email
    if (result.newEmail) {
      await updateEmail(result.userId, result.newEmail);
    }

    await markEmailVerified(result.userId);
    res.json({ok: true, message: 'Email verified'});
  } catch (err) {
    if (err instanceof EmailCollisionError) {
      res.status(409).json({error: err.message});
      return;
    }
    next(err);
  }
});

/**
 * @openapi
 * /auth/resend-verification:
 *   post:
 *     tags: [Auth]
 *     summary: Resend verification email
 *     description: Resend the email verification link. Throttled to one email per 60 seconds.
 *     security: [{bearerAuth: []}]
 *     responses:
 *       200:
 *         description: Verification email sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: {type: boolean}
 *                 message: {type: string}
 *       400: {description: Email already verified}
 *       404: {description: User not found}
 *       429: {description: Rate limited or too soon since last request}
 */
router.post('/resend-verification', emailLimiter, requireAuth, async (req, res, next) => {
  try {
    const user = await getUserProfile(req.authUser!.userId);
    if (!user) {
      res.status(404).json({error: 'User not found'});
      return;
    }
    if (user.email_verified_at) {
      res.status(400).json({error: 'Email is already verified'});
      return;
    }

    // Rate limit: only allow resend if last token was created >60s ago
    const recentlyCreated = await wasVerificationTokenRecentlyCreated(req.authUser!.userId);
    if (recentlyCreated) {
      res.status(429).json({error: 'Please wait before requesting another verification email'});
      return;
    }

    const token = await createVerificationToken(req.authUser!.userId);
    await sendVerificationEmail(user.email!, token);
    res.json({ok: true, message: 'Verification email sent'});
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset
 *     description: Sends a password reset email if the account exists. Always returns 200 to prevent email enumeration.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: {type: string, format: email}
 *     responses:
 *       200:
 *         description: Reset email sent (if account exists)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: {type: boolean}
 *                 message: {type: string}
 *       429: {description: Rate limited (5 emails/15min)}
 */
router.post('/forgot-password', emailLimiter, async (req, res, next) => {
  try {
    const {email} = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({error: 'Email is required'});
      return;
    }

    // Always return 200 to prevent email enumeration
    const user = await findUserByEmail(email);
    if (user && user.password_hash) {
      const token = await createPasswordResetToken(user.id);
      sendPasswordResetEmail(user.email!, token).catch((emailErr) => {
        Sentry.captureException(emailErr);
        console.error('Failed to send password reset email:', emailErr);
      });
    }

    res.json({ok: true, message: 'If an account exists with that email, we sent a reset link'});
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password with token
 *     description: Reset password using the token from the password reset email. Revokes all existing sessions.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token: {type: string}
 *               newPassword: {type: string, minLength: 8, maxLength: 128}
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: {type: boolean}
 *                 message: {type: string}
 *       400: {description: Invalid token or password}
 *       429: {description: Rate limited}
 */
router.post('/reset-password', strictLimiter, async (req, res, next) => {
  try {
    const {token, newPassword} = req.body;
    if (!token || typeof token !== 'string') {
      res.status(400).json({error: 'Token is required'});
      return;
    }
    if (
      !newPassword ||
      typeof newPassword !== 'string' ||
      newPassword.length < 8 ||
      newPassword.length > 128
    ) {
      res.status(400).json({error: 'Password must be 8-128 characters'});
      return;
    }

    const result = await validatePasswordResetToken(token);
    if (!result) {
      res.status(400).json({error: 'Invalid or expired reset link'});
      return;
    }

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await updatePasswordHash(result.userId, hash);

    // Revoke all refresh tokens to log out other sessions
    await revokeAllUserTokens(result.userId);

    res.json({ok: true, message: 'Password reset successfully'});
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /auth/link-identity:
 *   post:
 *     tags: [Auth]
 *     summary: Link legacy identity
 *     description: Link a legacy dfac_id to the authenticated user account and backfill solve history.
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dfacId]
 *             properties:
 *               dfacId: {type: string}
 *     responses:
 *       200:
 *         description: Identity linked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: {type: boolean}
 *                 backfilledSolves: {type: integer}
 *       400: {description: Missing dfacId}
 *       429: {description: Rate limited}
 */
router.post('/link-identity', authLimiter, requireAuth, async (req, res) => {
  const {dfacId} = req.body;
  if (!dfacId || typeof dfacId !== 'string') {
    res.status(400).json({error: 'dfacId is required'});
    return;
  }
  await linkDfacId(req.authUser!.userId, dfacId);
  // Always attempt backfill — catches anonymous solves created after initial link.
  // Uses ON CONFLICT DO NOTHING so repeated calls are safe.
  const backfilled = await backfillSolvesForDfacId(req.authUser!.userId, dfacId);
  if (backfilled > 0) {
    invalidateAuthPuzzleStatusCache(req.authUser!.userId);
  }
  res.json({ok: true, backfilledSolves: backfilled});
});

export default router;

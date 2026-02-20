import bcrypt from 'bcrypt';
import express from 'express';
import Joi from 'joi';
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

const router = express.Router();
const BCRYPT_ROUNDS = 12;

const REFRESH_COOKIE = 'cwf_refresh';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
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
    },
  };
}

// POST /api/auth/signup
router.post('/signup', async (req, res, next) => {
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

// POST /api/auth/login
router.post('/login', (req, res, next) => {
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

// GET /api/auth/google — initiate Google OAuth
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    res.status(501).json({error: 'Google OAuth is not configured on this server'});
    return;
  }
  passport.authenticate('google', {scope: ['profile', 'email'], session: false})(req, res, next);
});

// GET /api/auth/google/callback — Google OAuth callback
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

// GET /api/auth/link-google — initiate Google OAuth for account linking
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

// POST /api/auth/refresh — exchange refresh token for new access token
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

// POST /api/auth/logout — revoke refresh token
router.post('/logout', async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    await revokeRefreshToken(token);
  }
  res.clearCookie(REFRESH_COOKIE, {path: '/api/auth'});
  res.json({ok: true});
});

// GET /api/auth/me — get current user info
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
  });
});

// POST /api/auth/change-display-name
router.post('/change-display-name', requireAuth, async (req, res) => {
  const {displayName} = req.body;
  if (!displayName || typeof displayName !== 'string' || displayName.length < 1 || displayName.length > 64) {
    res.status(400).json({error: 'Display name must be 1-64 characters'});
    return;
  }
  await updateDisplayName(req.authUser!.userId, displayName);
  res.json({ok: true, displayName});
});

// POST /api/auth/profile-visibility
router.post('/profile-visibility', requireAuth, async (req, res) => {
  const {isPublic} = req.body;
  if (typeof isPublic !== 'boolean') {
    res.status(400).json({error: 'isPublic must be a boolean'});
    return;
  }
  await updateProfileVisibility(req.authUser!.userId, isPublic);
  res.json({ok: true, profileIsPublic: isPublic});
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res, next) => {
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

// POST /api/auth/set-password — for Google-only users to add a password
router.post('/set-password', requireAuth, async (req, res, next) => {
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

// POST /api/auth/change-email
router.post('/change-email', requireAuth, async (req, res, next) => {
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

// POST /api/auth/unlink-google — remove Google OAuth from account
router.post('/unlink-google', requireAuth, async (req, res, next) => {
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

// POST /api/auth/delete-account — soft-delete the user's account
router.post('/delete-account', requireAuth, async (req, res, next) => {
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

// POST /api/auth/verify-email — verify email with token from email link
router.post('/verify-email', async (req, res, next) => {
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

// POST /api/auth/resend-verification — resend verification email
router.post('/resend-verification', requireAuth, async (req, res, next) => {
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

// POST /api/auth/forgot-password — request a password reset email
router.post('/forgot-password', async (req, res, next) => {
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
        console.error('Failed to send password reset email:', emailErr);
      });
    }

    res.json({ok: true, message: 'If an account exists with that email, we sent a reset link'});
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password — reset password using token from email
router.post('/reset-password', async (req, res, next) => {
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

// POST /api/auth/link-identity — link a dfac-id to the authenticated user
router.post('/link-identity', requireAuth, async (req, res) => {
  const {dfacId} = req.body;
  if (!dfacId || typeof dfacId !== 'string') {
    res.status(400).json({error: 'dfacId is required'});
    return;
  }
  const isNew = await linkDfacId(req.authUser!.userId, dfacId);
  // Only backfill on first link — skip the heavy game_events scan on subsequent page loads
  let backfilled = 0;
  if (isNew) {
    backfilled = await backfillSolvesForDfacId(req.authUser!.userId, dfacId);
  }
  res.json({ok: true, backfilledSolves: backfilled});
});

export default router;

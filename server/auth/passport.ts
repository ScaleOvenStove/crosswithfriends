import passport from 'passport';
import {Strategy as GoogleStrategy} from 'passport-google-oauth20';
import {Strategy as LocalStrategy} from 'passport-local';
import {findUserByEmail, verifyPassword, findOrCreateGoogleUser, EmailCollisionError} from '../model/user';

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await findOrCreateGoogleUser(
            profile.id,
            profile.emails?.[0]?.value || '',
            profile.displayName || ''
          );
          done(null, user);
        } catch (err: any) {
          if (err instanceof EmailCollisionError || err?.name === 'EmailCollisionError') {
            // Pass the collision message + Google profile ID so the link flow can still use it
            done(null, false, {message: err.message, googleId: profile.id});
            return;
          }
          done(err as Error);
        }
      }
    )
  );
}

passport.use(
  new LocalStrategy({usernameField: 'email'}, async (email, password, done) => {
    try {
      const user = await findUserByEmail(email);
      if (!user || !user.password_hash) {
        return done(null, false, {message: 'Invalid email or password'});
      }
      const valid = await verifyPassword(password, user.password_hash);
      if (!valid) {
        return done(null, false, {message: 'Invalid email or password'});
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

export default passport;

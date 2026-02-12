import './css/legal.css';

import React from 'react';
import {Link} from 'react-router-dom';
import Nav from '../components/common/Nav';
import Footer from '../components/common/Footer';

export default function Help() {
  return (
    <div className="legal">
      <Nav />
      <div className="legal--content">
        <h1>Help &amp; FAQ</h1>

        <h2>Getting Started</h2>

        <h3>How do I create an account?</h3>
        <p>
          Click the user icon in the top right corner and select &quot;Sign Up / Log In.&quot; You can create
          an account with your email and a password, or sign in with Google for one-click access.
        </p>

        <h3>Why do I need to verify my email?</h3>
        <p>
          Email verification confirms you own the email address and enables features like password reset.
          After signing up, check your inbox (and spam/junk folder) for a verification email. Click the link
          to verify. You can resend the email from the verification page if it doesn&apos;t arrive.
        </p>

        <h3>Do I need an account to play?</h3>
        <p>
          You can browse and play puzzles without an account. Creating an account lets you track your solve
          history, view your profile and stats, and upload puzzles.
        </p>

        <h2>Playing Puzzles</h2>

        <h3>How do I start a puzzle?</h3>
        <p>
          Browse puzzles on the home page and click one to start. You can filter by size, source, and
          difficulty. Each puzzle opens in its own game room.
        </p>

        <h3>How do I play with friends?</h3>
        <p>
          When you open a puzzle, share the URL with your friends. Anyone with the link can join the same game
          room and solve collaboratively in real time. You&apos;ll see each other&apos;s cursors and edits as
          they happen.
        </p>

        <h3>How do I upload a puzzle?</h3>
        <p>
          Click &quot;Upload&quot; on the home page and select a .puz file. Uploaded puzzles can be public
          (visible to everyone) or unlisted (only accessible via direct link).
        </p>

        <h2>Your Profile &amp; Stats</h2>

        <h3>Where can I see my stats?</h3>
        <p>
          Click the user icon and select &quot;Your Profile &amp; Stats.&quot; Your profile shows your total
          puzzles solved, stats by puzzle size, average solve times, in-progress games, and solve history.
        </p>

        <h3>Can other people see my profile?</h3>
        <p>
          Yes. Your display name and solve stats are visible when others visit your profile. Your email
          address is never shown publicly.
        </p>

        <h2>Account Settings</h2>

        <h3>How do I change my display name?</h3>
        <p>
          Go to <Link to="/account">Settings</Link> and click &quot;Edit&quot; next to your display name.
        </p>

        <h3>How do I change my email?</h3>
        <p>
          Go to <Link to="/account">Settings</Link> and click &quot;Change&quot; next to your email.
          You&apos;ll need to confirm your password and verify the new email address via a confirmation link.
        </p>

        <h3>How do I reset my password?</h3>
        <p>
          Click &quot;Forgot password?&quot; on the login form and enter your email. You&apos;ll receive a
          reset link that expires in 1 hour. If you don&apos;t see the email, check your spam/junk folder.
        </p>

        <h3>How do I link or unlink Google sign-in?</h3>
        <p>
          Go to <Link to="/account">Settings</Link>. If you don&apos;t have Google linked, you&apos;ll see a
          &quot;Link Google Account&quot; button. To unlink, you must first set a password so you can still
          log in.
        </p>

        <h3>How do I delete my account?</h3>
        <p>
          Go to <Link to="/account">Settings</Link> and click &quot;Delete Account&quot; at the bottom. This
          action is permanent and removes all your account data.
        </p>

        <h2>Troubleshooting</h2>

        <h3>I didn&apos;t receive a verification or reset email</h3>
        <p>
          Check your spam or junk folder. If it&apos;s not there, try resending from the verification page or
          requesting a new reset link. Make sure you&apos;re checking the correct email address.
        </p>

        <h3>My verification link says &quot;expired or invalid&quot;</h3>
        <p>
          Verification links expire after 24 hours and can only be used once. Go to the{' '}
          <Link to="/verify-email">verification page</Link> and click &quot;Resend Verification Email&quot; to
          get a new link.
        </p>

        <h3>I&apos;m stuck on the verification screen</h3>
        <p>
          If you&apos;ve already verified but still see the verification screen, try refreshing the page or
          logging out and back in.
        </p>

        <h2>Contact &amp; Community</h2>

        <p>
          Have a question not answered here? Join the{' '}
          <a href="https://discord.gg/RmjCV8EZ73" target="_blank" rel="noopener noreferrer">
            community Discord
          </a>{' '}
          for discussion and support. To report bugs or request features, visit the project on{' '}
          <a
            href="https://github.com/ScaleOvenStove/crosswithfriends"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          .
        </p>
      </div>
      <Footer />
    </div>
  );
}

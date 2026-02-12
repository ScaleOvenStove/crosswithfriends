import './css/legal.css';

import React from 'react';
import Nav from '../components/common/Nav';
import Footer from '../components/common/Footer';

export default function Privacy() {
  return (
    <div className="legal">
      <Nav />
      <div className="legal--content">
        <h1>Privacy Policy</h1>
        <p className="legal--effective-date">Effective Date: February 10, 2026</p>

        <p>
          Cross with Friends (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the website
          crosswithfriends.com. This Privacy Policy explains how we collect, use, and protect your information
          when you use our service.
        </p>

        <h2>Information We Collect</h2>
        <p>We collect information in the following ways:</p>
        <ul>
          <li>
            <strong>Account Information:</strong> When you create an account, we collect your email address
            and display name. If you sign in with Google, we receive your name and email from Google.
          </li>
          <li>
            <strong>Game Activity:</strong> We record your puzzle solving activity, including which puzzles
            you solve, your solve times, and whether you solved collaboratively with other players.
          </li>
          <li>
            <strong>Uploaded Content:</strong> If you upload crossword puzzles, we store the puzzle content
            and associate it with your account.
          </li>
          <li>
            <strong>Local Storage:</strong> We use browser local storage to maintain your session, dark mode
            preference, and a randomly generated anonymous identifier used for real-time game participation.
          </li>
        </ul>

        <h2>How We Use Your Information</h2>
        <ul>
          <li>To provide and maintain your account</li>
          <li>To display your game statistics and solve history on your profile</li>
          <li>To enable real-time collaborative puzzle solving</li>
          <li>To associate uploaded puzzles with your account</li>
          <li>To improve the site and fix issues</li>
        </ul>

        <h2>Data Storage and Security</h2>
        <p>
          Your account data is stored in a PostgreSQL database. Passwords are hashed using bcrypt and are
          never stored in plain text. Authentication sessions use JSON Web Tokens (JWT) with short-lived
          access tokens and secure HTTP-only refresh cookies.
        </p>

        <h2>Third-Party Services</h2>
        <p>
          If you choose to sign in with Google, we use Google OAuth to authenticate your identity. We only
          receive your name and email address from Google. You can revoke this access at any time through your{' '}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
            Google Account settings
          </a>
          .
        </p>

        <h2>Data Sharing</h2>
        <p>
          We do not sell, trade, or otherwise transfer your personal information to third parties. Your
          display name and game statistics may be visible to other users on your public profile.
        </p>

        <h2>Data Retention and Deletion</h2>
        <p>
          We retain your account data for as long as your account is active. You can delete your account at
          any time from your <a href="/account">Account Settings</a> page. When you delete your account, your
          personal data (email, display name, password hash) is permanently removed.
        </p>

        <h2>Cookies</h2>
        <p>
          We use a secure HTTP-only cookie for authentication refresh tokens. We do not use third-party
          tracking cookies or analytics services.
        </p>

        <h2>Children&apos;s Privacy</h2>
        <p>
          Cross with Friends is not directed at children under 13. We do not knowingly collect personal
          information from children under 13. If you believe a child has provided us with personal
          information, please contact us so we can remove it.
        </p>

        <h2>Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Changes will be posted on this page with an
          updated effective date. Continued use of the site after changes constitutes acceptance of the
          updated policy.
        </p>

        <h2>Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy, you can reach us through our{' '}
          <a
            href="https://github.com/ScaleOvenStove/crosswithfriends/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub repository
          </a>{' '}
          or our{' '}
          <a href="https://discord.gg/RmjCV8EZ73" target="_blank" rel="noopener noreferrer">
            Discord server
          </a>
          .
        </p>
      </div>
      <Footer />
    </div>
  );
}

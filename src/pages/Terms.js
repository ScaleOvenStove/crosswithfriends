import './css/legal.css';

import React from 'react';
import Nav from '../components/common/Nav';
import Footer from '../components/common/Footer';

export default function Terms() {
  return (
    <div className="legal">
      <Nav />
      <div className="legal--content">
        <h1>Terms of Service</h1>
        <p className="legal--effective-date">Effective Date: February 10, 2026</p>

        <p>
          Welcome to Cross with Friends. By accessing or using crosswithfriends.com (&quot;the Service&quot;),
          you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.
        </p>

        <h2>Account Registration</h2>
        <p>
          You may use the Service without an account to solve puzzles. Creating an account allows you to track
          your solve history, upload puzzles, and maintain a profile. You are responsible for maintaining the
          security of your account credentials.
        </p>

        <h2>Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose</li>
          <li>Upload content that infringes on the intellectual property rights of others</li>
          <li>Attempt to interfere with or disrupt the Service</li>
          <li>Create multiple accounts for abusive purposes</li>
          <li>Use automated systems to access the Service in a manner that exceeds reasonable use</li>
        </ul>

        <h2>User-Uploaded Content</h2>
        <p>
          When you upload crossword puzzles to Cross with Friends, you retain ownership of your original
          content. By uploading, you grant us a non-exclusive, royalty-free license to host, display, and make
          the puzzle available to other users through the Service. You represent that you have the right to
          upload any content you submit.
        </p>

        <h2>Intellectual Property</h2>
        <p>
          The Cross with Friends service, including its design and functionality, is open-source software.
          Crossword puzzle content uploaded by users remains the property of their respective creators or
          rights holders.
        </p>

        <h2>Disclaimer of Warranties</h2>
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any
          kind, either express or implied. We do not guarantee that the Service will be uninterrupted,
          error-free, or secure.
        </p>

        <h2>Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, Cross with Friends and its operators shall not be liable for
          any indirect, incidental, special, or consequential damages arising from your use of the Service,
          including but not limited to loss of data or interruption of service.
        </p>

        <h2>Account Termination</h2>
        <p>
          You may delete your account at any time from your <a href="/account">Account Settings</a> page. We
          reserve the right to suspend or terminate accounts that violate these Terms.
        </p>

        <h2>Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. Changes will be posted on this page with an updated
          effective date. Continued use of the Service after changes constitutes acceptance of the updated
          Terms.
        </p>

        <h2>Contact Us</h2>
        <p>
          If you have questions about these Terms, you can reach us through our{' '}
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

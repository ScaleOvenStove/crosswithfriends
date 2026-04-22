import './css/legal.css';

import {Helmet} from 'react-helmet-async';
import {Link} from 'react-router';
import Nav from '../components/common/Nav';
import Footer from '../components/common/Footer';
import SupportOptions from '../components/common/SupportOptions';

export default function Help() {
  return (
    <div className="legal">
      <Helmet>
        <title>Help &amp; FAQ - Cross with Friends</title>
      </Helmet>
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
          No. You can browse, play, and upload puzzles without an account. Creating an account unlocks extras:
        </p>
        <ul>
          <li>Solve history and stats broken down by puzzle size and averages.</li>
          <li>
            Save Replay — after solving, keep the full replay of your game permanently instead of letting it
            expire.
          </li>
          <li>A persistent display name and cursor color that follow you across devices.</li>
          <li>In-progress games tracked on your profile so you can pick up where you left off.</li>
          <li>
            Preferences (dark mode, vim mode, auto-advance, etc.) sync across every device you&apos;re logged
            into.
          </li>
          <li>Optional public profile you can share with friends.</li>
        </ul>

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
          (visible to everyone) or unlisted (only accessible via direct link). You can also override the title
          and author at upload time if you want a custom name.
        </p>

        <h2>In-Game Features</h2>

        <h3>How do I check, reveal, or reset my answers?</h3>
        <p>
          The toolbar above the grid has <strong>Check</strong>, <strong>Reveal</strong>, and{' '}
          <strong>Reset</strong> menus. Each can be applied to the current <em>Square</em>, <em>Word</em>, or
          the whole <em>Puzzle</em>. Reveal and Reset on the full puzzle ask for confirmation first.
        </p>

        <h3>What is pencil mode?</h3>
        <p>
          Pencil mode lets you enter tentative answers in a lighter color so you can distinguish guesses from
          confirmed letters. Click the pencil icon in the toolbar (or press <code>.</code>) to toggle it. When
          pencil mode is on, a small swatch appears next to the icon so you can pick the pencil color.
        </p>

        <h3>What&apos;s in the Extras menu?</h3>
        <p>The Extras menu in the toolbar bundles most of the optional gameplay toggles:</p>
        <ul>
          <li>
            <strong>Focus mode</strong> (desktop) — hides the top nav bar to give the grid more vertical
            space. Handy on smaller laptop screens.
          </li>
          <li>
            <strong>Text: Larger / Smaller</strong> — scales both the letters and the grid cells until they
            fill the available viewport.
          </li>
          <li>
            <strong>Sound on solve</strong> — toggles the jingle that plays when you complete a puzzle.
          </li>
          <li>
            <strong>Skip filled squares</strong> — when typing, jump over cells that already have letters.
          </li>
          <li>
            <strong>Auto-advance cursor</strong> — when the current word is complete, move the cursor to the
            next clue automatically.
          </li>
          <li>
            <strong>Show progress</strong> — show a percent-complete indicator and celebratory messages at
            25/50/75%.
          </li>
          <li>
            <strong>Color Attribution</strong> — highlight each cell with the color of the player who filled
            it (useful for co-op games).
          </li>
          <li>
            <strong>List View</strong> — switch to a stacked list of clues next to the grid, which works
            better for large / non-standard puzzles.
          </li>
          <li>
            <strong>Autocheck</strong> — mark wrong letters as soon as you enter them.
          </li>
          <li>
            <strong>Vim mode</strong> — keyboard shortcuts for vim users (jump to clue number, etc.).
          </li>
          <li>
            <strong>New game link</strong> — open a fresh empty game of the same puzzle in a new tab.
          </li>
        </ul>

        <h3>What keyboard shortcuts are available?</h3>
        <p>
          Click the <code>ⓘ</code> icon in the game toolbar for a full list of shortcuts inside the game,
          including <code>Tab</code> / <code>Shift+Tab</code> to jump between clues, <code>Space</code> to
          flip direction, <code>Shift+Enter</code> or <code>[</code> / <code>]</code> to move perpendicular to
          the current word, and <code>Alt+S/W/P</code> to Check <em>Square</em>/<em>Word</em>/<em>Puzzle</em>.
        </p>

        <h3>How do I switch to dark mode?</h3>
        <p>
          Click the user icon in the top right corner and choose the Dark Mode option. It cycles between{' '}
          <em>Off</em>, <em>On</em>, and <em>System</em> (follows your OS setting). If you&apos;re signed in,
          the preference syncs across your devices.
        </p>

        <h3>Can I print a puzzle?</h3>
        <p>
          Yes. Use your browser&apos;s print dialog (Cmd/Ctrl+P) on the game page. The grid, clues, and
          numbers are laid out for printing — chat, cursors, and other live-play UI are hidden.
        </p>

        <h2>Your Profile &amp; Stats</h2>

        <h3>Where can I see my stats?</h3>
        <p>
          Click the user icon and select &quot;Your Profile &amp; Stats.&quot; Your profile shows your total
          puzzles solved, stats by puzzle size, average solve times, in-progress games, and solve history.
        </p>

        <h3>Can other people see my profile?</h3>
        <p>
          Profiles are private by default. You can make yours public in <Link to="/account">Settings</Link>{' '}
          under &quot;Profile Visibility.&quot; When public, your display name and solve stats are visible to
          others. Your email address is never shown publicly.
        </p>

        <h3>Does my solve history carry over when I create an account?</h3>
        <p>
          Yes. When you create an account or log in, your browser session is automatically linked to your
          account. Your in-progress games and previously completed puzzles will appear on your profile and in
          your solve stats.
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

        <h2>Support the Site</h2>
        <p>
          Cross with Friends is free and ad-free. If you&apos;ve enjoyed it and want to help cover hosting
          costs, either option below goes to the same place — pick whichever works in your region.
        </p>
        <SupportOptions showIntro={false} />

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

import {useCallback, useContext, useEffect, useState} from 'react';
import {MdInfoOutline, MdLock, MdLockOpen} from 'react-icons/md';
import * as Sentry from '@sentry/react';
import AuthContext from '../../lib/AuthContext';
import {fetchGameModeration, lockGame, unlockGame} from '../../api/create_game';
import InfoDialog from '../common/InfoDialog';
import LoginModal from '../Auth/LoginModal';
import './css/OwnerControls.css';

interface Props {
  gid: string;
}

interface AuthCtx {
  accessToken: string | null;
}

export default function OwnerControls({gid}: Props) {
  const {accessToken} = useContext(AuthContext) as AuthCtx;
  const [locked, setLocked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const handleShowInfo = useCallback(() => setShowInfo(true), []);
  const handleShowLogin = useCallback(() => setShowLogin(true), []);
  const handleCloseLogin = useCallback(() => setShowLogin(false), []);

  useEffect(() => {
    let cancelled = false;
    fetchGameModeration(gid).then((state) => {
      if (cancelled || !state) return;
      setLocked(state.locked);
    });
    return () => {
      cancelled = true;
    };
  }, [gid]);

  const handleToggle = useCallback(async () => {
    if (!accessToken || busy || locked === null) return;
    setBusy(true);
    try {
      const ok = locked ? await unlockGame(gid, accessToken) : await lockGame(gid, accessToken);
      if (ok) setLocked(!locked);
    } catch (err) {
      Sentry.captureException(err);
    } finally {
      setBusy(false);
    }
  }, [accessToken, busy, gid, locked]);

  // Guest-owner state: keep the button in place so the layout doesn't
  // shift after sign-in, but route the click to LoginModal and explain
  // why it's disabled. The lock/kick endpoints reject dfac-only ownership
  // anyway (creator.dfacId is forgeable from the create event), so this
  // is just surfacing the actual requirement.
  const signedOut = !accessToken;
  // Signed-in: wait for the moderation fetch so the icon/label reflects
  // real lock state. Signed-out: render the CTA immediately — the lock
  // state isn't actionable until they sign in anyway, so blocking on the
  // fetch just delays the affordance.
  if (locked === null && !signedOut) return null;
  const Icon = locked === true ? MdLock : MdLockOpen;
  let buttonTitle: string;
  let buttonLabel: string;
  if (signedOut) {
    buttonTitle = 'Sign in to manage your game';
    buttonLabel = 'Sign in to manage your game';
  } else if (locked) {
    buttonTitle = 'Unlock game (allow new players to join)';
    buttonLabel = 'Locked';
  } else {
    buttonTitle = 'Lock game (block new players)';
    buttonLabel = 'Lock game';
  }
  return (
    <div className="owner-controls--lock-row">
      <button
        type="button"
        className={`owner-controls--lock-btn${signedOut ? ' owner-controls--lock-btn-signin' : ''}`}
        onClick={signedOut ? handleShowLogin : handleToggle}
        disabled={busy}
        title={buttonTitle}
      >
        <Icon className="owner-controls--lock-icon" />
        {buttonLabel}
      </button>
      <button
        type="button"
        className="owner-controls--info-btn"
        onClick={handleShowInfo}
        aria-label="What does locking do?"
        title="What does locking do?"
      >
        <MdInfoOutline />
      </button>
      <InfoDialog open={showInfo} onOpenChange={setShowInfo} title="Locking a game" icon={<MdInfoOutline />}>
        <p>
          Locking prevents <strong>new</strong> players from joining. Players who are already in the game keep
          playing.
        </p>
        <p>
          Locked games still appear in lists, but anyone who tries to open one for the first time sees a
          &ldquo;game is locked&rdquo; message instead of the puzzle.
        </p>
        <p>You can unlock the game at any time.</p>
      </InfoDialog>
      {signedOut && <LoginModal open={showLogin} onClose={handleCloseLogin} />}
    </div>
  );
}

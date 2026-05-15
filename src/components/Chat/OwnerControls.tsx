import {useCallback, useContext, useEffect, useState} from 'react';
import {MdInfoOutline, MdLock, MdLockOpen} from 'react-icons/md';
import * as Sentry from '@sentry/react';
import AuthContext from '../../lib/AuthContext';
import {fetchGameModeration, lockGame, unlockGame} from '../../api/create_game';
import InfoDialog from '../common/InfoDialog';
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
  const handleShowInfo = useCallback(() => setShowInfo(true), []);

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

  if (locked === null) return null;
  const Icon = locked ? MdLock : MdLockOpen;
  return (
    <div className="owner-controls--lock-row">
      <button
        type="button"
        className="owner-controls--lock-btn"
        onClick={handleToggle}
        disabled={busy}
        title={locked ? 'Unlock game (allow new players to join)' : 'Lock game (block new players)'}
      >
        <Icon className="owner-controls--lock-icon" />
        {locked ? 'Locked' : 'Lock game'}
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
    </div>
  );
}

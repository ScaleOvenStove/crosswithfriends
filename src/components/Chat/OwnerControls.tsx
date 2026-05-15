import {useCallback, useContext, useEffect, useState} from 'react';
import {MdLock, MdLockOpen} from 'react-icons/md';
import * as Sentry from '@sentry/react';
import AuthContext from '../../lib/AuthContext';
import {fetchGameModeration, lockGame, unlockGame} from '../../api/create_game';
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
  );
}

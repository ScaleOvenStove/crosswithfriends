import {useCallback, useContext, useState} from 'react';
import {MdInfoOutline, MdLock, MdLockOpen} from 'react-icons/md';
import * as Sentry from '@sentry/react';
import AuthContext from '../../lib/AuthContext';
import {
  clearGameRestriction,
  GameRestrictions,
  lockGame,
  RestrictableAction,
  setGameRestriction,
  unlockGame,
} from '../../api/create_game';
import InfoDialog from '../common/InfoDialog';
import LoginModal from '../Auth/LoginModal';
import './css/OwnerControls.css';

interface Props {
  gid: string;
  // Source-of-truth lives in pages/Game.js so the lock chip in Chat and
  // the lock_changed socket broadcast stay in sync with this panel.
  locked: boolean;
  restrictions: GameRestrictions;
  // Optional defensive refresh — invoked after a successful toggle so
  // the panel re-syncs even if the matching socket broadcast is missed
  // (mid-bounce, transient disconnect). The broadcast still drives the
  // common path; this is a backstop.
  onRefreshModeration?: () => void;
}

interface AuthCtx {
  accessToken: string | null;
}

// Order matters — drives row order in the panel.
const RESTRICTION_ROWS: ReadonlyArray<{action: RestrictableAction; label: string}> = [
  {action: 'check', label: 'Check'},
  {action: 'reveal', label: 'Reveal'},
  {action: 'reset', label: 'Reset'},
];

interface RestrictionRowProps {
  action: RestrictableAction;
  label: string;
  isRestricted: boolean;
  busy: boolean;
  onToggle: (action: RestrictableAction) => void;
}

function RestrictionRow({action, label, isRestricted, busy, onToggle}: RestrictionRowProps) {
  const handleClick = useCallback(() => onToggle(action), [action, onToggle]);
  const Icon = isRestricted ? MdLock : MdLockOpen;
  const title = isRestricted
    ? `Allow other players to ${label.toLowerCase()}`
    : `Restrict ${label.toLowerCase()} to only you`;
  const buttonLabel = isRestricted ? `${label} restricted` : `Restrict ${label}`;
  return (
    <div className="owner-controls--lock-row">
      <button
        type="button"
        className="owner-controls--lock-btn"
        onClick={handleClick}
        disabled={busy}
        title={title}
      >
        <Icon className="owner-controls--lock-icon" />
        {buttonLabel}
      </button>
    </div>
  );
}

export default function OwnerControls({gid, locked, restrictions, onRefreshModeration}: Props) {
  const {accessToken} = useContext(AuthContext) as AuthCtx;
  // Per-row busy state so toggling one restriction doesn't disable the
  // others. Keyed by action; 'lock' is the lock toggle's slot. Local UI
  // state only — the actual lock/restriction state comes from props and
  // updates via the lock_changed / restrictions_changed broadcasts.
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [showInfo, setShowInfo] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const handleShowInfo = useCallback(() => setShowInfo(true), []);
  const handleShowLogin = useCallback(() => setShowLogin(true), []);
  const handleCloseLogin = useCallback(() => setShowLogin(false), []);

  const setBusyFor = useCallback((slot: string, value: boolean) => {
    setBusy((prev) => ({...prev, [slot]: value}));
  }, []);

  const handleToggleLock = useCallback(async () => {
    if (!accessToken || busy.lock) return;
    setBusyFor('lock', true);
    try {
      if (locked) {
        await unlockGame(gid, accessToken);
      } else {
        await lockGame(gid, accessToken);
      }
      // The lock_changed broadcast normally updates the upstream state
      // and re-renders us with new props. Also refetch as a backstop in
      // case the broadcast was missed (mid-bounce, transient disconnect).
      onRefreshModeration?.();
    } catch (err) {
      Sentry.captureException(err);
    } finally {
      setBusyFor('lock', false);
    }
  }, [accessToken, busy.lock, gid, locked, onRefreshModeration, setBusyFor]);

  const handleToggleRestriction = useCallback(
    async (action: RestrictableAction) => {
      if (!accessToken || busy[action]) return;
      const wasRestricted = restrictions[action];
      setBusyFor(action, true);
      try {
        if (wasRestricted) {
          await clearGameRestriction(gid, action, accessToken);
        } else {
          await setGameRestriction(gid, action, accessToken);
        }
        // Same backstop as lock — broadcast is the common path, this is
        // defensive in case it doesn't arrive.
        onRefreshModeration?.();
      } catch (err) {
        Sentry.captureException(err);
      } finally {
        setBusyFor(action, false);
      }
    },
    [accessToken, busy, gid, restrictions, onRefreshModeration, setBusyFor]
  );

  // Guest-owner state: keep the buttons in place so the layout doesn't
  // shift after sign-in, but route the click to LoginModal and explain
  // why they're disabled. The moderation endpoints all reject dfac-only
  // ownership (creator.dfacId is visible to every player from the create
  // event), so the only path to moderating is signing in.
  const signedOut = !accessToken;
  const LockIcon = locked ? MdLock : MdLockOpen;
  let lockButtonTitle: string;
  let lockButtonLabel: string;
  if (signedOut) {
    lockButtonTitle = 'Sign in to manage your game';
    lockButtonLabel = 'Sign in to manage your game';
  } else if (locked) {
    lockButtonTitle = 'Unlock game (allow new players to join)';
    lockButtonLabel = 'Locked';
  } else {
    lockButtonTitle = 'Lock game (block new players)';
    lockButtonLabel = 'Lock game';
  }

  return (
    <div className="owner-controls">
      <div className="owner-controls--lock-row">
        <button
          type="button"
          className={`owner-controls--lock-btn${signedOut ? ' owner-controls--lock-btn-signin' : ''}`}
          onClick={signedOut ? handleShowLogin : handleToggleLock}
          disabled={!!busy.lock}
          title={lockButtonTitle}
        >
          <LockIcon className="owner-controls--lock-icon" />
          {lockButtonLabel}
        </button>
        <button
          type="button"
          className="owner-controls--info-btn"
          onClick={handleShowInfo}
          aria-label="What do these controls do?"
          title="What do these controls do?"
        >
          <MdInfoOutline />
        </button>
      </div>
      {!signedOut &&
        RESTRICTION_ROWS.map(({action, label}) => (
          <RestrictionRow
            key={action}
            action={action}
            label={label}
            isRestricted={restrictions[action]}
            busy={!!busy[action]}
            onToggle={handleToggleRestriction}
          />
        ))}
      <InfoDialog
        open={showInfo}
        onOpenChange={setShowInfo}
        title="Game host controls"
        icon={<MdInfoOutline />}
      >
        <p>
          <strong>Lock game</strong> prevents <em>new</em> players from joining. Players who are already in
          the game keep playing.
        </p>
        <p>
          <strong>Restrict Check / Reveal / Reset</strong> makes that action available only to you. Other
          players see a locked icon on the menu instead. Useful when you want to keep a competitive solve
          honest, or stop someone from resetting the whole grid.
        </p>
        <p>You can flip any of these on or off at any time.</p>
      </InfoDialog>
      {signedOut && <LoginModal open={showLogin} onClose={handleCloseLogin} />}
    </div>
  );
}

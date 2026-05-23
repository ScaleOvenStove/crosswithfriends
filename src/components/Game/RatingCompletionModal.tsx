import {useCallback, useContext, useEffect, useRef, useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {MdStar, MdStarBorder} from 'react-icons/md';
import * as Sentry from '@sentry/react';
import AuthContext from '../../lib/AuthContext';
import LoginModal from '../Auth/LoginModal';
import {submitPuzzleRating, RatingNotEligibleError} from '../../api/puzzle_rating';
import {formatMilliseconds} from '../Toolbar/Clock';
import './css/RatingCompletionModal.css';

interface Props {
  pid: string;
  solved: boolean;
  // Solve time in milliseconds; rendered as a subtitle when present.
  solveTimeMs?: number;
  // Save-replay wiring (owned by Game.js, plumbed through Game component).
  // null = no snapshot yet, false = snapshot exists but not retained, true = retained.
  replayRetained?: boolean | null;
  savingReplay?: boolean;
  onSaveReplay?: () => void;
}

const STORAGE_PREFIX = 'cwf:rating_prompt_dismissed:';
// Survives the Google OAuth full-page redirect. When the user clicks
// "Sign in" inside the rating modal, we set this flag so the modal can be
// re-opened after the redirect lands them back on the game page (where
// the false→true solved transition would otherwise not fire on the fresh
// mount).
const SIGN_IN_INTENT_PREFIX = 'cwf:rating_signin_intent:';
const STAR_VALUES = [1, 2, 3, 4, 5];

interface StarButtonProps {
  n: number;
  filled: boolean;
  onHover: (n: number) => void;
  onClick: (n: number) => void;
  disabled?: boolean;
}

function StarButton({n, filled, onHover, onClick, disabled}: StarButtonProps) {
  const Icon = filled ? MdStar : MdStarBorder;
  const handleEnter = useCallback(() => onHover(n), [onHover, n]);
  const handleFocus = useCallback(() => onHover(n), [onHover, n]);
  const handleClick = useCallback(() => onClick(n), [onClick, n]);
  return (
    <button
      type="button"
      className="rating-completion--star-btn"
      aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
      onMouseEnter={handleEnter}
      onFocus={handleFocus}
      onClick={handleClick}
      disabled={disabled}
    >
      <Icon className="rating-completion--star" />
    </button>
  );
}

function dismissedKey(pid: string): string {
  return `${STORAGE_PREFIX}${pid}`;
}

function readDismissed(pid: string): boolean {
  try {
    return localStorage.getItem(dismissedKey(pid)) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(pid: string): void {
  try {
    localStorage.setItem(dismissedKey(pid), '1');
  } catch {
    // localStorage may be unavailable
  }
}

function signInIntentKey(pid: string): string {
  return `${SIGN_IN_INTENT_PREFIX}${pid}`;
}

function readSignInIntent(pid: string): boolean {
  try {
    return sessionStorage.getItem(signInIntentKey(pid)) === '1';
  } catch {
    return false;
  }
}

function writeSignInIntent(pid: string): void {
  try {
    sessionStorage.setItem(signInIntentKey(pid), '1');
  } catch {
    // sessionStorage may be unavailable
  }
}

function clearSignInIntent(pid: string): void {
  try {
    sessionStorage.removeItem(signInIntentKey(pid));
  } catch {
    // sessionStorage may be unavailable
  }
}

export default function RatingCompletionModal({
  pid,
  solved,
  solveTimeMs,
  replayRetained,
  savingReplay,
  onSaveReplay,
}: Props) {
  const {user, accessToken} = useContext(AuthContext) as {
    user: {id: string} | null;
    accessToken: string | null;
  };
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submittedRating, setSubmittedRating] = useState<number | null>(null);
  const [eligibilityError, setEligibilityError] = useState<number | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  // Track previous solved state so we only open on a false→true transition.
  // Otherwise the modal would also pop on any mount where the puzzle is
  // already solved (e.g. revisiting a snapshot-loaded game).
  const wasSolvedRef = useRef(solved);
  // Ref to the dismissal button — Radix auto-focuses the first focusable on
  // open, which would land on the 1-star and visually look like a selection
  // (the focus-triggered onHover also fills the star). Redirect focus here
  // so Enter dismisses rather than accidentally submitting a 1-star rating.
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const wasSolved = wasSolvedRef.current;
    wasSolvedRef.current = solved;
    if (!pid) return;
    if (!solved) return;
    if (readDismissed(pid)) return;
    // Two open conditions:
    //   1. Normal: false→true solved transition on this mount (just solved).
    //   2. Sign-in return: the user clicked "Sign in" before solving was
    //      remounted (Google OAuth full-page redirect), so wasSolved=true
    //      and the transition check would skip. The intent flag carries
    //      "user wanted to rate" across the redirect.
    const cameBackFromSignIn = readSignInIntent(pid);
    if (!wasSolved || cameBackFromSignIn) {
      if (cameBackFromSignIn) clearSignInIntent(pid);
      setOpen(true);
    }
  }, [solved, pid]);

  const handleClose = useCallback(() => {
    if (pid) writeDismissed(pid);
    setOpen(false);
  }, [pid]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) handleClose();
      else setOpen(true);
    },
    [handleClose]
  );

  const handleSubmit = useCallback(
    async (rating: number) => {
      if (!accessToken) return;
      setSubmitting(true);
      setEligibilityError(null);
      try {
        await submitPuzzleRating(pid, rating, accessToken);
        // Persist that the user has acted on this prompt so we don't pop it
        // again next visit, but keep the modal open so they can still hit
        // "Save replay" or just acknowledge with "Done". Previously the
        // modal closed immediately after rating, hiding the save-replay
        // button before it could be used.
        if (pid) writeDismissed(pid);
        setSubmittedRating(rating);
      } catch (err) {
        if (err instanceof RatingNotEligibleError) {
          setEligibilityError(err.thresholdPercent);
        } else {
          Sentry.captureException(err);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [pid, accessToken]
  );

  const handleOpenLogin = useCallback(() => {
    // Persist that the user wanted to rate, in case sign-in goes through
    // the Google OAuth full-page redirect — the modal will re-open on
    // return. No-op for the email/password flow where the LoginModal
    // resolves inline without a redirect.
    if (pid) writeSignInIntent(pid);
    setShowLogin(true);
  }, [pid]);
  const handleCloseLogin = useCallback(() => setShowLogin(false), []);
  const handleStarsLeave = useCallback(() => setHover(0), []);
  const handleOpenAutoFocus = useCallback((e: Event) => {
    // See closeButtonRef declaration above for the rationale.
    e.preventDefault();
    closeButtonRef.current?.focus();
  }, []);

  // Once a rating is submitted, freeze the stars to that value (no hover
  // preview) so the visual confirms what the server now has.
  const display = submittedRating ?? hover;

  return (
    <>
      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="confirm-dialog--overlay" />
          <Dialog.Content
            className="confirm-dialog--panel confirm-dialog--centered"
            onOpenAutoFocus={handleOpenAutoFocus}
          >
            <Dialog.Title className="confirm-dialog--title confirm-dialog--title-centered">
              Nice solve!
            </Dialog.Title>
            {solveTimeMs != null && solveTimeMs > 0 && (
              <p className="rating-completion--solve-time">
                Solved in <strong>{formatMilliseconds(solveTimeMs)}</strong>
              </p>
            )}
            <div className="confirm-dialog--body rating-completion--body">
              {user ? (
                <>
                  <p>{submittedRating != null ? 'Thanks for rating!' : 'How would you rate this puzzle?'}</p>
                  <div className="rating-completion--stars" onMouseLeave={handleStarsLeave}>
                    {STAR_VALUES.map((n) => (
                      <StarButton
                        key={n}
                        n={n}
                        filled={n <= display}
                        onHover={setHover}
                        onClick={handleSubmit}
                        disabled={submitting || submittedRating != null}
                      />
                    ))}
                  </div>
                  {eligibilityError != null && (
                    <p className="rating-completion--hint">
                      You need to reach {eligibilityError}% completion before rating.
                    </p>
                  )}
                  {/* Save Replay: only shown for signed-in users who have a snapshot
                      saved but haven't retained the replay yet. Mirrors the toolbar
                      gating in src/components/Toolbar/index.js. */}
                  {onSaveReplay && replayRetained === false && (
                    <button
                      type="button"
                      className="btn btn--outlined rating-completion--save-replay"
                      onClick={onSaveReplay}
                      disabled={savingReplay}
                    >
                      {savingReplay ? 'Saving…' : 'Save replay'}
                    </button>
                  )}
                  {replayRetained === true && (
                    <p className="rating-completion--hint rating-completion--replay-saved">Replay saved.</p>
                  )}
                </>
              ) : (
                <>
                  <p>Sign in to rate this puzzle and help surface the best ones for everyone.</p>
                  <button type="button" className="btn btn--contained btn--primary" onClick={handleOpenLogin}>
                    Sign in
                  </button>
                </>
              )}
            </div>
            <div className="confirm-dialog--actions">
              <button
                ref={closeButtonRef}
                type="button"
                className="btn btn--outlined"
                onClick={handleClose}
                disabled={submitting}
              >
                {submittedRating != null ? 'Done' : 'Maybe later'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {!user && <LoginModal open={showLogin} onClose={handleCloseLogin} />}
    </>
  );
}

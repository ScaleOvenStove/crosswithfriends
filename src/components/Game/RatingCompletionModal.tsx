import {useCallback, useContext, useEffect, useRef, useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {MdStar, MdStarBorder} from 'react-icons/md';
import * as Sentry from '@sentry/react';
import AuthContext from '../../lib/AuthContext';
import LoginModal from '../Auth/LoginModal';
import {submitPuzzleRating, RatingNotEligibleError} from '../../api/puzzle_rating';
import './css/RatingCompletionModal.css';

interface Props {
  pid: string;
  solved: boolean;
}

const STORAGE_PREFIX = 'cwf:rating_prompt_dismissed:';
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

export default function RatingCompletionModal({pid, solved}: Props) {
  const {user, accessToken} = useContext(AuthContext) as {
    user: {id: string} | null;
    accessToken: string | null;
  };
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [eligibilityError, setEligibilityError] = useState<number | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  // Track previous solved state so we only open on a false→true transition.
  // Otherwise the modal would also pop on any mount where the puzzle is
  // already solved (e.g. revisiting a snapshot-loaded game).
  const wasSolvedRef = useRef(solved);

  useEffect(() => {
    const wasSolved = wasSolvedRef.current;
    wasSolvedRef.current = solved;
    if (!pid) return;
    if (!solved || wasSolved) return;
    if (readDismissed(pid)) return;
    setOpen(true);
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
        if (pid) writeDismissed(pid);
        setOpen(false);
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

  const handleOpenLogin = useCallback(() => setShowLogin(true), []);
  const handleCloseLogin = useCallback(() => setShowLogin(false), []);
  const handleStarsLeave = useCallback(() => setHover(0), []);

  const display = hover;

  return (
    <>
      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="confirm-dialog--overlay" />
          <Dialog.Content className="confirm-dialog--panel confirm-dialog--centered">
            <Dialog.Title className="confirm-dialog--title confirm-dialog--title-centered">
              Nice solve!
            </Dialog.Title>
            <div className="confirm-dialog--body rating-completion--body">
              {user ? (
                <>
                  <p>How would you rate this puzzle?</p>
                  <div className="rating-completion--stars" onMouseLeave={handleStarsLeave}>
                    {STAR_VALUES.map((n) => (
                      <StarButton
                        key={n}
                        n={n}
                        filled={n <= display}
                        onHover={setHover}
                        onClick={handleSubmit}
                        disabled={submitting}
                      />
                    ))}
                  </div>
                  {eligibilityError != null && (
                    <p className="rating-completion--hint">
                      You need to reach {eligibilityError}% completion before rating.
                    </p>
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
              <button type="button" className="btn btn--outlined" onClick={handleClose} disabled={submitting}>
                Maybe later
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {!user && <LoginModal open={showLogin} onClose={handleCloseLogin} />}
    </>
  );
}

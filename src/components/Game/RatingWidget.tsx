import {useCallback, useContext, useEffect, useState} from 'react';
import {MdStar, MdStarBorder} from 'react-icons/md';
import * as Sentry from '@sentry/react';
import AuthContext from '../../lib/AuthContext';
import LoginModal from '../Auth/LoginModal';
import {
  fetchPuzzleRating,
  submitPuzzleRating,
  RatingNotEligibleError,
  RatingAuthError,
  PuzzleRatingAggregate,
} from '../../api/puzzle_rating';
import './css/RatingWidget.css';

interface RatingWidgetProps {
  pid: string;
}

const STAR_VALUES = [1, 2, 3, 4, 5];

interface StarButtonProps {
  n: number;
  filled: boolean;
  onHover: (n: number) => void;
  onClick: (n: number) => void;
}

function StarButton({n, filled, onHover, onClick}: StarButtonProps) {
  const Icon = filled ? MdStar : MdStarBorder;
  const handleEnter = useCallback(() => onHover(n), [onHover, n]);
  const handleClick = useCallback(() => onClick(n), [onClick, n]);
  return (
    <button
      type="button"
      className="rating-widget--star-btn"
      aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
      onMouseEnter={handleEnter}
      onClick={handleClick}
    >
      <Icon className="rating-widget--star" />
    </button>
  );
}

interface StarRowProps {
  value: number;
  highlight: number;
  onHover?: (n: number) => void;
  onClick?: (n: number) => void;
  interactive: boolean;
}

function StarRow({value, highlight, onHover, onClick, interactive}: StarRowProps) {
  const display = highlight || Math.round(value);
  const handleLeave = useCallback(() => onHover?.(0), [onHover]);
  const noopClick = useCallback(() => undefined, []);
  return (
    <span className="rating-widget--stars" onMouseLeave={handleLeave}>
      {STAR_VALUES.map((n) => {
        const filled = n <= display;
        if (interactive && onClick && onHover) {
          return <StarButton key={n} n={n} filled={filled} onHover={onHover} onClick={onClick} />;
        }
        if (interactive && onClick) {
          return <StarButton key={n} n={n} filled={filled} onHover={noopClick} onClick={onClick} />;
        }
        const Icon = filled ? MdStar : MdStarBorder;
        return <Icon key={n} className="rating-widget--star" />;
      })}
    </span>
  );
}

function formatLabel(aggregate: PuzzleRatingAggregate | null): string {
  if (!aggregate) return '…';
  if (aggregate.average == null) return 'Not yet rated';
  return `${aggregate.average.toFixed(1)} (${aggregate.count})`;
}

export default function RatingWidget({pid}: RatingWidgetProps) {
  const {user, accessToken} = useContext(AuthContext) as {
    user: {id: string} | null;
    accessToken: string | null;
  };
  const [aggregate, setAggregate] = useState<PuzzleRatingAggregate | null>(null);
  const [hover, setHover] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [eligibilityError, setEligibilityError] = useState<number | null>(null);
  const [authError, setAuthError] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Clear stale state so an in-app navigation between puzzles doesn't
    // flash the previous puzzle's aggregate (or a no-longer-applicable
    // eligibility hint) while the new fetch is pending. Chat is mounted
    // without a key in pages/Game.js so the same instance is reused.
    setAggregate(null);
    setEligibilityError(null);
    setAuthError(false);
    setHover(0);
    setSubmitting(false);
    fetchPuzzleRating(pid, accessToken)
      .then((data) => {
        if (!cancelled) setAggregate(data);
      })
      .catch((err) => {
        Sentry.captureException(err);
      });
    return () => {
      cancelled = true;
    };
  }, [pid, accessToken]);

  const handleSubmit = useCallback(
    async (rating: number) => {
      if (!accessToken) return;
      setSubmitting(true);
      setEligibilityError(null);
      setAuthError(false);
      try {
        const next = await submitPuzzleRating(pid, rating, accessToken);
        setAggregate(next);
      } catch (err) {
        if (err instanceof RatingNotEligibleError) {
          setEligibilityError(err.thresholdPercent);
        } else if (err instanceof RatingAuthError) {
          // Session expired — re-prompt sign-in instead of reporting noise.
          setAuthError(true);
          setShowLogin(true);
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

  return (
    <div className="rating-widget">
      <div className="rating-widget--row">
        <StarRow
          value={aggregate?.average ?? 0}
          highlight={user ? hover || aggregate?.userRating || 0 : 0}
          interactive={!!user && !submitting}
          onHover={user ? setHover : undefined}
          onClick={user ? handleSubmit : undefined}
        />
        <span className="rating-widget--label">{formatLabel(aggregate)}</span>
        {!user && (
          <button type="button" className="rating-widget--cta" onClick={handleOpenLogin}>
            Sign in to rate
          </button>
        )}
        {user && aggregate?.userRating != null && !eligibilityError && (
          <span className="rating-widget--your">Your rating: {aggregate.userRating}</span>
        )}
      </div>
      {eligibilityError != null && (
        <div className="rating-widget--hint">Reach {eligibilityError}% completion to rate this puzzle.</div>
      )}
      {authError && (
        <div className="rating-widget--hint">
          Your session expired —{' '}
          <button type="button" className="rating-widget--cta" onClick={handleOpenLogin}>
            sign in again
          </button>{' '}
          to rate.
        </div>
      )}
      {(!user || authError) && <LoginModal open={showLogin} onClose={handleCloseLogin} />}
    </div>
  );
}

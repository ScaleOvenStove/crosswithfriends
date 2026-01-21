/**
 * Puzzle List Item Component
 * Implements REQ-3.1.4: Display puzzle metadata
 */

import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { countersApi, gamesApi, ResponseError } from '@api/apiClient';
import { extractErrorMessage, extractErrorDetails } from '@services/errorInterceptor';
import { useUser } from '@hooks/index';

interface DisplayPuzzle {
  id: string;
  title: string;
  author: string;
  size: string;
  dimensions: {
    width: number;
    height: number;
  };
  numSolves: number;
}

interface PuzzleListItemProps {
  puzzle: DisplayPuzzle;
}

const PuzzleListItem = ({ puzzle }: PuzzleListItemProps) => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState(false);

  const handlePlayClick = async () => {
    if (isCreating) return;

    setIsCreating(true);
    setError(null);
    setIsAuthError(false);
    try {
      // Get a new game ID using the generated SDK
      const gidResponse = await countersApi.getNewGameId();

      // Create the game using the generated SDK
      const result = await gamesApi.createGame({
        gid: gidResponse.gid,
        pid: puzzle.id,
      });

      // Redirect to game variant with new game flag and puzzle ID
      // Pass puzzle ID in URL so we can use it directly without needing to resolve it
      navigate(`/game/${result.gid}?new=true&pid=${puzzle.id}`);
    } catch (err) {
      console.error('Failed to create game:', err);

      // Extract detailed error information
      let errorMessage = 'Failed to create game. Please try again.';
      if (err instanceof ResponseError) {
        const errorDetails = extractErrorDetails(err);
        errorMessage = extractErrorMessage(err);
        setIsAuthError(errorDetails.status === 401);

        // Try to get error body for more details
        try {
          const responseClone = err.response.clone();
          const errorBody = await responseClone.json();
          if (errorBody?.message) {
            errorMessage = errorBody.message;
          } else if (errorBody?.error) {
            errorMessage = errorBody.error;
          }
        } catch {
          // If we can't parse the body, use the status-based message
          if (errorDetails.status === 401) {
            setIsAuthError(true);
            errorMessage = 'Authentication required. Please log in to play.';
          } else if (errorDetails.status === 403) {
            errorMessage = 'You do not have permission to create games.';
          } else if (errorDetails.status === 404) {
            errorMessage = 'Puzzle not found.';
          } else if (errorDetails.status === 500) {
            errorMessage = 'Server error. Please try again later.';
          } else if (errorDetails.status) {
            errorMessage = `Request failed (HTTP ${errorDetails.status}). Please try again.`;
          }
        }

        console.error('Error details:', {
          status: errorDetails.status,
          statusText: errorDetails.statusText,
          url: errorDetails.url,
        });
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setIsCreating(false);
      // Don't navigate to /puzzle to avoid showing puzzle in URL
      // User can try again by clicking the Play button
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Support Enter and Space keys for keyboard navigation
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handlePlayClick();
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handlePlayClick}
      onKeyDown={handleKeyDown}
      aria-label={`Play ${puzzle.title} by ${puzzle.author}, ${puzzle.dimensions.width} by ${puzzle.dimensions.height} puzzle, ${puzzle.numSolves} ${puzzle.numSolves === 1 ? 'solve' : 'solves'}`}
      className={`group relative block bg-white dark:bg-neutral-800 border-2 border-neutral-200 dark:border-neutral-700 rounded-xl p-6 overflow-hidden transition-all duration-300 ${
        isCreating
          ? 'cursor-wait opacity-75'
          : 'cursor-pointer hover:-translate-y-2 hover:shadow-deep'
      } focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
      style={{
        animation: 'fadeInUp 0.6s ease-out',
        animationFillMode: 'both',
      }}
    >
      {/* Decorative gradient overlay on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none"
        style={{
          background:
            'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
        }}
      />

      <div className="relative flex flex-col gap-4">
        <div className="flex-1">
          <div
            className="inline-block px-3 py-1.5 rounded-md text-xs font-bold uppercase mb-3 text-white"
            style={{
              background:
                'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)',
              fontFamily: 'var(--font-display)',
              letterSpacing: '0.05em',
            }}
            aria-label={`Puzzle size: ${puzzle.size}`}
          >
            {puzzle.size}
          </div>
          <h3
            className="text-xl font-bold mb-2 text-neutral-900 dark:text-neutral-100"
            style={{
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.01em',
            }}
          >
            {puzzle.title}
          </h3>
          <p
            className="text-sm mb-3 text-neutral-600 dark:text-neutral-400 italic"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            by {puzzle.author}
          </p>
          <div className="flex gap-4 text-sm text-neutral-500 dark:text-neutral-400">
            <span
              aria-label={`Dimensions: ${puzzle.dimensions.width} by ${puzzle.dimensions.height}`}
            >
              {puzzle.dimensions.width}×{puzzle.dimensions.height}
            </span>
            <span aria-label={`${puzzle.numSolves} ${puzzle.numSolves === 1 ? 'solve' : 'solves'}`}>
              {puzzle.numSolves} solve{puzzle.numSolves !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 items-end">
          {error && (
            <div
              className="text-xs text-red-600 dark:text-red-400 px-3 py-1.5 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 max-w-full"
              role="alert"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {error}
              {isAuthError && !user && (
                <div className="mt-2">
                  <Link
                    to="/account"
                    className="text-primary hover:underline font-semibold"
                    style={{ fontFamily: 'var(--font-display)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    Log in to play →
                  </Link>
                </div>
              )}
            </div>
          )}
          <span
            className="px-5 py-2.5 text-white font-semibold rounded-lg text-sm pointer-events-none transition-all duration-300 group-hover:scale-105"
            style={{
              background:
                'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)',
              fontFamily: 'var(--font-display)',
              boxShadow: '0 2px 8px rgba(44, 62, 80, 0.3)',
            }}
            aria-hidden="true"
          >
            {isCreating ? 'Creating...' : 'Play'}
          </span>
        </div>
      </div>
    </article>
  );
};

export default PuzzleListItem;

/**
 * Puzzle List Item Component
 * Implements REQ-3.1.4: Display puzzle metadata
 */

import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { countersApi, gamesApi } from '@api/apiClient';

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
  const [isCreating, setIsCreating] = useState(false);

  const handlePlayClick = async () => {
    if (isCreating) return;

    setIsCreating(true);
    try {
      // Get a new game ID using the generated SDK
      const gidResponse = await countersApi.getNewGameId();

      // Create the game using the generated SDK
      const result = await gamesApi.createGame({
        gid: gidResponse.gid,
        pid: puzzle.id,
      });

      // Redirect to game variant with new game flag
      navigate(`/game/${result.gid}?new=true`);
    } catch (err) {
      console.error('Failed to create game:', err);
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
      className={`block bg-white border border-gray-200 rounded-lg p-6 hover:-translate-y-1 hover:shadow-xl hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200 ${
        isCreating ? 'cursor-wait opacity-75' : 'cursor-pointer'
      }`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex-1">
          <div
            className="inline-block bg-primary text-white px-3 py-1 rounded text-xs font-semibold uppercase mb-3"
            aria-label={`Puzzle size: ${puzzle.size}`}
          >
            {puzzle.size}
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">{puzzle.title}</h3>
          <p className="text-sm text-gray-600 mb-3">by {puzzle.author}</p>
          <div className="flex gap-4 text-sm text-gray-500">
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
        <div className="flex justify-end">
          <span
            className="px-5 py-2 bg-primary text-white font-semibold rounded-lg text-sm pointer-events-none"
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

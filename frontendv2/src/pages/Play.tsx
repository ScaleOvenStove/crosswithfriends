/**
 * Play Page - Play puzzle by ID
 * Implements REQ-4.4: Play Mode
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Nav from '@components/common/Nav';
import { GameSkeleton } from '@components/common/skeletons';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { usePuzzle, useUser } from '@hooks/index';
import { countersApi, gamesApi } from '@api/apiClient';

const Play = () => {
  const { pid } = useParams<{ pid: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const { isLoading, error } = usePuzzle(pid);
  const [isCreatingGame, setIsCreatingGame] = useState(false);

  useEffect(() => {
    // Auto-create game when puzzle loads
    if (pid && user && !isCreatingGame) {
      setIsCreatingGame(true);
      // First get a new game ID
      countersApi
        .getNewGameId()
        .then((gidResponse) => {
          // Then create the game using the new generated API
          return gamesApi.createGame({ gid: gidResponse.gid, pid });
        })
        .then((result) => {
          // Redirect to game variant with new game flag
          navigate(`/game/${result.gid}?new=true`);
        })
        .catch((err) => {
          console.error('Failed to create game:', err);
          setIsCreatingGame(false);
        });
    }
  }, [pid, user, navigate, isCreatingGame]);

  if (!pid) {
    return (
      <div className="play-page">
        <Nav />
        <div className="container">
          <div className="error-message">Invalid puzzle ID</div>
        </div>
      </div>
    );
  }

  if (isLoading || isCreatingGame) {
    return (
      <div className="play-page">
        <Nav />
        <GameSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="play-page">
        <Nav />
        <div className="container">
          <div className="error-message">Failed to load puzzle. Please try again.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="play-page">
      <Nav />
      <div className="container">
        <LoadingSpinner text="Redirecting to game..." />
      </div>
    </div>
  );
};

export default Play;

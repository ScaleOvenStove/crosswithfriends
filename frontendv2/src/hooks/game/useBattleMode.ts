/**
 * useBattleMode - Hook for Battle and Fencing competitive game modes
 * Implements real-time competition tracking and scoring
 */

import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '@sockets/index';

interface Player {
  id: string;
  displayName: string;
  color: string;
  score: number;
  completedCells: number;
  isFinished: boolean;
}

interface CellOwnership {
  [key: string]: string; // "row-col": playerId
}

interface BattleModeOptions {
  gameId: string;
  mode: 'battle' | 'fencing';
  // eslint-disable-next-line no-unused-vars
  onGameComplete?: (winner: Player) => void;
}

export const useBattleMode = ({ gameId, mode, onGameComplete }: BattleModeOptions) => {
  const { socket, isConnected } = useSocket();
  const [players, setPlayers] = useState<Player[]>([]);
  const [cellOwnership, setCellOwnership] = useState<CellOwnership>({});
  const [isGameActive, setIsGameActive] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);

  // Join game and sync initial state
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.emit('join_game', gameId, (response: { success?: boolean }) => {
      if (response.success) {
        setIsGameActive(true);
      }
    });

    return () => {
      socket.emit('leave_game', gameId);
    };
  }, [socket, isConnected, gameId]);

  // Listen for player join/leave events
  useEffect(() => {
    if (!socket) return;

    const handlePlayerJoin = (data: { player: Player }) => {
      setPlayers((prev) => {
        if (prev.find((p) => p.id === data.player.id)) return prev;
        return [...prev, data.player];
      });
    };

    const handlePlayerLeave = (data: { playerId: string }) => {
      setPlayers((prev) => prev.filter((p) => p.id !== data.playerId));
    };

    const handlePlayerEvents = (event: { type: string; [key: string]: unknown }) => {
      if (event.type === 'player_join') {
        handlePlayerJoin(event as unknown as { player: Player });
      } else if (event.type === 'player_leave') {
        handlePlayerLeave(event as unknown as { playerId: string });
      }
    };

    socket.on('game_event', handlePlayerEvents);

    return () => {
      socket.off('game_event', handlePlayerEvents);
    };
  }, [socket]);

  // Listen for cell fill events
  useEffect(() => {
    if (!socket || mode !== 'fencing') return;

    const handleCellFill = (event: {
      type: string;
      playerId: string;
      row: number;
      col: number;
      value: string;
    }) => {
      if (event.type === 'cell_fill') {
        const cellKey = `${event.row}-${event.col}`;

        // In fencing mode, first player to fill gets ownership
        setCellOwnership((prev) => {
          if (prev[cellKey]) return prev; // Already claimed
          return { ...prev, [cellKey]: event.playerId };
        });

        // Update player score
        setPlayers((prev) =>
          prev.map((player) =>
            player.id === event.playerId
              ? { ...player, score: player.score + 1, completedCells: player.completedCells + 1 }
              : player
          )
        );
      }
    };

    socket.on('game_event', handleCellFill);

    return () => {
      socket.off('game_event', handleCellFill);
    };
  }, [socket, mode]);

  // Listen for game completion
  useEffect(() => {
    if (!socket) return;

    const handleGameComplete = (event: { type: string; playerId: string; time: number }) => {
      if (event.type === 'puzzle_complete') {
        // In battle mode, first to complete wins
        if (mode === 'battle' && !winner) {
          setPlayers((prev) => {
            const completingPlayer = prev.find((p) => p.id === event.playerId);
            if (completingPlayer) {
              setWinner(completingPlayer);
              setIsGameActive(false);
              onGameComplete?.(completingPlayer);
            }
            
            return prev.map((player) =>
              player.id === event.playerId ? { ...player, isFinished: true } : player
            );
          });
        } else {
          // For non-battle mode or if winner already set, just update the state
          setPlayers((prev) =>
            prev.map((player) =>
              player.id === event.playerId ? { ...player, isFinished: true } : player
            )
          );
        }
      }
    };

    socket.on('game_event', handleGameComplete);

    return () => {
      socket.off('game_event', handleGameComplete);
    };
  }, [socket, mode, winner, onGameComplete]);

  // Claim cell (for fencing mode)
  const claimCell = useCallback(
    (row: number, col: number, value: string, playerId: string) => {
      if (!socket || mode !== 'fencing') return;

      const cellKey = `${row}-${col}`;

      // Check if cell is already claimed
      if (cellOwnership[cellKey]) return false;

      // Emit cell fill event
      socket.emit('game_event', {
        gid: gameId,
        event: {
          type: 'cell_fill',
          playerId,
          row,
          col,
          value,
          timestamp: Date.now(),
        },
      });

      return true;
    },
    [socket, mode, cellOwnership, gameId]
  );

  // Get cell owner
  const getCellOwner = useCallback(
    (row: number, col: number): string | null => {
      const cellKey = `${row}-${col}`;
      return cellOwnership[cellKey] || null;
    },
    [cellOwnership]
  );

  // Get sorted leaderboard
  const leaderboard = [...players].sort((a, b) => {
    if (mode === 'battle') {
      // In battle mode, finished players rank higher
      if (a.isFinished && !b.isFinished) return -1;
      if (!a.isFinished && b.isFinished) return 1;
      return b.completedCells - a.completedCells;
    } else {
      // In fencing mode, sort by score
      return b.score - a.score;
    }
  });

  return {
    players,
    leaderboard,
    cellOwnership,
    isGameActive,
    winner,
    claimCell,
    getCellOwner,
  };
};

export default useBattleMode;

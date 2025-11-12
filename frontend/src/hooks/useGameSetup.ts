/**
 * Custom hook for game setup and initialization
 * Handles game attachment, opponent game setup, and display name updates
 */

import {useEffect, useRef} from 'react';
import {useGame} from './useGame';
import type {BattleData} from '../types/battle';
import {createSafePath} from '../store/firebaseUtils';

interface UseGameSetupOptions {
  gid: string | undefined;
  opponent: string | undefined;
  onBattleData?: (data: BattleData) => void;
  onArchived?: () => void;
  initialUsername?: string;
}

interface UseGameSetupReturn {
  gameHook: ReturnType<typeof useGame>;
  opponentGameHook: ReturnType<typeof useGame>;
  game: ReturnType<typeof useGame>['gameState'];
  opponentGame: ReturnType<typeof useGame>['gameState'];
}

export function useGameSetup({
  gid,
  opponent,
  onBattleData,
  onArchived,
  initialUsername,
}: UseGameSetupOptions): UseGameSetupReturn {
  const gameHookRef = useRef<ReturnType<typeof useGame> | null>(null);
  const opponentGameHookRef = useRef<ReturnType<typeof useGame> | null>(null);
  
  // Create paths
  const gamePath = gid ? createSafePath('/game', gid) : '';
  const opponentGamePath = opponent ? createSafePath('/game', opponent) : '';

  // Main game hook
  const gameHook = useGame({
    path: gamePath || '',
    onBattleData: (battleData: unknown) => {
      if (battleData && onBattleData) {
        onBattleData(battleData as BattleData);
      }
    },
    onArchived: () => {
      onArchived?.();
    },
  });

  // Opponent game hook
  const opponentGameHook = useGame({
    path: opponentGamePath || '',
  });

  // Store latest hook references
  gameHookRef.current = gameHook;
  opponentGameHookRef.current = opponentGameHook;

  // Attach/detach game when gid changes
  useEffect(() => {
    if (gid && gamePath && gameHookRef.current) {
      gameHookRef.current.attach();
      return () => {
        if (gameHookRef.current) {
          gameHookRef.current.detach();
        }
      };
    }
  }, [gid, gamePath]);

  // Attach/detach opponent game when opponent changes
  useEffect(() => {
    if (opponent && opponentGamePath && opponentGameHookRef.current) {
      opponentGameHookRef.current.attach();
      return () => {
        if (opponentGameHookRef.current) {
          opponentGameHookRef.current.detach();
        }
      };
    }
  }, [opponent, opponentGamePath]);

  // Note: Display name update is handled in Game.tsx after game is attached
  // We don't update it here to avoid calling before game is initialized

  return {
    gameHook,
    opponentGameHook,
    game: gameHook.gameState,
    opponentGame: opponentGameHook.gameState,
  };
}


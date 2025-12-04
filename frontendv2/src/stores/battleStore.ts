/**
 * Battle Store - Manages battle mode state and team competition
 * Implements REQ-10.1.3: Battle state management via Zustand
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface Team {
  id: string;
  name: string;
  color: string;
  users: string[];
  gameId: string;
  isComplete: boolean;
  solveTime?: number;
}

interface Powerup {
  id: string;
  type: string;
  position: { row: number; col: number };
  isCollected: boolean;
  collectedBy?: string;
}

interface BattleStore {
  // State
  battleId: string | null;
  teams: Team[];
  powerups: Powerup[];
  currentTeamId: string | null;
  isStarted: boolean;
  winner: string | null;

  // Actions
  setBattleId: (battleId: string) => void;
  setTeams: (teams: Team[]) => void;
  addTeam: (team: Team) => void;
  updateTeam: (teamId: string, updates: Partial<Team>) => void;
  setCurrentTeam: (teamId: string) => void;
  setPowerups: (powerups: Powerup[]) => void;
  collectPowerup: (powerupId: string, userId: string) => void;
  startBattle: () => void;
  setWinner: (teamId: string) => void;
  resetBattle: () => void;
}

const initialState = {
  battleId: null,
  teams: [],
  powerups: [],
  currentTeamId: null,
  isStarted: false,
  winner: null,
};

export const useBattleStore = create<BattleStore>()(
  devtools(
    (set) => ({
      ...initialState,

      setBattleId: (battleId) => set({ battleId }),

      setTeams: (teams) => set({ teams }),

      addTeam: (team) =>
        set((state) => ({
          teams: [...state.teams.filter((t) => t.id !== team.id), team],
        })),

      updateTeam: (teamId, updates) =>
        set((state) => ({
          teams: state.teams.map((team) => (team.id === teamId ? { ...team, ...updates } : team)),
        })),

      setCurrentTeam: (teamId) => set({ currentTeamId: teamId }),

      setPowerups: (powerups) => set({ powerups }),

      collectPowerup: (powerupId, userId) =>
        set((state) => ({
          powerups: state.powerups.map((p) =>
            p.id === powerupId ? { ...p, isCollected: true, collectedBy: userId } : p
          ),
        })),

      startBattle: () => set({ isStarted: true }),

      setWinner: (teamId) => set({ winner: teamId }),

      resetBattle: () => set(initialState),
    }),
    { name: 'BattleStore' }
  )
);

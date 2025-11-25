import {renderHook, waitFor} from '@testing-library/react';
import {describe, it, expect, vi, beforeEach} from 'vitest';

import {useGameSetup} from '../../hooks/useGameSetup';
import {createMockGameStore} from '../mocks/stores';

const mockUseGame = vi.fn();

// Mock useGame
vi.mock('../../hooks/useGame', () => ({
  useGame: (options: unknown) => mockUseGame(options),
}));

// Mock firebaseUtils
vi.mock('../../store/firebaseUtils', () => ({
  createSafePath: vi.fn((prefix: string, id: string) => `${prefix}/${id}`),
  isValidFirebasePath: vi.fn((path: string) => path.startsWith('/game/')),
  extractAndValidateGid: vi.fn((path: string) => path.replace('/game/', '')),
}));

describe('useGameSetup', () => {
  let mockGameHook: ReturnType<typeof createMockGameStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGameHook = createMockGameStore();
    mockGameHook.attach = vi.fn().mockResolvedValue(undefined);
    mockGameHook.detach = vi.fn();
    mockGameHook.gameState = null;

    mockUseGame.mockReturnValue({
      game: null,
      gameState: null,
      attach: mockGameHook.attach,
      detach: mockGameHook.detach,
      updateCell: vi.fn(),
      updateCursor: vi.fn(),
      addPing: vi.fn(),
      updateDisplayName: vi.fn(),
      updateColor: vi.fn(),
      updateClock: vi.fn(),
      check: vi.fn(),
      reveal: vi.fn(),
      reset: vi.fn(),
      chat: vi.fn(),
      subscribe: vi.fn(() => () => {}),
      once: vi.fn(() => () => {}),
      ready: false,
    });
  });

  it('should return game hooks and game states', () => {
    const {result} = renderHook(() => useGameSetup({gid: 'test-123', opponent: undefined}));

    expect(result.current.gameHook).toBeDefined();
    expect(result.current.opponentGameHook).toBeDefined();
    expect(result.current.game).toBeDefined();
    expect(result.current.opponentGame).toBeDefined();
  });

  it('should attach game when gid is provided', async () => {
    renderHook(() => useGameSetup({gid: 'test-123', opponent: undefined}));

    await waitFor(() => {
      expect(mockGameHook.attach).toHaveBeenCalled();
    });
  });

  it('should attach opponent game when opponent is provided', async () => {
    renderHook(() => useGameSetup({gid: 'test-123', opponent: 'opponent-456'}));

    await waitFor(() => {
      expect(mockGameHook.attach).toHaveBeenCalledTimes(2); // Both games
    });
  });

  it('should call onBattleData when battle data is received', async () => {
    const onBattleData = vi.fn();
    const battleData = {team: 0};

    renderHook(() => useGameSetup({gid: 'test-123', opponent: undefined, onBattleData}));

    // Get the onBattleData callback from the first call to mockUseGame (main game, not opponent)
    const firstCall = mockUseGame.mock.calls[0];
    expect(firstCall).toBeDefined();
    const capturedOnBattleData = firstCall[0].onBattleData;
    expect(capturedOnBattleData).toBeDefined();

    // Trigger the callback
    capturedOnBattleData(battleData);

    // Verify the callback was called
    expect(onBattleData).toHaveBeenCalledWith(battleData);
  });

  it('should call onArchived when game is archived', async () => {
    const onArchived = vi.fn();

    renderHook(() => useGameSetup({gid: 'test-123', opponent: undefined, onArchived}));

    // Get the onArchived callback from the first call to mockUseGame (main game, not opponent)
    const firstCall = mockUseGame.mock.calls[0];
    expect(firstCall).toBeDefined();
    const capturedOnArchived = firstCall[0].onArchived;
    expect(capturedOnArchived).toBeDefined();

    // Trigger the callback
    capturedOnArchived();

    // Verify the callback was called
    expect(onArchived).toHaveBeenCalled();
  });

  it('should detach games on unmount', async () => {
    const {unmount} = renderHook(() => useGameSetup({gid: 'test-123', opponent: 'opponent-456'}));

    await waitFor(() => {
      expect(mockGameHook.attach).toHaveBeenCalled();
    });

    unmount();

    expect(mockGameHook.detach).toHaveBeenCalledTimes(2); // Both games
  });

  it('should not attach if gid is undefined', () => {
    renderHook(() => useGameSetup({gid: undefined, opponent: undefined}));

    expect(mockGameHook.attach).not.toHaveBeenCalled();
  });
});

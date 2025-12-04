/**
 * Game hook for managing game state and interactions
 * Implements REQ-1: Core Gameplay Features
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useGameStore } from '@stores/gameStore';
import { useSocket, useSocketEvent, useSocketEmit } from '@sockets/index';
import { useUser } from '@hooks/user/useUser';
import { puzzlesApi, gamesApi } from '@api/apiClient';
import { ResponseError } from '@api/generated';
import { API_BASE_URL } from '../../config';
import {
  transformPuzzleToGrid,
  assignCellNumbers,
  extractCluesFromPuzzle,
} from '@utils/puzzleUtils';

export const useGame = (gameId: string | undefined) => {
  const {
    setGameId,
    setPuzzleId,
    setCells,
    setSolution,
    setClues,
    cells,
    users,
    selectedCell,
    selectedDirection,
    isPencilMode,
    isComplete,
    clock,
    startTime,
    updateCell,
    addUser,
    removeUser,
    updateCursor,
    setSelectedCell,
    toggleDirection,
    togglePencilMode,
    setComplete,
    startClock,
    pauseClock,
    resetClock,
  } = useGameStore();

  const { user } = useUser();
  const { connect, disconnect, isConnected, socket } = useSocket();
  const { emit } = useSocketEmit();
  const [isLoadingPuzzle, setIsLoadingPuzzle] = useState(false);
  const [hasLoadedPuzzle, setHasLoadedPuzzle] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch game and puzzle data when game ID changes
  useEffect(() => {
    if (!gameId || hasLoadedPuzzle) return;

    const loadGameData = async () => {
      try {
        setIsLoadingPuzzle(true);
        setLoadError(null);
        console.log('[Game] Loading data for:', gameId);

        let puzzleId: string = gameId;

        // Try to fetch as a game ID first (for completed games only)
        // Note: GET /api/game/:gid only returns completed games from puzzle_solves table
        try {
          const gameInfo = await gamesApi.getGameById(gameId);
          console.log('[Game] Loaded completed game info:', gameInfo);
          if (gameInfo.pid) {
            puzzleId = gameInfo.pid;
          }
        } catch {
          // If 404, this could be:
          // 1. An active game ID (exists in game_events, not in puzzle_solves)
          // 2. A puzzle ID (for backward compatibility)
          console.log('[Game] Not a completed game, checking if it is an active game...');
          
          // Try to get puzzle ID from active game (game_events table)
          try {
            const response = await fetch(`${API_BASE_URL}/game/${gameId}/pid`);
            if (response.ok) {
              const activeGameInfo = await response.json();
              if (activeGameInfo.pid) {
                puzzleId = activeGameInfo.pid;
                console.log('[Game] Found active game with puzzle ID:', puzzleId);
              } else {
                console.log('[Game] Active game found but no puzzle ID, treating as puzzle ID');
              }
            } else {
              // Not an active game either, treat as puzzle ID (backward compatibility)
              console.log('[Game] Not an active game either, treating as puzzle ID');
            }
          } catch {
            // Failed to check active game, treat as puzzle ID (backward compatibility)
            console.log('[Game] Failed to check active game, treating as puzzle ID');
          }
        }

        // Fetch the puzzle data
        console.log('[Game] Fetching puzzle:', puzzleId);
        const puzzleData = await puzzlesApi.getPuzzleById(puzzleId);

        if (!puzzleData) {
          throw new Error('Puzzle data is invalid');
        }

        console.log('[Game] Loaded puzzle successfully');
        console.log('[Game] Puzzle data keys:', Object.keys(puzzleData));
        if (process.env.NODE_ENV === 'development') {
          // Sanitize puzzle data for logging - omit solution
          const sanitizedPuzzle = { ...puzzleData };
          delete sanitizedPuzzle.solution;
          console.log('[Game] Puzzle data structure:', {
            hasDimensions: !!puzzleData.dimensions,
            hasSolution: !!puzzleData.solution,
            hasPuzzle: !!puzzleData.puzzle,
            hasClues: !!puzzleData.clues,
            dimensions: puzzleData.dimensions,
            solutionType: typeof puzzleData.solution,
            puzzleType: typeof puzzleData.puzzle,
            sanitizedData: sanitizedPuzzle,
          });
        }

        // Transform the ipuz puzzle data into our Cell format
        // Cast to PuzzleJson as the generated type is compatible at runtime
        const { cells: transformedCells, solution } = transformPuzzleToGrid(puzzleData as any);

        // Auto-assign numbers if not already present
        const cellsWithNumbers = assignCellNumbers(transformedCells);

        // Extract clues from the puzzle
        const clues = extractCluesFromPuzzle(puzzleData as any);
        console.log('[Game] Extracted clues:', {
          across: clues.across.length,
          down: clues.down.length,
        });

        console.log(
          '[Game] Setting cells:',
          cellsWithNumbers.length,
          'x',
          cellsWithNumbers[0]?.length
        );
        setCells(cellsWithNumbers);
        setSolution(solution);
        setClues(clues);
        setPuzzleId(puzzleId);

        setHasLoadedPuzzle(true);
        setIsLoadingPuzzle(false);
        console.log('[Game] Ready to play');
      } catch (error) {
        console.error('[Game] Failed to load puzzle data:', error);

        // Improved error message extraction
        let errorMessage = 'Failed to load puzzle';

        // Check if it's a ResponseError from the generated API
        if (error instanceof ResponseError) {
          const status = error.response.status;
          const statusText = error.response.statusText;
          
          // Try to get error details from response body
          let bodyMessage = '';
          try {
            const clonedResponse = error.response.clone();
            const body = await clonedResponse.json().catch(() => null);
            if (body && typeof body === 'object') {
              bodyMessage = body.message || body.error || '';
            }
          } catch {
            // Ignore JSON parsing errors
          }

          if (status === 404) {
            errorMessage = `Puzzle "${gameId}" not found. It may have been deleted or the ID is incorrect.`;
          } else if (status === 500) {
            // Check if it's a schema validation error
            if (bodyMessage && bodyMessage.includes('does not match schema')) {
              errorMessage = `Puzzle data format error: This puzzle's data doesn't match the expected format. This may be due to an outdated puzzle format. Please contact support if this issue persists.`;
              console.error('[Game] Schema Validation Error:', {
                status,
                bodyMessage,
                url: error.response.url,
                hint: 'The puzzle data in the database may be in an older format that needs migration.',
              });
            } else {
              errorMessage = bodyMessage || 'Server error while loading puzzle. Please try again later.';
            }
          } else if (status >= 400) {
            errorMessage = bodyMessage || `Failed to load puzzle (HTTP ${status} ${statusText})`;
          }
          
          console.error('[Game] API Error:', {
            status,
            statusText,
            bodyMessage,
            url: error.response.url,
          });
        } else if (error instanceof Error) {
          errorMessage = error.message || errorMessage;
        } else if (error && typeof error === 'object' && 'message' in error) {
          errorMessage = String((error as any).message) || errorMessage;
        }

        // If error message is still empty or generic, provide more context
        if (!errorMessage || errorMessage === '') {
          errorMessage = `Unable to load puzzle ${gameId}. The puzzle may not exist or the server may be unavailable.`;
        }

        setLoadError(errorMessage);
        setHasLoadedPuzzle(true);
        setIsLoadingPuzzle(false);
      }
    };

    loadGameData();
  }, [gameId, hasLoadedPuzzle, setCells, setSolution, setClues, setPuzzleId]);

  // Connect socket when game mounts
  useEffect(() => {
    if (gameId) {
      setGameId(gameId);
      console.log('[Game] Connecting socket for game:', gameId);
      connect();
    }

    return () => {
      console.log('[Game] Disconnecting socket');
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // Track if we've synced events for this game
  const [hasSyncedEvents, setHasSyncedEvents] = useState(false);

  // Join game when connected and sync game state
  useEffect(() => {
    if (isConnected && gameId && user && hasLoadedPuzzle && socket && !hasSyncedEvents) {
      console.log('[Game] Joining game:', gameId, 'as user:', user.displayName);
      
      // Join the game room
      socket.emit('join_game', gameId, (response: { success?: boolean; error?: string }) => {
        if (response.error) {
          console.error('[Game] Failed to join game:', response.error);
          return;
        }
        
        if (response.success) {
          console.log('[Game] Successfully joined game, syncing events...');
          
          // Sync all game events to restore game state
          socket.emit('sync_all_game_events', gameId, (events: any[] | { error?: string }) => {
            if (Array.isArray(events)) {
              console.log('[Game] Synced', events.length, 'game events');
              
              // Sort events by timestamp to apply in chronological order
              const sortedEvents = [...events].sort((a, b) => {
                const timeA = a.timestamp || 0;
                const timeB = b.timestamp || 0;
                return timeA - timeB;
              });
              
              // Filter and apply updateCell events to restore game state
              const updateCellEvents = sortedEvents.filter(
                (event) => event.type === 'updateCell' && event.params
              );
              
              console.log('[Game] Applying', updateCellEvents.length, 'updateCell events to restore state');
              
              // Apply events - retry if cells aren't ready yet
              const applyEvents = (retryCount = 0) => {
                // Get current cells from store to avoid stale closure
                const storeState = useGameStore.getState();
                const currentCells = storeState.cells;
                
                if (currentCells.length === 0) {
                  if (retryCount < 20) {
                    // Retry up to 20 times (1 second total)
                    console.warn('[Game] Cells not initialized yet, retrying...', retryCount + 1);
                    setTimeout(() => applyEvents(retryCount + 1), 50);
                    return;
                  } else {
                    console.error('[Game] Cells still not initialized after retries, skipping state restoration');
                    setHasSyncedEvents(true);
                    return;
                  }
                }
                
                // Apply events in order (cells are ready)
                let appliedCount = 0;
                updateCellEvents.forEach((event) => {
                  if (event.params) {
                    const { cell, value } = event.params;
                    if (cell && typeof cell.r === 'number' && typeof cell.c === 'number') {
                      // Validate cell coordinates are within bounds
                      const cellRow = currentCells[cell.r];
                      if (
                        cell.r >= 0 &&
                        cell.r < currentCells.length &&
                        cell.c >= 0 &&
                        cellRow &&
                        cell.c < cellRow.length
                      ) {
                        updateCell(cell.r, cell.c, value || '', false);
                        appliedCount++;
                      } else {
                        console.warn('[Game] Cell coordinates out of bounds:', {
                          row: cell.r,
                          col: cell.c,
                          gridSize: { rows: currentCells.length, cols: currentCells[0]?.length },
                        });
                      }
                    } else {
                      console.warn('[Game] Invalid cell coordinates in event:', event);
                    }
                  }
                });
                console.log('[Game] Game state restored -', appliedCount, 'of', updateCellEvents.length, 'cell updates applied');
                setHasSyncedEvents(true);
              };
              
              // Start applying events
              applyEvents();
              
              // Handle game completion events
              const completeEvents = sortedEvents.filter(
                (event) => event.type === 'puzzle_complete' || event.type === 'gameComplete'
              );
              if (completeEvents.length > 0) {
                console.log('[Game] Game was completed, setting complete state');
                setComplete(true);
                pauseClock();
              }
              
              // Handle clock events to restore clock state
              const clockEvents = sortedEvents.filter(
                (event) => event.type === 'clockStart' || event.type === 'clockPause' || event.type === 'clockReset'
              );
              
              if (clockEvents.length > 0) {
                console.log('[Game] Restoring clock state from', clockEvents.length, 'clock events');
                
                // Process clock events chronologically to determine final state
                // elapsedTime accumulates time from completed sessions (start->pause cycles)
                let clockState = {
                  isRunning: false,
                  elapsedTime: 0,
                  lastStartTime: null as number | null,
                };
                
                clockEvents.forEach((event) => {
                  if (!event.timestamp) return;
                  
                  if (event.type === 'clockReset') {
                    clockState = {
                      isRunning: false,
                      elapsedTime: 0,
                      lastStartTime: null,
                    };
                  } else if (event.type === 'clockStart') {
                    // If we were already running, save the elapsed time from that session first
                    if (clockState.isRunning && clockState.lastStartTime) {
                      const sessionSeconds = Math.floor((event.timestamp - clockState.lastStartTime) / 1000);
                      clockState.elapsedTime += sessionSeconds;
                    }
                    // Start a new session
                    clockState.isRunning = true;
                    clockState.lastStartTime = event.timestamp;
                  } else if (event.type === 'clockPause') {
                    if (clockState.isRunning && clockState.lastStartTime) {
                      // Calculate elapsed time for this session and add to total
                      const sessionSeconds = Math.floor((event.timestamp - clockState.lastStartTime) / 1000);
                      clockState.elapsedTime += sessionSeconds;
                    }
                    clockState.isRunning = false;
                    clockState.lastStartTime = null;
                  }
                });
                
                // If clock is still running, set startTime to the last start event timestamp
                // The interval will calculate: elapsedTime + (now - startTime) / 1000
                // elapsedTime contains all completed sessions, startTime is when current session started
                const startTime = clockState.isRunning && clockState.lastStartTime 
                  ? clockState.lastStartTime 
                  : null;
                
                console.log('[Game] Restored clock state:', {
                  isRunning: clockState.isRunning,
                  elapsedTime: clockState.elapsedTime,
                  startTime,
                });
                useGameStore.setState({
                  clock: { isRunning: clockState.isRunning, elapsedTime: clockState.elapsedTime },
                  startTime,
                });
              }
              
              if (updateCellEvents.length === 0 && completeEvents.length === 0 && clockEvents.length === 0) {
                console.log('[Game] No state-restoring events found');
                setHasSyncedEvents(true);
              }
            } else if (events && typeof events === 'object' && 'error' in events) {
              console.error('[Game] Failed to sync game events:', events.error);
            }
          });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, gameId, user, hasLoadedPuzzle, socket, hasSyncedEvents]);

  // Reset sync flag when gameId changes
  useEffect(() => {
    setHasSyncedEvents(false);
  }, [gameId]);

  // Socket event handlers
  useSocketEvent('userJoined', (data) => {
    console.log('[Game] User joined:', data.user);
    addUser(data.user);
  });

  useSocketEvent('userLeft', (data) => {
    console.log('[Game] User left:', data.userId);
    removeUser(data.userId);
  });

  // Listen for real-time cell updates via game_event
  useSocketEvent('game_event', (event: any) => {
    console.log('[Game] Received game_event:', {
      type: event.type,
      user: event.user,
      timestamp: event.timestamp,
      params: event.params,
      fullEvent: event,
    });
    
    if (event.type === 'updateCell' && event.params) {
      const { cell, value } = event.params;
      if (cell && typeof cell.r === 'number' && typeof cell.c === 'number') {
        console.log('[Game] Applying updateCell event:', { row: cell.r, col: cell.c, value });
        updateCell(cell.r, cell.c, value || '', false);
      } else {
        console.warn('[Game] Invalid updateCell event params:', { cell, value, params: event.params });
      }
    } else if (event.type === 'updateCursor' && event.params) {
      console.log('[Game] Received updateCursor event:', event.params);
      const cell = event.params.cell;
      const userId = event.params.id || event.user;
      if (cell && typeof cell.r === 'number' && typeof cell.c === 'number' && userId) {
        // Only update cursor if it's from another user
        if (userId !== user?.id) {
          updateCursor(userId, cell.r, cell.c);
        }
      }
    } else if (event.type === 'clockStart' && event.timestamp) {
      // Only apply if it's from another user (ignore our own events)
      if (event.user !== user?.id) {
        console.log('[Game] Applying clockStart event:', { timestamp: event.timestamp, user: event.user });
        const state = useGameStore.getState();
        // If clock was running, we need to save the elapsed time first
        let baseElapsedTime = state.clock.elapsedTime;
        if (state.startTime) {
          // Calculate elapsed time up to now and add to base
          const now = Date.now();
          const currentSessionSeconds = Math.floor((now - state.startTime) / 1000);
          baseElapsedTime = state.clock.elapsedTime + currentSessionSeconds;
        }
        // Use the event timestamp as the server time when clock started
        // Preserve the accumulated elapsedTime
        useGameStore.setState({
          clock: { isRunning: true, elapsedTime: baseElapsedTime },
          startTime: event.timestamp,
        });
      }
    } else if (event.type === 'clockPause' && event.timestamp) {
      // Only apply if it's from another user
      if (event.user !== user?.id) {
        const state = useGameStore.getState();
        if (state.startTime) {
          // Calculate elapsed time up to the pause event timestamp
          const currentSessionSeconds = Math.floor((event.timestamp - state.startTime) / 1000);
          const totalElapsedSeconds = state.clock.elapsedTime + currentSessionSeconds;
          console.log('[Game] Applying clockPause event:', { timestamp: event.timestamp, user: event.user, elapsed: totalElapsedSeconds });
          useGameStore.setState({
            clock: { ...state.clock, isRunning: false, elapsedTime: totalElapsedSeconds },
            startTime: null,
          });
        } else {
          // If no startTime, just pause
          useGameStore.setState({
            clock: { ...state.clock, isRunning: false },
          });
        }
      }
    } else if (event.type === 'clockReset') {
      // Only apply if it's from another user
      if (event.user !== user?.id) {
        console.log('[Game] Applying clockReset event:', { user: event.user });
        resetClock();
      }
    } else {
      console.log('[Game] Unhandled game_event type:', event.type);
    }
  });

  // Also listen for cellUpdated events (backward compatibility)
  useSocketEvent('cellUpdated', (data) => {
    console.log('[Game] Cell updated:', data);
    updateCell(data.row, data.col, data.value, data.isPencil);
  });

  useSocketEvent('gameComplete', () => {
    console.log('[Game] Game complete!');
    setComplete(true);
    pauseClock();
  });

  // Cell update handler
  const handleCellUpdate = useCallback(
    (row: number, col: number, value: string) => {
      // Optimistic update
      updateCell(row, col, value, isPencilMode);

      // Emit to server as game_event
      if (gameId && user) {
        const eventData = {
          gid: gameId,
          event: {
            type: 'updateCell',
            user: user.id,
            timestamp: Date.now(),
            params: {
              cell: { r: row, c: col },
              value: value,
              autocheck: false, // We don't use autocheck in our store
              id: user.id,
            },
          },
        };
        console.log('[Game] Emitting updateCell event:', {
          gameId,
          userId: user.id,
          row,
          col,
          value,
          isPencil: isPencilMode,
          eventData,
        });
        emit('game_event', eventData);
      } else {
        console.warn('[Game] Cannot emit updateCell event:', {
          hasGameId: !!gameId,
          hasUser: !!user,
          row,
          col,
          value,
        });
      }
    },
    [gameId, user, isPencilMode, updateCell, emit]
  );

  // Cell selection handler
  const handleCellSelect = useCallback(
    (row: number, col: number) => {
      setSelectedCell(row, col);

      // Emit cursor position as game_event
      if (gameId && user) {
        const eventData = {
          gid: gameId,
          event: {
            type: 'updateCursor',
            user: user.id,
            timestamp: Date.now(),
            params: {
              id: user.id,
              cell: { r: row, c: col },
              timestamp: Date.now(),
            },
          },
        };
        console.log('[Game] Emitting updateCursor event:', {
          gameId,
          userId: user.id,
          row,
          col,
          eventData,
        });
        emit('game_event', eventData);
      } else {
        console.warn('[Game] Cannot emit updateCursor event:', {
          hasGameId: !!gameId,
          hasUser: !!user,
          row,
          col,
        });
      }
    },
    [gameId, user, setSelectedCell, emit]
  );

  // Wrapper functions that emit clock events
  const handleStartClock = useCallback(() => {
    if (!gameId || !user) {
      startClock();
      return;
    }
    
    const now = Date.now();
    const state = useGameStore.getState();
    
    // If clock was running, save elapsed time first
    let baseElapsedTime = state.clock.elapsedTime;
    if (state.startTime) {
      // Clock was already running, calculate elapsed time up to now
      const currentSessionSeconds = Math.floor((now - state.startTime) / 1000);
      baseElapsedTime = state.clock.elapsedTime + currentSessionSeconds;
    }
    // If clock was paused, baseElapsedTime already has the accumulated time
    
    // Set startTime to now and preserve accumulated elapsedTime
    useGameStore.setState({
      clock: { isRunning: true, elapsedTime: baseElapsedTime },
      startTime: now,
    });
    
    // Emit clock start event
    const eventData = {
      gid: gameId,
      event: {
        type: 'clockStart',
        user: user.id,
        timestamp: now,
        params: {},
      },
    };
    emit('game_event', eventData);
  }, [gameId, user, startClock, emit]);

  const handlePauseClock = useCallback(() => {
    if (!gameId || !user) {
      pauseClock();
      return;
    }
    
    const state = useGameStore.getState();
    const now = Date.now();
    
    // Calculate elapsed time before pausing
    if (state.startTime) {
      const currentSessionSeconds = Math.floor((now - state.startTime) / 1000);
      const totalElapsedSeconds = state.clock.elapsedTime + currentSessionSeconds;
      useGameStore.setState({
        clock: { ...state.clock, isRunning: false, elapsedTime: totalElapsedSeconds },
        startTime: null,
      });
    } else {
      pauseClock();
    }
    
    // Emit clock pause event
    const eventData = {
      gid: gameId,
      event: {
        type: 'clockPause',
        user: user.id,
        timestamp: now,
        params: {},
      },
    };
    emit('game_event', eventData);
  }, [gameId, user, pauseClock, emit]);

  const handleResetClock = useCallback(() => {
    if (!gameId || !user) {
      resetClock();
      return;
    }
    
    resetClock();
    
    // Emit clock reset event
    const eventData = {
      gid: gameId,
      event: {
        type: 'clockReset',
        user: user.id,
        timestamp: Date.now(),
        params: {},
      },
    };
    emit('game_event', eventData);
  }, [gameId, user, resetClock, emit]);

  // Use react-timer-hook for smooth timer updates
  // We use it in count-up mode by setting a far future expiry and calculating elapsed
  const [tick, setTick] = useState(0);
  const baseElapsedTimeRef = useRef(clock.elapsedTime);
  const startTimeRef = useRef<number | null>(null);

  // Get current store state for calculations
  const getStoreState = useCallback(() => useGameStore.getState(), []);

  // Update refs when store state changes (including from remote events)
  useEffect(() => {
    const state = getStoreState();
    if (!state.clock.isRunning) {
      // Paused: elapsedTime contains the total
      baseElapsedTimeRef.current = state.clock.elapsedTime;
      startTimeRef.current = null;
    } else if (state.startTime) {
      // Running: check if startTime changed (new session or remote event)
      if (startTimeRef.current !== state.startTime) {
        // New session started (local or remote) - save current elapsed time as base
        baseElapsedTimeRef.current = state.clock.elapsedTime;
        startTimeRef.current = state.startTime;
      }
      // If startTime is the same but elapsedTime changed (from remote pause/resume), update base
      // This handles the case where a remote pause happened and we're resuming
      if (baseElapsedTimeRef.current !== state.clock.elapsedTime && !state.clock.isRunning) {
        baseElapsedTimeRef.current = state.clock.elapsedTime;
      }
    }
  }, [clock.isRunning, clock.elapsedTime, getStoreState]);

  // Force re-render every second when running to update display
  useEffect(() => {
    if (!clock.isRunning) {
      return;
    }

    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [clock.isRunning]);

  // Calculate current clock time: base (completed sessions) + current session
  // This recalculates every render when tick changes (tick forces re-render every second)
  // Always read from store to get latest state (including remote updates)
  // Reference startTime from store so changes trigger recalculation
  const currentClockTime = (() => {
    // Reference tick and startTime to ensure recalculation when they change
    void tick;
    void startTime; // Subscribe to startTime changes from store
    const state = getStoreState();
    if (!state.clock.isRunning || !state.startTime) {
      return state.clock.elapsedTime;
    }
    // Running: calculate from store's startTime (which may have been updated by remote events)
    const now = Date.now();
    const currentSessionSeconds = Math.floor((now - state.startTime) / 1000);
    return state.clock.elapsedTime + currentSessionSeconds;
  })();

  return {
    gameId,
    cells,
    users,
    selectedCell,
    selectedDirection,
    isPencilMode,
    isComplete,
    clock: {
      ...clock,
      elapsedTime: currentClockTime,
    },
    isConnected,
    isLoading: isLoadingPuzzle,
    loadError,
    handleCellUpdate,
    handleCellSelect,
    toggleDirection,
    togglePencilMode,
    startClock: handleStartClock,
    pauseClock: handlePauseClock,
    resetClock: handleResetClock,
  };
};

import gameReducer from '@crosswithfriends/shared/fencingGameEvents/gameReducer';
import type {GameEvent} from '@crosswithfriends/shared/fencingGameEvents/types/GameEvent';
import type {GameState} from '@crosswithfriends/shared/fencingGameEvents/types/GameState';
import HistoryWrapper from '@crosswithfriends/shared/lib/wrappers/HistoryWrapper';
import {useRef, useState, useEffect} from 'react';

export type GameEventsHook = {
  gameState: GameState;
  setEvents(gameEvents: GameEvent[]): void;
  addEvent(gameEvent: GameEvent): void;
  addOptimisticEvent(gameEvent: GameEvent): void;
  getServerTime(): number;
};

const makeHistoryWrappper = (events: GameEvent[]): HistoryWrapper => {
  const res = new HistoryWrapper(events, gameReducer);
  if (!res.createEvent) {
    res.setCreateEvent({});
  }
  res.initializeMemo();
  return res;
};

export const useGameEvents = (): GameEventsHook => {
  const historyWrapperRef = useRef<HistoryWrapper>(makeHistoryWrappper([]));
  const serverTimeOffsetRef = useRef<number>(0);
  const [version, setVersion] = useState(0);

  // Initialize with empty state to avoid ref access during render
  const [gameState, setGameState] = useState<GameState>(() => {
    const initialWrapper = makeHistoryWrappper([]);
    return initialWrapper.getSnapshot();
  });

  // Update gameState when version changes
  useEffect(() => {
    setGameState(historyWrapperRef.current.getSnapshot());
  }, [version]);

  return {
    gameState,
    setEvents(events) {
      historyWrapperRef.current = makeHistoryWrappper(events);
      setVersion((v) => v + 1);
    },
    addEvent(event) {
      serverTimeOffsetRef.current = event.timestamp! - Date.now();
      historyWrapperRef.current.addEvent(event);
      setVersion((v) => v + 1);
    },
    addOptimisticEvent(event) {
      historyWrapperRef.current.addOptimisticEvent(event);
      setVersion((v) => v + 1);
    },
    getServerTime() {
      return Date.now() + serverTimeOffsetRef.current;
    },
  };
};

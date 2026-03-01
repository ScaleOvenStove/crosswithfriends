import React, {useEffect, useState} from 'react';
import {GameState} from '../../shared/fencingGameEvents/types/GameState';
import {GameEventsHook} from './useGameEvents';
import {PlayerActions} from './usePlayerActions';
import './css/fencingCountdown.css';

export const FencingCountdown: React.FC<{
  playerActions: PlayerActions;
  gameState: GameState;
  gameEventsHook: GameEventsHook;
  children?: React.ReactNode;
}> = (props) => {
  const [renderCount, setRenderCount] = useState(0);
  const serverTime = props.gameEventsHook.getServerTime();
  const GAME_START_DELAY_MS = 1000 * 5;
  const notLoaded = !props.gameState.loaded;
  const notStarted = !props.gameState.loaded || !props.gameState.started;
  const countingDown =
    !props.gameState.started ||
    (props.gameState.startedAt && serverTime < props.gameState.startedAt + GAME_START_DELAY_MS);

  useEffect(() => {
    if (countingDown) {
      requestAnimationFrame(() => {
        setRenderCount((x) => x + 1);
      });
    }
  }, [renderCount, countingDown]);

  if (notLoaded) {
    return (
      <div className="fencing-countdown">
        <span className="spinner" />
      </div>
    );
  }
  if (notStarted) {
    return (
      <div className="fencing-countdown">
        <button className="btn btn--contained btn--primary" onClick={props.playerActions.startGame}>
          Start Game (wait for everyone to join!)
        </button>
      </div>
    );
  }
  if (countingDown) {
    return (
      <div className="fencing-countdown">
        Starting In
        <div className="fencing-countdown--timer">
          {((props.gameState.startedAt! - serverTime + GAME_START_DELAY_MS) / 1000).toFixed(2)}
        </div>
      </div>
    );
  }
  return <>{props.children}</>;
};

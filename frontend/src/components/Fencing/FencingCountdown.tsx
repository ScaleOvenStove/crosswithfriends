import {CircularProgress, Box} from '@mui/material';
import React, {useEffect, useState} from 'react';
import {GameState} from '@crosswithfriends/shared/fencingGameEvents/types/GameState';
import {GameEventsHook} from './useGameEvents';
import {PlayerActions} from './usePlayerActions';

export const FencingCountdown: React.FC<{
  playerActions: PlayerActions;
  gameState: GameState;
  gameEventsHook: GameEventsHook;
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
      <Box
        sx={{
          display: 'flex',
          position: 'relative',
          top: '50%',
          transform: 'translateY(-50%)',
          margin: 'auto',
          flexDirection: 'column',
          alignItems: 'center',
          fontSize: '300%',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }
  if (notStarted) {
    return (
      <Box
        sx={{
          display: 'flex',
          position: 'relative',
          top: '50%',
          transform: 'translateY(-50%)',
          margin: 'auto',
          flexDirection: 'column',
          alignItems: 'center',
          fontSize: '300%',
        }}
      >
        <button onClick={props.playerActions.startGame}>Start Game (wait for everyone to join!)</button>
      </Box>
    );
  }
  if (countingDown) {
    return (
      <Box
        sx={{
          display: 'flex',
          position: 'relative',
          top: '50%',
          transform: 'translateY(-50%)',
          margin: 'auto',
          flexDirection: 'column',
          alignItems: 'center',
          fontSize: '300%',
        }}
      >
        Starting In
        <Box sx={{fontSize: '150%'}}>
          {((props.gameState.startedAt! - serverTime + GAME_START_DELAY_MS) / 1000).toFixed(2)}
        </Box>
      </Box>
    );
  }
  return <>{props.children}</>;
};

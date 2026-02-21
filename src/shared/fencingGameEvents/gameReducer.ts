import allEventDefs from './allEventDefs';
import {initialState} from './initialState';
import {GameEvent} from './types/GameEvent';
import {GameState} from './types/GameState';

export default (state: GameState, event: GameEvent): GameState => {
  const currentState = state || initialState;
  if (!event) return currentState;
  if (!(event.type in allEventDefs)) {
    console.warn(`Game event not implemented: ${event.type}`);
  }
  return (
    allEventDefs[event.type]?.reducer(currentState, event.params as any, event.timestamp) ?? currentState
  ); // TODO fix ts here
};

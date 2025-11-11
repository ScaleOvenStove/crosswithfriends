import type {EventDef} from '../types/EventDef';

export interface StartEvent {}

const start: EventDef<StartEvent> = {
  reducer(state, _params, timestamp) {
    return {
      ...state,
      started: true,
      startedAt: timestamp!,
    };
  },
};

export default start;

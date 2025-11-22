import type {EventDef} from '../types/EventDef';

export interface UpdateTeamIdEvent {
  id: string;
  teamId: number;
}

const updateTeamId: EventDef<UpdateTeamIdEvent> = {
  reducer(state, {id, teamId}) {
    if (![0, 1, 2].includes(teamId)) return state;
    if (!state.users[id]) {
      return state; // illegal update if no user exists with id
    }
    return {
      ...state,
      users: {
        ...state.users,
        [id]: {
          ...state.users[id]!,
          teamId,
        },
      },
    };
  },
};

export default updateTeamId;

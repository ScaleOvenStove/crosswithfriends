import {offline} from './firebase';
import demoUser, {getUser as _demoGetUser} from './demoUser';
import user, {getUser as _getUser} from './user';

// Export new Zustand stores
export {useGameStore} from './gameStore';
export {useBattleStore} from './battleStore';
export {useCompositionStore} from './compositionStore';
export {useUserStore} from './userStore';
export {usePuzzleStore} from './puzzleStore';

// @deprecated Use useUser hook instead. This is kept for backward compatibility only.
// TODO: Migrate remaining usages to useUser hook, then remove this export
export const getUser = offline ? _demoGetUser : _getUser;

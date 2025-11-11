import {offline} from './firebase';
// eslint-disable-next-line import/no-cycle
import battle from './battle';
import demoGame from './demoGame';
import demoUser, {getUser as _demoGetUser} from './demoUser';
import demoComposition from './demoComposition';
import game from './game';
import user, {getUser as _getUser} from './user';
import puzzle from './puzzle';
import composition from './composition';

// Export new Zustand stores
export {useGameStore} from './gameStore';
export {useBattleStore} from './battleStore';
export {useCompositionStore} from './compositionStore';
export {useUserStore} from './userStore';
export {usePuzzleStore} from './puzzleStore';

// Export old EventEmitter-based stores (for backward compatibility during migration)
export const BattleModel = battle;
export const GameModel = offline ? demoGame : game;
export const UserModel = offline ? demoUser : user;
export const PuzzleModel = puzzle;

export const getUser = offline ? _demoGetUser : _getUser;
export const CompositionModel = offline ? demoComposition : composition;

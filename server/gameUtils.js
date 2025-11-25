// Re-export shared utilities to avoid code duplication
// The shared package contains the canonical implementations

export {getOppositeDirection, makeGrid} from '@crosswithfriends/shared/lib/gameUtils';

// GridWrapper is exported as default in shared, re-export as named export for compatibility
export {default as GridWrapper} from '@crosswithfriends/shared/lib/wrappers/GridWrapper';

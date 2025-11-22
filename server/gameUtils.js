// Re-export shared utilities to avoid code duplication
// The shared package contains the canonical implementations

export {getOppositeDirection, makeGrid} from '@lib/gameUtils';

// GridWrapper is exported as default in shared, re-export as named export for compatibility
export {default as GridWrapper} from '@lib/wrappers/GridWrapper';

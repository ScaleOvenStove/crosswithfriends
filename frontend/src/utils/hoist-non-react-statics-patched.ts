/**
 * Patched version of hoist-non-react-statics for React 19 compatibility
 *
 * This intercepts ALL imports of hoist-non-react-statics and fixes the REACT_STATICS issue
 */

import * as ReactIs from 'react-is';
import type React from 'react';

// Ensure REACT_STATICS exists before we try to use it
// This is the key fix for React 19 compatibility
const REACT_STATICS: Record<string, string> = (ReactIs as any).REACT_STATICS || {};

// Initialize required statics if they don't exist
const requiredStatics = [
  'ContextConsumer',
  'ContextProvider',
  'ForwardRef',
  'Memo',
  'Profiler',
  'StrictMode',
  'Suspense',
];

for (const staticName of requiredStatics) {
  if (!REACT_STATICS[staticName]) {
    REACT_STATICS[staticName] = staticName;
  }
}

// Store it back on react-is for compatibility
(ReactIs as any).REACT_STATICS = REACT_STATICS;

// Known React statics that should not be hoisted
const KNOWN_STATICS = [
  'name',
  'length',
  'prototype',
  'caller',
  'callee',
  'arguments',
  'type',
  'displayName',
  'propTypes',
  'defaultProps',
  'getDerivedStateFromProps',
  'getSnapshotBeforeUpdate',
  'UNSAFE_componentWillMount',
  'UNSAFE_componentWillReceiveProps',
  'UNSAFE_componentWillUpdate',
  'componentDidMount',
  'componentDidUpdate',
  'componentWillMount',
  'componentWillReceiveProps',
  'componentWillUnmount',
  'componentWillUpdate',
  'shouldComponentUpdate',
  'render',
  'setState',
  'forceUpdate',
  'isMounted',
  'replaceState',
  'context',
  'contextType',
  'contextTypes',
];

// Add React 19 specific statics
const REACT_19_STATICS = ['$$typeof', '$$type', '$$props', '$$ref', '$$key'];

const ALL_KNOWN_STATICS = [...KNOWN_STATICS, ...REACT_19_STATICS];

function getStatics(component: any): string[] {
  if (!component) {
    return [];
  }

  const statics: string[] = [];
  const keys = Object.keys(component);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (!ALL_KNOWN_STATICS.includes(key)) {
      statics.push(key);
    }
  }

  return statics;
}

function hoistNonReactStatics<T extends React.ComponentType<any>>(
  targetComponent: T,
  sourceComponent: React.ComponentType<any>,
  blacklist?: Record<string, boolean>
): T {
  if (typeof sourceComponent !== 'string') {
    // Don't hoist over string components
    const statics = getStatics(sourceComponent);

    for (let i = 0; i < statics.length; i++) {
      const key = statics[i];
      if (blacklist && blacklist[key]) {
        continue;
      }

      try {
        // Only copy if target doesn't already have it
        if (!(key in targetComponent)) {
          (targetComponent as any)[key] = (sourceComponent as any)[key];
        }
      } catch (e) {
        // Silently ignore errors when copying statics
      }
    }
  }

  return targetComponent;
}

export default hoistNonReactStatics;


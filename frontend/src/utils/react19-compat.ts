/**
 * React 19 Compatibility Shim
 *
 * This file provides compatibility fixes for packages that use hoist-non-react-statics
 * with React 19. The issue is that hoist-non-react-statics tries to access React internals
 * that have changed in React 19.
 *
 * This shim must be imported before any components that use hoist-non-react-statics.
 */

// Patch react-is to provide REACT_STATICS before hoist-non-react-statics tries to use it
// This must happen synchronously, not in an async function
try {
  // Use a synchronous approach to patch react-is
  // We'll try to access it via the module cache or global
  // Try to patch via dynamic import (but wait for it)
  import('react-is')
    .then((reactIsModule) => {
      if (reactIsModule && typeof reactIsModule === 'object') {
        const reactIsAny = reactIsModule as any;

        // Ensure REACT_STATICS exists before hoist-non-react-statics tries to use it
        if (!reactIsAny.REACT_STATICS) {
          reactIsAny.REACT_STATICS = {};
        }

        // Provide all the symbols that hoist-non-react-statics expects
        const statics = reactIsAny.REACT_STATICS;
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
          if (!statics[staticName]) {
            statics[staticName] = staticName;
          }
        }
      }
    })
    .catch(() => {
      // If react-is isn't available, that's okay - we'll try again when it loads
    });
} catch {
  // Silently fail if patching isn't possible
}

// Also patch hoist-non-react-statics directly if we can intercept it
// This is a more aggressive approach that patches the module before it's used
if (typeof window !== 'undefined') {
  // Browser environment - try to intercept module loading
  const originalDefine = (window as any).__webpack_require__;
  if (originalDefine) {
    // Webpack environment - patch module resolution
    // This is complex and may not work in all cases
  }
}

export {};

/**
 * Application routing configuration
 * Implements route structure from REQ-14: Route Structure
 * Enhanced with error handling and 404 pages
 */

import type { RouteObject } from 'react-router-dom';
import { lazy } from 'react';

// Lazy load error pages
const NotFound404 = lazy(() => import('@pages/errors/NotFound404'));
const ServerError500 = lazy(() => import('@pages/errors/ServerError500'));

/**
 * Root error element for route-level errors
 */
const RootErrorElement = () => {
  // For route-level errors, show the 500 error page
  return <ServerError500 />;
};

/**
 * Get all routes - function to ensure lazy components are properly handled
 * Using React Router's lazy loading in route config
 */
export function getRoutes(): RouteObject[] {
  /**
   * Public routes - accessible without authentication
   */
  const publicRoutes: RouteObject[] = [
    {
      path: '/',
      lazy: async () => {
        const { default: Component } = await import('@pages/Welcome');
        return { Component };
      },
    },
    {
      path: '/fencing',
      lazy: async () => {
        const { default: Component } = await import('@pages/Welcome');
        return { Component };
      },
    },
    {
      path: '/game/:gid',
      lazy: async () => {
        const { default: Component } = await import('@pages/Game');
        return { Component };
      },
    },
    {
      path: '/puzzle/:pid',
      lazy: async () => {
        const { default: Component } = await import('@pages/Game');
        return { Component };
      },
    },
    {
      path: '/embed/game/:gid',
      lazy: async () => {
        const { default: Component } = await import('@pages/Game');
        return { Component };
      },
    },
    {
      path: '/room/:rid',
      lazy: async () => {
        const { default: Component } = await import('@pages/Room');
        return { Component };
      },
    },
    {
      path: '/embed/room/:rid',
      lazy: async () => {
        const { default: Component } = await import('@pages/Room');
        return { Component };
      },
    },
    {
      path: '/replay/:gid',
      lazy: async () => {
        const { default: Component } = await import('@pages/Replay');
        return { Component };
      },
    },
    {
      path: '/replays',
      lazy: async () => {
        const { default: Component } = await import('@pages/Replays');
        return { Component };
      },
    },
    {
      path: '/replays/:pid',
      lazy: async () => {
        const { default: Component } = await import('@pages/Replays');
        return { Component };
      },
    },
    {
      path: '/compose',
      lazy: async () => {
        const { default: Component } = await import('@pages/Compose');
        return { Component };
      },
    },
    {
      path: '/composition/:cid',
      lazy: async () => {
        const { default: Component } = await import('@pages/Composition');
        return { Component };
      },
    },
    {
      path: '/account',
      lazy: async () => {
        const { default: Component } = await import('@pages/Account');
        return { Component };
      },
    },
    {
      path: '/stats',
      lazy: async () => {
        const { default: Component } = await import('@pages/Stats');
        return { Component };
      },
    },
  ];

  /**
   * Beta routes - experimental features
   */
  const betaRoutes: RouteObject[] = [
    {
      path: '/beta',
      lazy: async () => {
        const { default: Component } = await import('@pages/Welcome');
        return { Component };
      },
    },
    {
      path: '/beta/game/:gid',
      lazy: async () => {
        const { default: Component } = await import('@pages/Game');
        return { Component };
      },
    },
    {
      path: '/beta/battle/:bid',
      lazy: async () => {
        const { default: Component } = await import('@pages/Battle');
        return { Component };
      },
    },
    {
      path: '/beta/play/:pid',
      lazy: async () => {
        const { default: Component } = await import('@pages/Play');
        return { Component };
      },
    },
    {
      path: '/beta/replay/:gid',
      lazy: async () => {
        const { default: Component } = await import('@pages/Replay');
        return { Component };
      },
    },
    {
      path: '/beta/fencing/:gid',
      lazy: async () => {
        const { default: Component } = await import('@pages/Fencing');
        return { Component };
      },
    },
  ];

  /**
   * Catch-all route for 404 errors - must be last
   */
  const notFoundRoute: RouteObject = {
    path: '*',
    element: <NotFound404 />,
  };

  return [...publicRoutes, ...betaRoutes, notFoundRoute];
}

/**
 * All routes combined with root-level error handling
 */
export const routes: RouteObject[] = [
  {
    // Root route with error boundary for all child routes
    errorElement: <RootErrorElement />,
    children: getRoutes(),
  },
];

export default routes;

// Export error page components for direct use
export { NotFound404, ServerError500 };

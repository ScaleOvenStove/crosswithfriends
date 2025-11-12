/**
 * Route configuration
 * Centralized route definitions with metadata and guards
 */

import {lazy, type ComponentType} from 'react';

// Lazy load page components
const Account = lazy(() => import('../pages/Account').then((m) => ({default: m.Account})));
const Battle = lazy(() => import('../pages/Battle').then((m) => ({default: m.Battle})));
const Compose = lazy(() => import('../pages/Compose').then((m) => ({default: m.Compose})));
const Composition = lazy(() => import('../pages/Composition').then((m) => ({default: m.Composition})));
const Game = lazy(() => import('../pages/Game').then((m) => ({default: m.default})));
const Play = lazy(() => import('../pages/Play').then((m) => ({default: m.Play})));
const Replay = lazy(() => import('../pages/Replay').then((m) => ({default: m.default})));
const Replays = lazy(() => import('../pages/Replays').then((m) => ({default: m.default})));
const Room = lazy(() => import('../pages/Room').then((m) => ({default: m.default})));
const Fencing = lazy(() => import('../pages/Fencing').then((m) => ({default: m.default})));
const WrappedWelcome = lazy(() => import('../pages/WrappedWelcome').then((m) => ({default: m.default})));

export interface RouteConfig {
  path: string;
  component: ComponentType<unknown>;
  requiresAuth?: boolean;
  requiresBeta?: boolean;
  errorBoundary?: ComponentType<unknown>;
  metadata?: {
    title?: string;
    description?: string;
  };
}

export const routes: RouteConfig[] = [
  {
    path: '/',
    component: WrappedWelcome,
    requiresAuth: false,
  },
  {
    path: '/fencing',
    component: WrappedWelcome,
    requiresAuth: false,
  },
  {
    path: '/game/:gid',
    component: Game,
    requiresAuth: false,
    errorBoundary: lazy(() => import('../components/common/GameError').then((m) => ({default: m.GameError}))),
  },
  {
    path: '/embed/game/:gid',
    component: Game,
    requiresAuth: false,
    errorBoundary: lazy(() => import('../components/common/GameError').then((m) => ({default: m.GameError}))),
  },
  {
    path: '/room/:rid',
    component: Room,
    requiresAuth: false,
    errorBoundary: lazy(() => import('../components/common/RoomError').then((m) => ({default: m.RoomError}))),
  },
  {
    path: '/embed/room/:rid',
    component: Room,
    requiresAuth: false,
    errorBoundary: lazy(() => import('../components/common/RoomError').then((m) => ({default: m.RoomError}))),
  },
  {
    path: '/replay/:gid',
    component: Replay,
    requiresAuth: false,
  },
  {
    path: '/beta/replay/:gid',
    component: Replay,
    requiresAuth: false,
    requiresBeta: true,
  },
  {
    path: '/replays/:pid',
    component: Replays,
    requiresAuth: false,
  },
  {
    path: '/replays',
    component: Replays,
    requiresAuth: false,
  },
  {
    path: '/beta',
    component: WrappedWelcome,
    requiresAuth: false,
    requiresBeta: true,
  },
  {
    path: '/beta/game/:gid',
    component: Game,
    requiresAuth: false,
    requiresBeta: true,
    errorBoundary: lazy(() => import('../components/common/GameError').then((m) => ({default: m.GameError}))),
  },
  {
    path: '/beta/battle/:bid',
    component: Battle,
    requiresAuth: false,
    requiresBeta: true,
  },
  {
    path: '/beta/play/:pid',
    component: Play,
    requiresAuth: false,
    requiresBeta: true,
  },
  {
    path: '/account',
    component: Account,
    requiresAuth: false, // TODO: Set to true when auth is implemented
    errorBoundary: lazy(() => import('../components/common/AccountError').then((m) => ({default: m.AccountError}))),
  },
  {
    path: '/compose',
    component: Compose,
    requiresAuth: false,
  },
  {
    path: '/composition/:cid',
    component: Composition,
    requiresAuth: false,
  },
  {
    path: '/fencing/:gid',
    component: Fencing,
    requiresAuth: false,
    errorBoundary: lazy(() => import('../components/common/GameError').then((m) => ({default: m.GameError}))),
  },
  {
    path: '/beta/fencing/:gid',
    component: Fencing,
    requiresAuth: false,
    requiresBeta: true,
    errorBoundary: lazy(() => import('../components/common/GameError').then((m) => ({default: m.GameError}))),
  },
];

/**
 * Route guard component
 * Checks authentication and beta access before rendering route
 */
export const RouteGuard: React.FC<{
  route: RouteConfig;
  children: React.ReactNode;
}> = ({route, children}) => {
  // TODO: Implement authentication check when auth is ready
  // if (route.requiresAuth && !isAuthenticated()) {
  //   return <Navigate to="/login" replace />;
  // }

  // TODO: Implement beta access check if needed
  // if (route.requiresBeta && !hasBetaAccess()) {
  //   return <Navigate to="/" replace />;
  // }

  return <>{children}</>;
};


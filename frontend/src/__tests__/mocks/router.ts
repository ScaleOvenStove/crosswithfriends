/**
 * Mock implementations for React Router for Vitest tests
 */
import React from 'react';
import {vi} from 'vitest';

export const mockUseNavigate = vi.fn();
export const mockUseParams = vi.fn(() => ({}));
export const mockUseLocation = vi.fn(() => ({
  pathname: '/',
  search: '',
  hash: '',
  state: null,
}));

// Mock React Router
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockUseNavigate,
    useParams: () => mockUseParams(),
    useLocation: () => mockUseLocation(),
    BrowserRouter: ({children}: {children: React.ReactNode}) => children,
    Link: ({children, to}: {children: React.ReactNode; to: string}) =>
      React.createElement('a', {href: to}, children),
  };
});

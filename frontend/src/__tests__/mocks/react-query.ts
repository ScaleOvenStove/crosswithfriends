/**
 * Mock implementations for React Query hooks for Vitest tests
 */
import {vi} from 'vitest';

export const mockUseQuery = vi.fn();
export const mockUseMutation = vi.fn();
export const mockUseQueryClient = vi.fn();

// Mock React Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => mockUseQueryClient(),
  QueryClient: vi.fn(),
  QueryClientProvider: ({children}: {children: React.ReactNode}) => children,
}));

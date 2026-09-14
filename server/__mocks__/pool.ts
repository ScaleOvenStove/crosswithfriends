// Mock for server/model/pool.ts
// Used by server tests to avoid real database connections

const mockQuery = jest.fn();
const mockConnect = jest.fn();

// Mock client returned by pool.connect() for transaction-based tests
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
export const mockClient = {
  query: mockClientQuery,
  release: mockClientRelease,
};

mockConnect.mockResolvedValue(mockClient);

export const pool = {
  query: mockQuery,
  connect: mockConnect,
};

// `readPool` is the real module's second pool (heavy profile/history reads).
// Tests here assert on query shape and model logic, not on which pool a query
// was routed to, so both names share one mock — existing `pool.query`
// expectations keep working for code that has moved to readPool.
export const readPool = pool;

// Re-implemented (not mocked) so callers' degrade-on-timeout branches behave
// as they do in production.
export function isStatementTimeout(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as {code?: string}).code === '57014';
}

export function isPoolAcquireTimeout(err: unknown): boolean {
  return err instanceof Error && err.message === 'timeout exceeded when trying to connect';
}

export function isTransientReadFailure(err: unknown): boolean {
  return isStatementTimeout(err) || isPoolAcquireTimeout(err);
}

// Helper to reset all mocks between tests
export function resetPoolMocks() {
  mockQuery.mockReset();
  mockConnect.mockReset();
  mockClientQuery.mockReset();
  mockClientRelease.mockReset();
  mockConnect.mockResolvedValue(mockClient);
}

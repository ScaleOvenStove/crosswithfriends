// Mock for server/model/pool.ts
// Used by server tests to avoid real database connections

const mockQuery = jest.fn();
const mockConnect = jest.fn();

export const pool = {
  query: mockQuery,
  connect: mockConnect,
};

// Helper to reset all mocks between tests
export function resetPoolMocks() {
  mockQuery.mockReset();
  mockConnect.mockReset();
}

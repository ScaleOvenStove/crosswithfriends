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

// Helper to reset all mocks between tests
export function resetPoolMocks() {
  mockQuery.mockReset();
  mockConnect.mockReset();
  mockClientQuery.mockReset();
  mockClientRelease.mockReset();
  mockConnect.mockResolvedValue(mockClient);
}

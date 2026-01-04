// Test setup file
// This runs before all tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Use random port for tests

// Set authentication secret for JWT token generation/verification in tests
// Using a fixed secret ensures consistent token behavior across test runs
process.env.AUTH_TOKEN_SECRET = 'test-jwt-secret-for-crosswithfriends-32chars';

// Set database environment variables for config validation
// Tests use mocked repositories, so these don't need to be real values
process.env.PGHOST = 'localhost';
process.env.PGUSER = 'postgres';
process.env.PGDATABASE = 'crosswithfriends';
process.env.PGSSLMODE = 'disable';

// Suppress console logs during tests unless DEBUG is set
if (!process.env.DEBUG) {
  const originalConsole = console;
  global.console = {
    ...originalConsole,
    log: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}

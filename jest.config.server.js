/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  displayName: 'server',
  testEnvironment: 'node',
  roots: ['<rootDir>/server'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {tsconfig: 'server/tsconfig.json'}],
    '^.+\\.jsx?$': ['babel-jest', {presets: ['@babel/preset-env']}],
  },
  transformIgnorePatterns: ['/node_modules/(?!uuid/)'],
  // Every server file counts, not just the ones a test happens to import —
  // otherwise a module with no tests at all is invisible to the numbers below.
  collectCoverageFrom: [
    'server/**/*.ts',
    '!server/__tests__/**',
    '!server/__mocks__/**',
    '!server/scripts/**',
  ],
  coverageReporters: ['text-summary', 'lcov'],
  // A floor, not a target. These sit just under the current numbers so a
  // change that drops coverage fails the build; raise them as coverage
  // improves rather than leaving them where they are.
  coverageThreshold: {
    global: {
      statements: 57,
      branches: 48,
      functions: 64,
      lines: 57,
    },
  },
};

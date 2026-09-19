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
  // JS as well as TS: server/gameUtils.js is production code (model/game.ts
  // imports makeGrid from it) and the maintenance jobs under server/jobs are
  // partly JS, so a TS-only glob would leave all of it outside the ratchet.
  collectCoverageFrom: [
    'server/**/*.{ts,js}',
    '!server/__tests__/**',
    '!server/__mocks__/**',
    '!server/scripts/**',
  ],
  coverageReporters: ['text-summary', 'lcov'],
  // A floor, not a target. These sit just under the current numbers so a
  // change that drops coverage fails the build; raise them as coverage
  // improves rather than leaving them where they are.
  //
  // They dropped when the glob above started counting JS (statements 59.3 ->
  // 53.7). That is the same code measured honestly, not a weaker gate: the JS
  // was always there and always untested, it just was not being counted.
  coverageThreshold: {
    global: {
      statements: 52,
      branches: 43,
      functions: 54,
      lines: 52,
    },
  },
};

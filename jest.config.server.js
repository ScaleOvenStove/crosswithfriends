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
    '^.+\\.jsx?$': 'babel-jest',
  },
  transformIgnorePatterns: ['/node_modules/'],
};

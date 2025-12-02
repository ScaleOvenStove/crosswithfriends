import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Exclude Playwright test files - they should be run with Playwright, not vitest
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/src/tests/e2e/**', // Exclude Playwright e2e tests
      '**/src/tests/components/**', // Exclude component tests (Playwright CT)
      '**/*.e2e.spec.ts',
      '**/*.e2e.spec.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/playwright*.ts', // Exclude Playwright config files
    ],
    // Include vitest unit test files, including Firebase rules tests
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'src/tests/firebase/**/*.test.ts', // Include Firebase rules tests
    ],
    globals: true,
    environment: 'jsdom', // Default to jsdom for React component tests
    // Use different environments for different test types
    environmentMatchGlobs: [
      ['**/tests/firebase/**', 'node'], // Firebase rules tests need Node.js environment
    ],
    setupFiles: ['./src/__tests__/setup.ts'],
    env: {
      NODE_ENV: 'test',
    },
  },
  resolve: {
    alias: [
      {
        find: '@crosswithfriends/shared/lib',
        replacement: path.resolve(__dirname, '../shared/src/lib'),
      },
      {
        find: '@crosswithfriends/shared/fencingGameEvents',
        replacement: path.resolve(__dirname, '../shared/src/shared/fencingGameEvents'),
      },
      {
        find: '@crosswithfriends/shared/roomEvents',
        replacement: path.resolve(__dirname, '../shared/src/shared/roomEvents'),
      },
      {
        find: '@crosswithfriends/shared/types',
        replacement: path.resolve(__dirname, '../shared/src/shared/types'),
      },
      {
        find: '@crosswithfriends/shared',
        replacement: path.resolve(__dirname, '../shared/src/shared'),
      },
      {
        find: '@shared',
        replacement: path.resolve(__dirname, '../shared/src/shared'),
      },
      {
        find: '@lib',
        replacement: path.resolve(__dirname, '../shared/src/lib'),
      },
    ],
  },
});

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
      '**/src/tests/**', // Exclude all Playwright tests in src/tests/
      'src/tests/**', // Also exclude with this pattern
      '**/*.e2e.spec.ts',
      '**/*.e2e.spec.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/playwright*.ts', // Exclude Playwright config files
    ],
    // Only include actual vitest unit test files (if any exist)
    // Note: All current tests are Playwright-based, so this will find no tests until vitest tests are added
    // Exclude src/tests directory explicitly from include
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
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

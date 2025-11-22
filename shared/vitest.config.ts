import {defineConfig} from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{js,ts}', 'src/**/__tests__/**/*.{js,ts}'],
    exclude: ['node_modules', 'dist', '**/*.d.ts', '**/setup.ts'],
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/*.d.ts', '**/__tests__/**', '**/node_modules/**', '**/dist/**', '**/coverage/**'],
    },
  },
  resolve: {
    alias: {
      '@lib': path.resolve(__dirname, './src/lib'),
    },
  },
});


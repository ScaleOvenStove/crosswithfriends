import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      include: /\.(jsx|js|tsx|ts)$/,
      jsxRuntime: 'automatic',
      // Enable Fast Refresh
      fastRefresh: true,
    }),
  ],
  // Use import.meta.env instead of process.env (Vite best practice)
  // Note: Some third-party libraries may still reference process, so we provide a polyfill
  define: {
    global: 'globalThis',
    // Define process.env for libraries that expect it (replaced at build time)
    'process.env': '{}',
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
  server: {
    port: 3020,
    // Enable HMR
    hmr: true,
  },
  build: {
    outDir: 'build',
    sourcemap: true,
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['react-flexview', 'react-icons'],
        },
      },
    },
    // Improve build performance
    target: 'esnext',
    minify: 'esbuild',
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'firebase/compat/app',
      'firebase/compat/database',
      'firebase/compat/auth',
      '@mui/material',
    ],
  },
  publicDir: 'public',
});

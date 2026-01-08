import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      include: /\.(jsx|js|tsx|ts)$/,
      jsxRuntime: 'automatic',
    }),
  ],
  define: {
    global: 'globalThis',
    'process.env': '{}',
  },
  resolve: {
    dedupe: [
      'react',
      'react-dom',
      'react-is',
      '@emotion/react',
      '@emotion/styled',
      '@emotion/cache',
    ],
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@services': path.resolve(__dirname, './src/services'),
      '@api': path.resolve(__dirname, './src/api'),
      '@config': path.resolve(__dirname, './src/config'),
      '@types': path.resolve(__dirname, './src/types'),
      '@theme': path.resolve(__dirname, './src/theme'),
      '@sockets': path.resolve(__dirname, './src/sockets'),
      '@routes': path.resolve(__dirname, './src/routes'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
      '@schemas': path.resolve(__dirname, './src/schemas'),
      '@lib/firebase': path.resolve(__dirname, './src/firebase'),
      '@crosswithfriends/shared/lib': path.resolve(__dirname, '../shared/src/lib'),
      '@crosswithfriends/shared/fencingGameEvents': path.resolve(
        __dirname,
        '../shared/src/shared/fencingGameEvents'
      ),
      '@crosswithfriends/shared/roomEvents': path.resolve(
        __dirname,
        '../shared/src/shared/roomEvents'
      ),
      '@crosswithfriends/shared/types': path.resolve(__dirname, '../shared/src/shared/types'),
      '@crosswithfriends/shared': path.resolve(__dirname, '../shared/src/shared'),
      '@shared': path.resolve(__dirname, '../shared/src/shared'),
      '@lib': path.resolve(__dirname, '../shared/src/lib'),
    },
  },
  server: {
    hmr: true,
    open: true,
  },
  build: {
    outDir: 'build',
    sourcemap: true,
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Don't chunk source files
          if (id.includes('node_modules')) {
            // React and core dependencies - must be in same chunk
            if (
              id.includes('node_modules/react') ||
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react-router') ||
              id.includes('node_modules/react-is') ||
              id.includes('node_modules/hoist-non-react-statics') ||
              id.includes('node_modules/scheduler')
            ) {
              return 'react-vendor';
            }

            // Emotion packages - must be together to avoid circular dependency issues
            if (id.includes('node_modules/@emotion')) {
              return 'emotion-vendor';
            }

            // MUI packages (depends on Emotion, so separate chunk)
            if (id.includes('node_modules/@mui')) {
              return 'mui-vendor';
            }

            // React Query and related
            if (
              id.includes('node_modules/@tanstack/react-query') ||
              id.includes('node_modules/@tanstack/react-virtual')
            ) {
              return 'tanstack-vendor';
            }

            // Firebase - all firebase packages together
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
              return 'firebase-vendor';
            }

            // Socket.io and engine.io - must be together
            if (
              id.includes('node_modules/socket.io') ||
              id.includes('node_modules/engine.io') ||
              id.includes('node_modules/ws')
            ) {
              return 'socket-vendor';
            }

            // State management
            if (id.includes('node_modules/zustand')) {
              return 'state-vendor';
            }

            // Charting library
            if (id.includes('node_modules/recharts')) {
              return 'charts-vendor';
            }

            // Heavy UI components
            if (id.includes('node_modules/canvas-confetti')) {
              return 'canvas-confetti';
            }

            // React icons
            if (id.includes('node_modules/react-icons')) {
              return 'icons-vendor';
            }

            // React utilities
            if (
              id.includes('node_modules/react-error-boundary') ||
              id.includes('node_modules/react-use') ||
              id.includes('node_modules/react-hotkeys-hook') ||
              id.includes('node_modules/react-device-detect') ||
              id.includes('node_modules/react-timer-hook')
            ) {
              return 'react-utils-vendor';
            }

            // Validation and utilities
            if (
              id.includes('node_modules/zod') ||
              id.includes('node_modules/dompurify') ||
              id.includes('node_modules/classnames')
            ) {
              return 'utils-vendor';
            }

            // Query params
            if (
              id.includes('node_modules/use-query-params') ||
              id.includes('node_modules/query-string')
            ) {
              return 'query-params-vendor';
            }

            // Other vendor packages - group smaller packages together
            return 'vendor';
          }

          // Shared library code
          if (id.includes('shared/src')) {
            return 'shared';
          }
        },
        // Ensure consistent chunk file names
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop()
            : 'chunk';
          return `js/${facadeModuleId}-[hash].js`;
        },
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (!assetInfo.name) {
            return `assets/[name]-[hash][extname]`;
          }
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `images/[name]-[hash][extname]`;
          }
          if (/woff2?|eot|ttf|otf/i.test(ext)) {
            return `fonts/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
      },
      // External dependencies that shouldn't be bundled
      external: [],
    },
  },
  optimizeDeps: {
    include: [
      // React core
      'react',
      'react-dom',
      'react-is',
      'react-router-dom',
      'hoist-non-react-statics',
      'scheduler',
      // Emotion
      '@emotion/react',
      '@emotion/styled',
      '@emotion/cache',
      // MUI
      '@mui/material',
      '@mui/icons-material',
      // TanStack
      '@tanstack/react-query',
      '@tanstack/react-virtual',
      // Firebase
      'firebase/app',
      'firebase/auth',
      'firebase/database',
      'firebase/storage',
      // State management
      'zustand',
      // React utilities
      'react-error-boundary',
      'react-use',
      'react-hotkeys-hook',
      'react-device-detect',
      'react-timer-hook',
      // Utilities
      'zod',
      'dompurify',
      'classnames',
      // Query params
      'use-query-params',
      // Socket.io
      'socket.io-client',
      // Charts
      'recharts',
      // Icons
      'react-icons',
    ],
    esbuildOptions: {
      // Ensure proper handling of Emotion's circular dependencies
      logOverride: { 'this-is-undefined-in-esm': 'silent' },
    },
  },
  publicDir: 'public',
});

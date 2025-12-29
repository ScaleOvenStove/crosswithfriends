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
          // React and core dependencies
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-router')
          ) {
            return 'react-vendor';
          }
          // UI libraries
          if (id.includes('node_modules/@mui') || id.includes('node_modules/@emotion')) {
            return 'mui-vendor';
          }
          // Firebase
          if (id.includes('node_modules/firebase')) {
            return 'firebase-vendor';
          }
          // Socket.io
          if (id.includes('node_modules/socket.io')) {
            return 'socket-vendor';
          }
          // Heavy UI components
          if (id.includes('node_modules/canvas-confetti')) {
            return 'canvas-confetti';
          }
          // Other UI libraries
          if (id.includes('node_modules/react-icons')) {
            return 'ui-vendor';
          }
          // Shared library
          if (id.includes('shared/src')) {
            return 'shared';
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'firebase/app',
      'firebase/auth',
      'firebase/database',
      'firebase/storage',
      '@mui/material',
      'zustand',
      '@tanstack/react-query',
    ],
  },
  publicDir: 'public',
});

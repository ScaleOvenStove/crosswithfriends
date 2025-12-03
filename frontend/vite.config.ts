import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {visualizer} from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      include: /\.(jsx|js|tsx|ts)$/,
      jsxRuntime: 'automatic',
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
      // Replace hoist-non-react-statics with our patched version
      // This intercepts ALL uses, including transitive dependencies
      {
        find: 'hoist-non-react-statics',
        replacement: path.resolve(__dirname, 'src/utils/hoist-non-react-statics-patched.ts'),
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
          // Heavy UI components - split into separate chunks
          if (id.includes('node_modules/canvas-confetti')) {
            return 'canvas-confetti';
          }
          if (id.includes('node_modules/sweetalert2')) {
            return 'sweetalert2';
          }
          if (id.includes('node_modules/react-simple-keyboard')) {
            return 'react-keyboard';
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

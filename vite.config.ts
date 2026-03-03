import {defineConfig, transformWithEsbuild} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {VitePWA} from 'vite-plugin-pwa';
import {sentryVitePlugin} from '@sentry/vite-plugin';

export default defineConfig({
  plugins: [
    // Transform JSX in .js files before Rollup's parser sees them.
    // CRA allowed JSX in .js files; Vite requires this workaround.
    {
      name: 'treat-js-as-jsx',
      enforce: 'pre',
      async transform(code, id) {
        if (!id.match(/src\/.*\.js$/)) return null;
        return transformWithEsbuild(code, id, {
          loader: 'jsx',
          jsx: 'automatic',
        });
      },
    },
    react({
      include: /\.(jsx|js|tsx|ts)$/,
    }),
    VitePWA({
      injectRegister: false,
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
      },
      pwaAssets: {
        image: 'public/cwf_logo_square.svg',
        preset: 'minimal-2023',
        overrideManifestIcons: true,
        includeHtmlHeadLinks: true,
        injectThemeColor: true,
      },
      manifest: {
        name: 'Cross with Friends',
        short_name: 'CWF',
        description: 'Solve crossword puzzles together with friends in real time.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '.',
      },
    }),
    // Source map uploads only run when SENTRY_AUTH_TOKEN is set (CI/deployment)
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            org: 'cross-with-friends',
            project: 'javascript-react',
            authToken: process.env.SENTRY_AUTH_TOKEN,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@lib': path.resolve(__dirname, 'src/lib'),
    },
  },
  server: {
    port: 3020,
    proxy: {
      '/api': {
        target: 'https://downforacross-com.onrender.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  build: {
    outDir: 'build',
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('node_modules/firebase/') || id.includes('node_modules/@firebase/'))
            return 'vendor-firebase';
          if (id.includes('/lodash/')) return 'vendor-lodash';
          if (
            id.includes('/react-dom/') ||
            id.includes('/react/') ||
            id.includes('/scheduler/') ||
            id.includes('/react-router/') ||
            id.includes('/react-helmet-async/') ||
            id.includes('/classnames/')
          ) {
            return 'vendor-react';
          }
          if (id.includes('/@sentry/')) return 'vendor-sentry';
          if (id.includes('/socket.io-client/') || id.includes('/engine.io-')) return 'vendor-socketio';
          if (id.includes('/@radix-ui/')) return 'vendor-radix';
          return undefined;
        },
      },
    },
  },
  define: {
    // Bridge: partyParrot.js has 108 occurrences of process.env.PUBLIC_URL
    'process.env.PUBLIC_URL': JSON.stringify(''),
  },
});

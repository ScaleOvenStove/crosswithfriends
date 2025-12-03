/**
 * Main Application Component
 * Implements core application shell with routing and providers
 * Now includes Firebase integration for auth, realtime DB, and storage
 */

import { Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SocketProvider } from '@sockets/index';
import { routes } from '@routes/index';
import ErrorBoundary from '@components/common/ErrorBoundary';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { lightTheme } from '@theme/index';
import './style.css';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Create router with routes
const router = createBrowserRouter(routes);

const App = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider theme={lightTheme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>
          <SocketProvider>
            <Suspense fallback={<LoadingSpinner fullScreen text="Loading..." />}>
              <RouterProvider router={router} />
            </Suspense>
          </SocketProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;

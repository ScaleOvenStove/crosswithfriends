/**
 * QueryParamWrapper Component
 * Wraps the application with QueryParamProvider
 * Must be inside RouterProvider to access router context
 */

import { QueryParamProvider } from 'use-query-params';
import { ReactRouter6Adapter } from 'use-query-params/adapters/react-router-6';
import { Outlet } from 'react-router-dom';

const QueryParamWrapper = () => {
  return (
    <QueryParamProvider adapter={ReactRouter6Adapter}>
      <Outlet />
    </QueryParamProvider>
  );
};

export default QueryParamWrapper;

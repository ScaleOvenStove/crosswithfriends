/**
 * 403 Forbidden Error Page
 * Displayed when access to a resource is denied
 */

import { Block as BlockIcon } from '@mui/icons-material';
import ErrorLayout from '@components/common/ErrorLayout';

const Forbidden403 = () => {
  const suggestions = [
    "Make sure you're logged in with the correct account",
    'Verify that you have permission to access this resource',
    'Contact the game host or administrator if you believe this is an error',
    "Try refreshing the page in case it's a temporary issue",
    'Check if your account has the necessary privileges',
  ];

  return (
    <ErrorLayout
      icon={<BlockIcon fontSize="inherit" />}
      errorCode="403"
      title="Access Denied"
      message="Sorry, you don't have permission to access this page or resource. This might be because you're not logged in, your session has expired, or you lack the necessary privileges."
      suggestions={suggestions}
      showRetry={true}
    />
  );
};

export default Forbidden403;

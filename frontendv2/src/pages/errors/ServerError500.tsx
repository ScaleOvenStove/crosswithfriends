/**
 * 500 Server Error Page
 * Displayed when an internal server or runtime error occurs
 */

import { ReportProblem as ReportProblemIcon } from '@mui/icons-material';
import ErrorLayout from '@components/common/ErrorLayout';

interface ServerError500Props {
  error?: Error;
  resetError?: () => void;
}

export default function ServerError500({ error, resetError }: ServerError500Props = {}) {
  const suggestions = [
    'Try refreshing the page to see if the issue resolves itself',
    'Wait a few minutes and try again - this might be a temporary issue',
    'Clear your browser cache and cookies',
    'Try accessing the page from a different browser or device',
    'Contact support if the problem persists',
  ];

  // In development, show more error details
  const isDevelopment = import.meta.env.DEV;
  const errorMessage = isDevelopment && error ? `Technical details: ${error.message}` : undefined;

  return (
    <ErrorLayout
      icon={<ReportProblemIcon fontSize="inherit" />}
      errorCode="500"
      title="Something Went Wrong"
      message="We're sorry, but something unexpected happened on our end. Our team has been notified and is working to fix the issue."
      suggestions={suggestions}
      showRetry={true}
      onRetry={resetError}
    >
      {isDevelopment && error && (
        <details
          style={{
            textAlign: 'left',
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
            fontSize: '0.875rem',
          }}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '0.5rem' }}>
            Error Details (Dev Mode)
          </summary>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: 0,
              fontSize: '0.75rem',
            }}
          >
            {error.stack || error.message}
          </pre>
        </details>
      )}
    </ErrorLayout>
  );
}

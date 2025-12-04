/**
 * 503 Service Unavailable Error Page
 * Displayed during maintenance or when service is temporarily unavailable
 */

import { Build as BuildIcon } from '@mui/icons-material';
import { Typography } from '@mui/material';
import ErrorLayout from '@components/common/ErrorLayout';

export default function ServiceUnavailable503() {
  const suggestions = [
    'Check back in a few minutes - we should be back online soon',
    'Follow our status page or social media for updates',
    'Try again in a little while',
    'Contact support if you need urgent assistance',
  ];

  return (
    <ErrorLayout
      icon={<BuildIcon fontSize="inherit" />}
      errorCode="503"
      title="Service Temporarily Unavailable"
      message="We're currently performing scheduled maintenance to improve your experience. We'll be back up and running shortly!"
      suggestions={suggestions}
      showRetry={true}
    >
      <Typography
        variant="body2"
        sx={{
          color: 'info.main',
          fontWeight: 500,
          mt: 2,
          p: 2,
          bgcolor: 'info.lighter',
          borderRadius: 1,
        }}
      >
        💡 Tip: Bookmark this page and check back soon!
      </Typography>
    </ErrorLayout>
  );
}

/**
 * UploadProgress Component - Upload progress indicator
 * Implements REQ-3.2.5: Upload feedback
 *
 * Features:
 * - Progress bar
 * - File name display
 * - Percentage indicator
 * - Cancel button (optional)
 */

import { Box, LinearProgress, Typography, IconButton, Paper, styled } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface UploadProgressProps {
  fileName: string;
  progress: number;
  onCancel?: () => void;
}

const ProgressContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  backgroundColor: theme.palette.background.paper,
}));

const ProgressHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 16,
});

const ProgressBar = styled(LinearProgress)(({ theme }) => ({
  height: 8,
  borderRadius: 4,
  backgroundColor: theme.palette.grey[200],
  '& .MuiLinearProgress-bar': {
    borderRadius: 4,
  },
}));

/**
 * UploadProgress component
 */
export const UploadProgress = ({ fileName, progress, onCancel }: UploadProgressProps) => {
  return (
    <ProgressContainer elevation={2}>
      <ProgressHeader>
        <Box flex={1}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Uploading Puzzle
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {fileName}
          </Typography>
        </Box>
        {onCancel && (
          <IconButton onClick={onCancel} size="small" aria-label="Cancel upload">
            <CloseIcon />
          </IconButton>
        )}
      </ProgressHeader>

      <Box display="flex" alignItems="center" gap={2}>
        <Box flex={1}>
          <ProgressBar variant="determinate" value={progress} />
        </Box>
        <Typography variant="body2" fontWeight={600} minWidth={45} textAlign="right">
          {Math.round(progress)}%
        </Typography>
      </Box>

      {progress === 100 && (
        <Typography variant="caption" color="success.main" display="block" mt={1}>
          Upload complete!
        </Typography>
      )}
    </ProgressContainer>
  );
};

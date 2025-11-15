import {Box, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography,Snackbar, Alert} from '@mui/material';
import React, {useState} from 'react';
import {MdInfo, MdShare, MdContentCopy} from 'react-icons/md';

interface PuzzleInfoProps {
  title: string;
  author: string;
  type?: string;
  pid?: number;
  gid?: string;
}

const PuzzleInfo: React.FC<PuzzleInfoProps> = ({title, author, type, pid, gid}) => {
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const handleShare = () => {
    const url = pid ? `${window.location.origin}/beta/play/${pid}` : window.location.href;
    navigator.clipboard.writeText(url);
    setSnackbarOpen(true);
  };

  const handleCopyGameLink = () => {
    if (gid) {
      const url = `${window.location.origin}/beta/game/${gid}`;
      navigator.clipboard.writeText(url);
      setSnackbarOpen(true);
    }
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          padding: {xs: '10px 12px', sm: '12px 16px'},
          backgroundColor: 'rgba(106, 169, 244, 0.08)',
          borderRadius: '8px',
          marginBottom: '12px',
          border: '1px solid rgba(106, 169, 244, 0.15)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
          '&:hover': {
            backgroundColor: 'rgba(106, 169, 244, 0.12)',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
          },
        }}
      >
        <Box sx={{flex: 1, minWidth: 0}}>
          <Typography
            variant="h6"
            sx={{
              fontSize: {xs: '16px', sm: '18px'},
              fontWeight: 600,
              margin: 0,
              marginBottom: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'text.primary',
              lineHeight: 1.3,
            }}
            title={title}
          >
            {title}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontSize: {xs: '13px', sm: '14px'},
              color: 'text.secondary',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.4,
            }}
            title={`By ${author}${type ? ` • ${type}` : ''}`}
          >
            By {author}
            {type && ` • ${type}`}
          </Typography>
        </Box>
        <Tooltip title="Puzzle information">
          <IconButton
            size="small"
            onClick={() => setInfoDialogOpen(true)}
            aria-label="Show puzzle information"
          >
            <MdInfo />
          </IconButton>
        </Tooltip>
        <Tooltip title="Share puzzle">
          <IconButton size="small" onClick={handleShare} aria-label="Share puzzle">
            <MdShare />
          </IconButton>
        </Tooltip>
      </Box>

      <Dialog open={infoDialogOpen} onClose={() => setInfoDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Puzzle Information</DialogTitle>
        <DialogContent>
          <Typography variant="h6" sx={{marginBottom: 1}}>
            {title}
          </Typography>
          <Typography variant="body1" sx={{marginBottom: 2}}>
            <strong>Author:</strong> {author}
          </Typography>
          {type && (
            <Typography variant="body1" sx={{marginBottom: 2}}>
              <strong>Type:</strong> {type}
            </Typography>
          )}
          {pid && (
            <Typography variant="body2" sx={{marginBottom: 2, color: 'text.secondary'}}>
              Puzzle ID: {pid}
            </Typography>
          )}
          {gid && (
            <Box sx={{marginTop: 2, padding: 1, backgroundColor: 'rgba(0, 0, 0, 0.05)', borderRadius: 1}}>
              <Typography variant="body2" sx={{marginBottom: 1}}>
                <strong>Game Link:</strong>
              </Typography>
              <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                <Typography
                  variant="body2"
                  sx={{
                    flex: 1,
                    wordBreak: 'break-all',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                  }}
                >
                  {window.location.origin}/beta/game/{gid}
                </Typography>
                <IconButton size="small" onClick={handleCopyGameLink} aria-label="Copy game link">
                  <MdContentCopy fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInfoDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="success" sx={{width: '100%'}}>
          Link copied to clipboard!
        </Alert>
      </Snackbar>
    </>
  );
};

export default PuzzleInfo;


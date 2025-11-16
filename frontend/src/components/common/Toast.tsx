import {Snackbar, Alert, type AlertColor} from '@mui/material';
import React from 'react';

interface ToastProps {
  open: boolean;
  message: string;
  severity?: AlertColor;
  duration?: number;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({open, message, severity = 'success', duration = 3000, onClose}) => {
  return (
    <Snackbar
      open={open}
      autoHideDuration={duration}
      onClose={onClose}
      anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
    >
      <Alert onClose={onClose} severity={severity} sx={{width: '100%'}}>
        {message}
      </Alert>
    </Snackbar>
  );
};

export default Toast;

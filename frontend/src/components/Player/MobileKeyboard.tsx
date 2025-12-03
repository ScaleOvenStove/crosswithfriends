import {Box} from '@mui/material';
import React from 'react';

import {logger} from '../../utils/logger';

// Keyboard disabled to avoid React 19 compatibility issues with react-simple-keyboard
// import './css/mobileKeyboard.css';
// import 'react-simple-keyboard/build/css/index.css';

const globalKeyboardState = {
  setLayout: null as ((layout: string) => void) | null,
  callback: null as ((key: string) => void) | null,
  onUnfocusCallback: null as (() => void) | null,
};

export const focusKeyboard = (callback: (key: string) => void, layout = 'default') => {
  if (globalKeyboardState.callback !== callback) {
    if (globalKeyboardState.onUnfocusCallback) {
      globalKeyboardState.onUnfocusCallback();
    }
    globalKeyboardState.onUnfocusCallback = null;
    globalKeyboardState.callback = callback;
  }
  if (globalKeyboardState.setLayout) {
    globalKeyboardState.setLayout(layout);
  }
};

export const unfocusKeyboard = () => {
  logger.debug('Unfocusing keyboard');

  if (globalKeyboardState.onUnfocusCallback) {
    globalKeyboardState.onUnfocusCallback();
  }
  globalKeyboardState.callback = null;
};

export const onUnfocusKeyboard = (callback: () => void) => {
  globalKeyboardState.onUnfocusCallback = callback;
};

interface MobileKeyboardProps {
  layout?: string;
}

const MobileKeyboard: React.FC<MobileKeyboardProps> = () => {
  // Keyboard disabled to avoid React 19 compatibility issues
  return null;
};

export default MobileKeyboard;

import {Box} from '@mui/material';
import React, {useState, useEffect, useCallback, lazy, Suspense} from 'react';

// Lazy load react-simple-keyboard to reduce initial bundle size
const SimpleKeyboard = lazy(() => import('react-simple-keyboard'));

import {logger} from '../../utils/logger';

import './css/mobileKeyboard.css';
// CSS for react-simple-keyboard - small file, keep as regular import
import 'react-simple-keyboard/build/css/index.css';

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

const MobileKeyboard: React.FC<MobileKeyboardProps> = ({layout: initialLayout = 'default'}) => {
  const [layout, setLayout] = useState(initialLayout);

  useEffect(() => {
    globalKeyboardState.setLayout = setLayout;
    // Initialize touch handlers
    Array.from(document.querySelectorAll('.hg-button')).forEach((el) => {
      if (el.attributes.getNamedItem('data-react')) return;
      const htmlEl = el as HTMLElement;
      htmlEl.ontouchstart = () => {};
    });
  }, []);

  useEffect(() => {
    // Update touch handlers when layout changes
    Array.from(document.querySelectorAll('.hg-button')).forEach((el) => {
      if (el.attributes.getNamedItem('data-react')) return;
      const htmlEl = el as HTMLElement;
      htmlEl.ontouchstart = () => {};
    });
  }, [layout]);

  const handleKeyPress = useCallback((button: string) => {
    const onKeyDown = globalKeyboardState.callback || (() => {});
    if (button === '{more}') {
      setLayout('more');
    } else if (button === '{abc}') {
      setLayout('default');
    } else if (button === '{shift}') {
      setLayout((prevLayout) => {
        const layoutMap: Record<string, string> = {
          uppercase: 'lowercase',
          lowercase: 'uppercase',
        };
        return layoutMap[prevLayout] || prevLayout;
      });
    } else if (button === '{space}') {
      onKeyDown(' ');
    } else {
      onKeyDown(button);
    }
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const dataSkbtn = e.target instanceof HTMLElement && e.target.attributes.getNamedItem('data-skbtn');
      if (!dataSkbtn) return;
      const val = dataSkbtn.value;
      handleKeyPress(val);
      e.preventDefault();
      e.stopPropagation();
    },
    [handleKeyPress]
  );

  return (
    <Box sx={{flex: 1}} onTouchStart={handleTouchStart}>
      <Suspense fallback={<div style={{height: '200px'}}>Loading keyboard...</div>}>
        <SimpleKeyboard
          layout={{
            default: ['Q W E R T Y U I O P', 'A S D F G H J K L', '{more} Z X C V B N M {del}'],
            uppercase: [
              'Q W E R T Y U I O P',
              'A S D F G H J K L',
              ': Z X C V B N M {del}',
              '{shift} {emoji} {space} , . {enter}',
            ],
            lowercase: [
              'q w e r t y u i o p',
              'a s d f g h j k l',
              ': z x c v b n m {del}',
              '{shift} {emoji} {space} , . {enter}',
            ],
            more: ['1 2 3 4 5 6 7 8 9 0', '@ # $ % & * - = +', "{abc} ' , . : / {rebus} {del}"],
          }}
          display={{
            '{shift}': '⇧',
            '{del}': '⌫',
            '{more}': '123',
            '{abc}': 'ABC',
            '{rebus}': '{}',
            '{emoji}': ' ',
            '{enter}': '⏎',
          }}
          useTouchEvents
          layoutName={layout}
        />
      </Suspense>
    </Box>
  );
};

export default MobileKeyboard;

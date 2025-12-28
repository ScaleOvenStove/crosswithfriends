/**
 * useVirtualKeyboard - Hook for managing virtual keyboard state
 * Provides keyboard visibility and input handling for mobile devices
 */

import { useState, useEffect, useCallback } from 'react';
import { isMobile, isTablet } from 'react-device-detect';

interface UseVirtualKeyboardOptions {
  autoShow?: boolean;
  onKeyPress?: (key: string) => void;
  onBackspace?: () => void;
  onArrowKey?: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

export const useVirtualKeyboard = ({
  autoShow = true,
  onKeyPress,
  onBackspace,
  onArrowKey,
}: UseVirtualKeyboardOptions = {}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  // Detect if device is mobile/tablet
  useEffect(() => {
    const isMobileDevice = isMobile || isTablet;
    setShouldShow(isMobileDevice);

    if (isMobileDevice && autoShow) {
      setIsVisible(true);
    }

    // Handle orientation change
    const handleOrientationChange = () => {
      const stillMobile = isMobile || isTablet;
      setShouldShow(stillMobile);
    };

    window.addEventListener('resize', handleOrientationChange);
    return () => window.removeEventListener('resize', handleOrientationChange);
  }, [autoShow]);

  const showKeyboard = useCallback(() => {
    setIsVisible(true);
  }, []);

  const hideKeyboard = useCallback(() => {
    setIsVisible(false);
  }, []);

  const toggleKeyboard = useCallback(() => {
    setIsVisible((prev) => !prev);
  }, []);

  const handleKeyPress = useCallback(
    (key: string) => {
      onKeyPress?.(key);
    },
    [onKeyPress]
  );

  const handleBackspace = useCallback(() => {
    onBackspace?.();
  }, [onBackspace]);

  const handleArrowKey = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      onArrowKey?.(direction);
    },
    [onArrowKey]
  );

  return {
    isVisible: isVisible && shouldShow,
    shouldShow,
    showKeyboard,
    hideKeyboard,
    toggleKeyboard,
    handleKeyPress,
    handleBackspace,
    handleArrowKey,
  };
};

export default useVirtualKeyboard;

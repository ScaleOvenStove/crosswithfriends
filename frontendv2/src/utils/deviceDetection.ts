/**
 * Device Detection Utilities
 * Wrapper around react-device-detect for backward compatibility
 *
 * @deprecated Use react-device-detect hooks directly in components
 * This file is kept for backward compatibility during migration
 */

import { isMobile, isTablet, isDesktop } from 'react-device-detect';

/**
 * Check if device is mobile or tablet
 * @deprecated Use isMobile or isTablet from react-device-detect
 */
export const isMobileOrTablet = (): boolean => {
  return isMobile || isTablet;
};

/**
 * Check if device is specifically mobile (not tablet)
 * @deprecated Use isMobile from react-device-detect
 */
export const isMobileDevice = (): boolean => {
  return isMobile;
};

/**
 * Check if device is tablet
 * @deprecated Use isTablet from react-device-detect
 */
export const isTabletDevice = (): boolean => {
  return isTablet;
};

/**
 * Check if device supports vibration API
 */
export const supportsVibration = (): boolean => {
  return 'vibrate' in navigator;
};

/**
 * Trigger haptic feedback (vibration)
 */
export const triggerHapticFeedback = (duration: number = 10): void => {
  if (supportsVibration()) {
    navigator.vibrate(duration);
  }
};

/**
 * Get device orientation
 */
export const getOrientation = (): 'portrait' | 'landscape' => {
  if (window.innerHeight > window.innerWidth) {
    return 'portrait';
  }
  return 'landscape';
};

/**
 * Check if device is in fullscreen mode
 */
export const isFullscreen = (): boolean => {
  return !!(
    document.fullscreenElement ||
    (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
    (document as unknown as { mozFullScreenElement?: Element }).mozFullScreenElement ||
    (document as unknown as { msFullscreenElement?: Element }).msFullscreenElement
  );
};

/**
 * Request fullscreen mode
 */
export const requestFullscreen = (
  element: HTMLElement = document.documentElement
): Promise<void> => {
  if (element.requestFullscreen) {
    return element.requestFullscreen();
  } else if (
    (element as unknown as { webkitRequestFullscreen?: () => Promise<void> })
      .webkitRequestFullscreen
  ) {
    return (
      element as unknown as { webkitRequestFullscreen: () => Promise<void> }
    ).webkitRequestFullscreen();
  } else if (
    (element as unknown as { mozRequestFullScreen?: () => Promise<void> }).mozRequestFullScreen
  ) {
    return (
      element as unknown as { mozRequestFullScreen: () => Promise<void> }
    ).mozRequestFullScreen();
  } else if (
    (element as unknown as { msRequestFullscreen?: () => Promise<void> }).msRequestFullscreen
  ) {
    return (
      element as unknown as { msRequestFullscreen: () => Promise<void> }
    ).msRequestFullscreen();
  }
  return Promise.reject(new Error('Fullscreen not supported'));
};

/**
 * Exit fullscreen mode
 */
export const exitFullscreen = (): Promise<void> => {
  if (document.exitFullscreen) {
    return document.exitFullscreen();
  } else if (
    (document as unknown as { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen
  ) {
    return (
      document as unknown as { webkitExitFullscreen: () => Promise<void> }
    ).webkitExitFullscreen();
  } else if (
    (document as unknown as { mozCancelFullScreen?: () => Promise<void> }).mozCancelFullScreen
  ) {
    return (
      document as unknown as { mozCancelFullScreen: () => Promise<void> }
    ).mozCancelFullScreen();
  } else if ((document as unknown as { msExitFullscreen?: () => Promise<void> }).msExitFullscreen) {
    return (document as unknown as { msExitFullscreen: () => Promise<void> }).msExitFullscreen();
  }
  return Promise.reject(new Error('Fullscreen not supported'));
};

/**
 * Device Detection Utilities
 * Detects mobile/tablet devices and provides device-specific features
 */

/**
 * Check if device is mobile or tablet based on user agent and screen size
 */
export const isMobileOrTablet = (): boolean => {
  // Check user agent
  const userAgent =
    navigator.userAgent ||
    navigator.vendor ||
    (window as unknown as { opera?: string }).opera ||
    '';

  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
  const isUserAgentMobile = mobileRegex.test(userAgent.toLowerCase());

  // Check screen size (mobile/tablet typically < 1024px)
  const isSmallScreen = window.innerWidth < 1024;

  // Check touch capability
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  return (isUserAgentMobile || isSmallScreen) && hasTouch;
};

/**
 * Check if device is specifically mobile (not tablet)
 */
export const isMobile = (): boolean => {
  const userAgent = navigator.userAgent || '';
  const mobileRegex = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i;

  return mobileRegex.test(userAgent.toLowerCase()) && window.innerWidth < 768;
};

/**
 * Check if device is tablet
 */
export const isTablet = (): boolean => {
  const userAgent = navigator.userAgent || '';
  const tabletRegex = /ipad|android(?!.*mobile)|tablet/i;

  return (
    tabletRegex.test(userAgent.toLowerCase()) &&
    window.innerWidth >= 768 &&
    window.innerWidth < 1024
  );
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

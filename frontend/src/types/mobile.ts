/**
 * Mobile & Touch Device Types
 * Type definitions for mobile keyboard and device detection
 */

// ============================================================================
// Device Detection
// ============================================================================

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export type Orientation = 'portrait' | 'landscape';

export interface DeviceInfo {
  type: DeviceType;
  orientation: Orientation;
  isTouchDevice: boolean;
  screenWidth: number;
  screenHeight: number;
  userAgent: string;
}

// ============================================================================
// Virtual Keyboard
// ============================================================================

export type KeyboardLayout = 'qwerty' | 'alphabetic';

export type KeyType = 'letter' | 'backspace' | 'direction' | 'special';

export interface KeyboardKey {
  key: string;
  type: KeyType;
  label: string;
  icon?: string;
  width?: number; // relative width (1 = normal, 2 = double width, etc.)
}

export interface KeyboardRow {
  keys: KeyboardKey[];
}

export interface VirtualKeyboardConfig {
  layout: KeyboardLayout;
  hapticFeedback: boolean;
  soundFeedback: boolean;
  autoCapitalize: boolean;
  showDirectionalKeys: boolean;
}

export interface VirtualKeyboardState {
  visible: boolean;
  collapsed: boolean;
  position: 'bottom' | 'docked';
}

// ============================================================================
// Touch Events
// ============================================================================

export interface TouchPosition {
  x: number;
  y: number;
  timestamp: number;
}

export interface SwipeGesture {
  direction: 'up' | 'down' | 'left' | 'right';
  distance: number;
  velocity: number;
  startPosition: TouchPosition;
  endPosition: TouchPosition;
}

export interface LongPressGesture {
  position: TouchPosition;
  duration: number;
}

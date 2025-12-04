/**
 * LocalStorage utilities for user identification and preferences
 */

const STORAGE_KEYS = {
  USER_ID: 'cwf_user_id',
  USER_NAME: 'cwf_user_name',
  USER_COLOR: 'cwf_user_color',
  DARK_MODE: 'cwf_dark_mode',
} as const;

export const generateUserId = (): string => {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const getUserId = (): string => {
  let userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
  if (!userId) {
    userId = generateUserId();
    localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
  }
  return userId;
};

export const getUserName = (): string => {
  return localStorage.getItem(STORAGE_KEYS.USER_NAME) || 'Guest';
};

export const setUserName = (name: string): void => {
  localStorage.setItem(STORAGE_KEYS.USER_NAME, name);
};

export const getUserColor = (): string => {
  let color = localStorage.getItem(STORAGE_KEYS.USER_COLOR);
  if (!color) {
    color = generateRandomColor();
    localStorage.setItem(STORAGE_KEYS.USER_COLOR, color);
  }
  return color;
};

export const setUserColor = (color: string): void => {
  localStorage.setItem(STORAGE_KEYS.USER_COLOR, color);
};

export const generateRandomColor = (): string => {
  const colors = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#06b6d4', // cyan
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
  ];
  return colors[Math.floor(Math.random() * colors.length)] as string;
};

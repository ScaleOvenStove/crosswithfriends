/**
 * User hook for managing user state
 * Implements REQ-6: User Account Features
 */

import { useEffect } from 'react';
import { useUserStore } from '@stores/userStore';
import { getUserId, getUserName, getUserColor, setUserName, setUserColor } from '@utils/index';

export const useUser = () => {
  const { user, setUser, updateUserName, updateUserColor, darkMode, setDarkMode } = useUserStore();

  useEffect(() => {
    // Initialize user from localStorage on mount
    if (!user) {
      const userId = getUserId();
      const displayName = getUserName();
      const color = getUserColor();

      setUser({
        id: userId,
        displayName,
        color,
        isActive: true,
      });
    }
  }, [user, setUser]);

  const changeName = (name: string) => {
    setUserName(name);
    updateUserName(name);
  };

  const changeColor = (color: string) => {
    setUserColor(color);
    updateUserColor(color);
  };

  return {
    user,
    darkMode,
    setDarkMode,
    changeName,
    changeColor,
  };
};

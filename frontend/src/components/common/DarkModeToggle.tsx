/**
 * Dark Mode Toggle Component
 * Implements REQ-7.2: Dark mode support
 */

import { IconButton, Tooltip, useTheme } from '@mui/material';
import { LightMode, DarkMode, SettingsBrightness } from '@mui/icons-material';
import { useUserStore } from '@stores/userStore';
import type { DarkMode as DarkModeType } from '@types/index';

const DarkModeToggle = () => {
  const { darkMode, setDarkMode } = useUserStore();
  const _theme = useTheme();

  const handleToggle = () => {
    const modes: DarkModeType[] = ['light', 'dark', 'system'];
    const currentIndex = modes.indexOf(darkMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setDarkMode(nextMode);
  };

  const getIcon = () => {
    switch (darkMode) {
      case 'light':
        return <LightMode />;
      case 'dark':
        return <DarkMode />;
      case 'system':
        return <SettingsBrightness />;
    }
  };

  const getTooltipTitle = () => {
    switch (darkMode) {
      case 'light':
        return 'Light mode (click for dark)';
      case 'dark':
        return 'Dark mode (click for system)';
      case 'system':
        return 'System preference (click for light)';
    }
  };

  return (
    <Tooltip title={getTooltipTitle()} arrow>
      <IconButton
        onClick={handleToggle}
        color="inherit"
        aria-label="Toggle dark mode"
        sx={{
          transition: 'transform 0.2s ease-in-out',
          '&:hover': {
            transform: 'scale(1.1)',
          },
        }}
      >
        {getIcon()}
      </IconButton>
    </Tooltip>
  );
};

export default DarkModeToggle;

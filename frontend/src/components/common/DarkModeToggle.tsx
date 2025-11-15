import GlobalContext from '@crosswithfriends/shared/lib/GlobalContext';
import {IconButton, Tooltip} from '@mui/material';
import React, {useContext} from 'react';
import {MdDarkMode, MdLightMode, MdSettingsBrightness} from 'react-icons/md';


import './css/darkModeToggle.css';

export const DarkModeToggle: React.FC = () => {
  const {darkModePreference, toggleMolesterMoons} = useContext(GlobalContext);

  const getIcon = () => {
    switch (darkModePreference) {
      case '1':
        return <MdDarkMode />;
      case '2':
        return <MdSettingsBrightness />;
      case '0':
      default:
        return <MdLightMode />;
    }
  };

  const getTooltipText = () => {
    switch (darkModePreference) {
      case '1':
        return 'Dark mode: On (click to switch to System default)';
      case '2':
        return 'Dark mode: System default (click to switch to Off)';
      case '0':
      default:
        return 'Dark mode: Off (click to switch to On)';
    }
  };

  return (
    <Tooltip title={getTooltipText()} arrow placement="bottom">
      <IconButton
        className="dark-mode-toggle"
        onClick={toggleMolesterMoons}
        color="inherit"
        aria-label="Toggle dark mode"
        size="small"
        sx={{
          padding: '4px',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          },
        }}
      >
        {getIcon()}
      </IconButton>
    </Tooltip>
  );
};


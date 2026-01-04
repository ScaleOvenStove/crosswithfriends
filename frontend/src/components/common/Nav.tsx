/**
 * Navigation Component
 * Implements REQ-7.3: Navigation bar
 */

import { Link, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Box, Link as MuiLink, useTheme } from '@mui/material';
import DarkModeToggle from './DarkModeToggle';
import ConnectionStatus from './ConnectionStatus';

const Nav = () => {
  const location = useLocation();
  const isEmbedMode = location.pathname.startsWith('/embed/');
  const theme = useTheme();

  // Hide navigation in embed mode (REQ-7.3.3)
  if (isEmbedMode) {
    return null;
  }

  return (
    <AppBar
      position="static"
      elevation={1}
      sx={{
        backgroundColor: theme.palette.mode === 'dark' ? 'background.paper' : 'background.default',
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Toolbar
        sx={{ justifyContent: 'space-between', maxWidth: '2000px', width: '100%', mx: 'auto' }}
      >
        <MuiLink
          component={Link}
          to="/"
          sx={{
            textDecoration: 'none',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'primary.main',
            '&:hover': {
              color: 'primary.dark',
            },
            transition: 'color 0.2s ease-in-out',
          }}
        >
          Cross with Friends
        </MuiLink>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <MuiLink
            component={Link}
            to="/"
            sx={{
              textDecoration: 'none',
              color: 'text.secondary',
              fontWeight: 500,
              '&:hover': {
                color: 'primary.main',
              },
              transition: 'color 0.2s ease-in-out',
            }}
          >
            Home
          </MuiLink>
          <MuiLink
            component={Link}
            to="/compose"
            sx={{
              textDecoration: 'none',
              color: 'text.secondary',
              fontWeight: 500,
              '&:hover': {
                color: 'primary.main',
              },
              transition: 'color 0.2s ease-in-out',
            }}
          >
            Compose
          </MuiLink>
          <MuiLink
            component={Link}
            to="/account"
            sx={{
              textDecoration: 'none',
              color: 'text.secondary',
              fontWeight: 500,
              '&:hover': {
                color: 'primary.main',
              },
              transition: 'color 0.2s ease-in-out',
            }}
          >
            Account
          </MuiLink>
          <ConnectionStatus />
          <DarkModeToggle />
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Nav;

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
      elevation={0}
      sx={{
        backgroundColor: theme.palette.mode === 'dark' ? 'background.paper' : 'background.default',
        borderBottom: `2px solid ${theme.palette.divider}`,
        backdropFilter: 'blur(10px)',
        backgroundImage:
          theme.palette.mode === 'light'
            ? 'linear-gradient(to bottom, rgba(248, 246, 242, 0.95), rgba(248, 246, 242, 0.98))'
            : 'linear-gradient(to bottom, rgba(26, 23, 20, 0.95), rgba(26, 23, 20, 0.98))',
      }}
    >
      <Toolbar
        sx={{
          justifyContent: 'space-between',
          maxWidth: '2000px',
          width: '100%',
          mx: 'auto',
          py: 1.5,
        }}
      >
        <MuiLink
          component={Link}
          to="/"
          sx={{
            textDecoration: 'none',
            fontSize: '1.75rem',
            fontWeight: 700,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em',
            '&:hover': {
              transform: 'scale(1.02)',
            },
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'inline-block',
          }}
        >
          Cross with Friends
        </MuiLink>

        <Box
          sx={{
            display: 'flex',
            gap: 3,
            alignItems: 'center',
            '& > *': {
              animation: 'fadeInUp 0.6s ease-out',
              animationFillMode: 'both',
              '&:nth-of-type(1)': { animationDelay: '0.1s' },
              '&:nth-of-type(2)': { animationDelay: '0.2s' },
              '&:nth-of-type(3)': { animationDelay: '0.3s' },
              '&:nth-of-type(4)': { animationDelay: '0.4s' },
              '&:nth-of-type(5)': { animationDelay: '0.5s' },
            },
          }}
        >
          <MuiLink
            component={Link}
            to="/"
            sx={{
              textDecoration: 'none',
              color: 'text.secondary',
              fontWeight: 500,
              fontFamily: 'var(--font-display)',
              position: 'relative',
              '&::after': {
                content: '""',
                position: 'absolute',
                bottom: -4,
                left: 0,
                width: 0,
                height: 2,
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              },
              '&:hover': {
                color: 'primary.main',
                '&::after': {
                  width: '100%',
                },
              },
              transition: 'color 0.3s ease',
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
              fontFamily: 'var(--font-display)',
              position: 'relative',
              '&::after': {
                content: '""',
                position: 'absolute',
                bottom: -4,
                left: 0,
                width: 0,
                height: 2,
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              },
              '&:hover': {
                color: 'primary.main',
                '&::after': {
                  width: '100%',
                },
              },
              transition: 'color 0.3s ease',
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
              fontFamily: 'var(--font-display)',
              position: 'relative',
              '&::after': {
                content: '""',
                position: 'absolute',
                bottom: -4,
                left: 0,
                width: 0,
                height: 2,
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              },
              '&:hover': {
                color: 'primary.main',
                '&::after': {
                  width: '100%',
                },
              },
              transition: 'color 0.3s ease',
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

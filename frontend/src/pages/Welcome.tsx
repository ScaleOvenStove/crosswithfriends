/**
 * Welcome Page - Puzzle list and discovery
 * Implements REQ-3.1: Puzzle Discovery
 */

import { Link } from 'react-router-dom';
import { Box, Container, Typography, Button, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import Nav from '@components/common/Nav';
import PuzzleListComponent from '@components/PuzzleList/PuzzleListComponent';
import { useUser } from '@hooks/index';

const Welcome = () => {
  const { user } = useUser();
  const theme = useTheme();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'background.default',
      }}
    >
      <Nav />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box
          component="header"
          sx={{
            textAlign: 'center',
            py: { xs: 4, md: 8 },
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '120px',
              height: '4px',
              background: `linear-gradient(90deg, transparent, ${theme.palette.primary.main}, ${theme.palette.secondary.main}, transparent)`,
              borderRadius: '2px',
            },
          }}
        >
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '2.75rem', md: '4.5rem', lg: '5.5rem' },
              fontWeight: 700,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 2,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              animation: 'fadeInUp 0.8s ease-out',
            }}
          >
            Cross with Friends
          </Typography>
          <Typography
            variant="h5"
            sx={{
              color: 'text.secondary',
              mb: 3,
              fontStyle: 'italic',
              fontSize: { xs: '1.1rem', md: '1.35rem' },
              animation: 'fadeInUp 0.8s ease-out 0.2s both',
            }}
          >
            Real-time collaborative crossword puzzles
          </Typography>
          {user && (
            <Typography
              variant="h6"
              sx={{
                color: 'text.primary',
                mt: 3,
                fontSize: { xs: '1.1rem', md: '1.25rem' },
                animation: 'fadeInUp 0.8s ease-out 0.4s both',
              }}
            >
              Welcome,{' '}
              <Box
                component="span"
                sx={{
                  fontWeight: 600,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  display: 'inline-block',
                }}
              >
                {user.displayName}
              </Box>
              !
            </Typography>
          )}
        </Box>

        <Box
          component="nav"
          sx={{
            display: 'flex',
            gap: 3,
            justifyContent: 'center',
            mb: 8,
            flexWrap: 'wrap',
            '& > *': {
              animation: 'fadeInScale 0.6s ease-out',
              animationFillMode: 'both',
              '&:nth-of-type(1)': { animationDelay: '0.5s' },
              '&:nth-of-type(2)': { animationDelay: '0.6s' },
            },
          }}
          aria-label="Main actions"
        >
          <Button
            component={Link}
            to="/compose"
            variant="contained"
            size="large"
            sx={{
              px: 4,
              py: 1.75,
              fontWeight: 600,
              textTransform: 'none',
              fontFamily: 'var(--font-display)',
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
              boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.3)}, 0 2px 8px ${alpha(theme.palette.primary.main, 0.2)}`,
              borderRadius: 2,
              '&:hover': {
                background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.4)}, 0 4px 16px ${alpha(theme.palette.primary.main, 0.3)}`,
                transform: 'translateY(-3px) scale(1.02)',
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            aria-label="Create a new crossword puzzle"
          >
            Create New Puzzle
          </Button>
          <Button
            component={Link}
            to="/replays"
            variant="outlined"
            size="large"
            sx={{
              px: 4,
              py: 1.75,
              fontWeight: 600,
              textTransform: 'none',
              fontFamily: 'var(--font-display)',
              borderWidth: 2,
              borderColor: 'primary.main',
              color: 'primary.main',
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: `linear-gradient(90deg, transparent, ${alpha(theme.palette.primary.main, 0.1)}, transparent)`,
                transition: 'left 0.5s ease',
              },
              '&:hover': {
                borderWidth: 2,
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                transform: 'translateY(-3px) scale(1.02)',
                boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.3)}, 0 4px 16px ${alpha(theme.palette.primary.main, 0.2)}`,
                '&::before': {
                  left: '100%',
                },
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            aria-label="View puzzle replays"
          >
            View Replays
          </Button>
        </Box>

        <Box component="section" aria-labelledby="puzzle-list-heading">
          <Typography id="puzzle-list-heading" sx={{ srOnly: true }}>
            Available Puzzles
          </Typography>
          <PuzzleListComponent />
        </Box>
      </Container>
    </Box>
  );
};

export default Welcome;

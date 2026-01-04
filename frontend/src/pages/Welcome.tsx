/**
 * Welcome Page - Puzzle list and discovery
 * Implements REQ-3.1: Puzzle Discovery
 */

import { Link } from 'react-router-dom';
import { Box, Container, Typography, Button, useTheme } from '@mui/material';
import Nav from '@components/common/Nav';
import PuzzleListComponent from '@components/PuzzleList/PuzzleListComponent';
import { useUser } from '@hooks/index';

const Welcome = () => {
  const { user } = useUser();
  const _theme = useTheme();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'background.default',
      }}
    >
      <Nav />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box component="header" sx={{ textAlign: 'center', py: 6 }}>
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '2.5rem', md: '3.5rem' },
              fontWeight: 700,
              color: 'primary.main',
              mb: 1,
            }}
          >
            Cross with Friends
          </Typography>
          <Typography
            variant="h5"
            sx={{
              color: 'text.secondary',
              mb: 2,
            }}
          >
            Real-time collaborative crossword puzzles
          </Typography>
          {user && (
            <Typography
              variant="h6"
              sx={{
                color: 'text.primary',
                mt: 2,
              }}
            >
              Welcome,{' '}
              <Box component="span" sx={{ fontWeight: 600, color: 'primary.main' }}>
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
            gap: 2,
            justifyContent: 'center',
            mb: 6,
            flexWrap: 'wrap',
          }}
          aria-label="Main actions"
        >
          <Button
            component={Link}
            to="/compose"
            variant="contained"
            size="large"
            sx={{
              px: 3,
              py: 1.5,
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: 2,
              '&:hover': {
                boxShadow: 4,
                transform: 'translateY(-2px)',
              },
              transition: 'all 0.2s ease-in-out',
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
              px: 3,
              py: 1.5,
              fontWeight: 600,
              textTransform: 'none',
              borderWidth: 1,
              '&:hover': {
                borderWidth: 1,
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                transform: 'translateY(-2px)',
                boxShadow: 2,
              },
              transition: 'all 0.2s ease-in-out',
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

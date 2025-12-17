/**
 * Game Page - Collaborative crossword solving
 * Implements REQ-1.1: Real-Time Collaborative Solving
 */

import { useParams, useLocation, useSearchParams } from 'react-router-dom';
import { useEffect, useCallback, useRef } from 'react';
import { Box, Container, styled } from '@mui/material';
import Nav from '@components/common/Nav';
import { Grid, CluePanel, ActiveHint } from '@components/Grid';
import { GameToolbar } from '@components/Toolbar';
import { ChatPanel } from '@components/Chat';
import { GameSkeleton } from '@components/common/skeletons';
import ErrorLayout from '@components/common/ErrorLayout';
import { ComponentErrorBoundary } from '@components/common/ComponentErrorBoundary';
import { useGame } from '@hooks/game/useGame';
import { useClues } from '@hooks/puzzle/useClues';
import { useGameStore } from '@stores/gameStore';
import { useChat } from '@hooks/user/useChat';
import { useUser } from '@hooks/user/useUser';
import { SentimentDissatisfied as SadIcon } from '@mui/icons-material';

const GamePageContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  backgroundColor: theme.palette.background.default,
}));

const GameContent = styled(Container)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  overflow: 'auto',
  maxWidth: '2000px !important',
  minHeight: 0, // Critical for flex scrolling
  [theme.breakpoints.up('md')]: {
    flexDirection: 'row',
    gap: theme.spacing(3),
    padding: theme.spacing(3),
    overflow: 'hidden', // Individual sections scroll, not the container
    minHeight: 0,
  },
}));

const LeftSection = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  minWidth: 0, // Allow flexbox to shrink
  minHeight: 0, // Critical for flex scrolling
  overflow: 'hidden', // Individual sections scroll, not this container
  [theme.breakpoints.up('md')]: {
    flexDirection: 'column',
  },
}));

const GridSection = styled(Box)(({ theme }) => ({
  flex: '0 0 auto',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
  width: '100%',
  overflow: 'auto',
  [theme.breakpoints.up('sm')]: {
    width: 'auto',
  },
}));

const ClueSection = styled(Box)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  minHeight: 0, // Critical for flex scrolling
  maxWidth: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden', // CluePanel handles its own scrolling
  [theme.breakpoints.up('sm')]: {
    minWidth: 280,
    maxWidth: 400,
  },
  [theme.breakpoints.up('md')]: {
    minWidth: 300,
  },
}));

const GridAndCluesContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  flex: 1,
  minWidth: 0,
  minHeight: 0, // Critical for flex scrolling
  [theme.breakpoints.up('sm')]: {
    flexDirection: 'row',
    gap: theme.spacing(2),
  },
  [theme.breakpoints.up('md')]: {
    gap: theme.spacing(3),
  },
}));

const ChatSection = styled(Box)(({ theme }) => ({
  flex: '0 0 auto',
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  maxHeight: '400px',
  [theme.breakpoints.up('sm')]: {
    maxHeight: 'none',
  },
  [theme.breakpoints.up('md')]: {
    flex: '0 0 350px',
    width: 'auto',
  },
}));

const Game = () => {
  const { gid, pid } = useParams<{ gid?: string; pid?: string }>();
  const location = useLocation();
  const isEmbedMode = location.pathname.startsWith('/embed/');
  const [searchParams] = useSearchParams();
  const isNewGame = searchParams.get('new') === 'true';
  const hasSentInvite = useRef(false);

  // Use either gid (for existing games) or pid (for new puzzles)
  const gameId = gid || pid;

  // Log for debugging
  if (!gameId) {
    console.warn('[Game] No gameId available:', { gid, pid, pathname: location.pathname });
  }

  // Get game state and actions from hooks
  const {
    cells,
    selectedCell,
    selectedDirection,
    isPencilMode,
    isComplete,
    clock,
    isConnected,
    isLoading,
    loadError,
    handleCellUpdate,
    handleCellSelect,
    toggleDirection,
    togglePencilMode,
    startClock,
    pauseClock,
    resetClock,
  } = useGame(gameId);

  // Get additional store state and actions
  const {
    currentUser,
    users,
    cursors,
    clues,
    isAutoCheckMode,
    toggleAutoCheckMode,
    checkCell,
    checkWord,
    checkPuzzle,
    revealCell,
    revealWord,
    revealPuzzle,
    resetCell,
    resetWord,
    resetPuzzle,
  } = useGameStore();

  // Use clues hook (with safe defaults)
  const safeClues = {
    across: clues?.across || [],
    down: clues?.down || [],
  };

  const { currentClue, completedClues } = useClues({
    clues: safeClues,
    cells,
    selectedCell,
    selectedDirection,
    isAutoCheckMode,
  });

  // Get user from userStore (which has saved username from localStorage)
  const { user: savedUser } = useUser();
  const savedUserName = savedUser?.displayName || 'Guest';

  // Get chat hook for sending invite message
  const { sendMessage: sendChatMessage } = useChat({
    gameId: gameId || null,
    userId: currentUser?.id || 'guest',
    userName: savedUserName,
    userColor: currentUser?.color || '#1976d2',
  });

  // Send invite message when new game is created
  useEffect(() => {
    if (
      isNewGame &&
      !hasSentInvite.current &&
      gameId &&
      isConnected &&
      !isLoading &&
      cells.length > 0 &&
      currentUser
    ) {
      // Wait a bit for chat to be fully ready
      const timer = setTimeout(() => {
        const gameUrl = `${window.location.origin}/game/${gameId}`;
        const inviteMessage = `🎮 New game started! Join me: ${gameUrl}`;
        sendChatMessage(inviteMessage);
        hasSentInvite.current = true;
        // Remove the query parameter from URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }, 1000); // Wait 1 second for chat to initialize

      return () => clearTimeout(timer);
    }
  }, [isNewGame, gameId, isConnected, isLoading, cells.length, currentUser, sendChatMessage]);

  // Handle clue click - navigate to clue in grid
  const handleClueClick = useCallback(
    (clue: any) => {
      // Find the starting cell for this clue
      for (let row = 0; row < cells.length; row++) {
        const cellRow = cells[row];
        if (!cellRow) continue;

        for (let col = 0; col < cellRow.length; col++) {
          const cell = cellRow[col];
          if (cell?.number === clue.number) {
            handleCellSelect(row, col);
            // Set direction based on clue
            if (
              (clue.direction === 'across' && selectedDirection === 'down') ||
              (clue.direction === 'down' && selectedDirection === 'across')
            ) {
              toggleDirection();
            }
            return;
          }
        }
      }
    },
    [cells, handleCellSelect, selectedDirection, toggleDirection]
  );

  // Handle game tool actions
  const handleCheck = (scope: 'cell' | 'word' | 'puzzle') => {
    if (!selectedCell) return;

    let isCorrect = false;
    switch (scope) {
      case 'cell':
        isCorrect = checkCell(selectedCell.row, selectedCell.col);
        alert(isCorrect ? 'Cell is correct!' : 'Cell is incorrect');
        break;
      case 'word':
        isCorrect = checkWord(selectedCell.row, selectedCell.col, selectedDirection);
        alert(isCorrect ? 'Word is correct!' : 'Word has errors');
        break;
      case 'puzzle':
        isCorrect = checkPuzzle();
        alert(isCorrect ? 'Puzzle is complete and correct!' : 'Puzzle has errors');
        break;
    }
  };

  const handleReveal = (scope: 'cell' | 'word' | 'puzzle') => {
    if (!selectedCell && scope !== 'puzzle') return;

    switch (scope) {
      case 'cell':
        revealCell(selectedCell!.row, selectedCell!.col);
        break;
      case 'word':
        revealWord(selectedCell!.row, selectedCell!.col, selectedDirection);
        break;
      case 'puzzle':
        if (confirm('Are you sure you want to reveal the entire puzzle?')) {
          revealPuzzle();
        }
        break;
    }
  };

  const handleReset = (scope: 'cell' | 'word' | 'puzzle') => {
    if (!selectedCell && scope !== 'puzzle') return;

    switch (scope) {
      case 'cell':
        resetCell(selectedCell!.row, selectedCell!.col);
        break;
      case 'word':
        resetWord(selectedCell!.row, selectedCell!.col, selectedDirection);
        break;
      case 'puzzle':
        if (confirm('Are you sure you want to reset the entire puzzle?')) {
          resetPuzzle();
        }
        break;
    }
  };

  // Auto-start clock on first interaction
  useEffect(() => {
    if (cells.length > 0 && !clock.isRunning && !isComplete) {
      startClock();
    }
  }, [cells, clock.isRunning, isComplete, startClock]);

  // Loading states
  if (!gameId) {
    return (
      <GamePageContainer>
        {!isEmbedMode && <Nav />}
        <Container>
          <Box p={4}>Invalid game ID</Box>
        </Container>
      </GamePageContainer>
    );
  }

  // Error state
  if (loadError) {
    // Determine if it's a 404 error for better messaging
    const is404 = loadError.includes('not found') || loadError.includes('404');
    const isRouteError = loadError.includes('Route');

    return (
      <GamePageContainer>
        {!isEmbedMode && <Nav />}
        <ErrorLayout
          icon={<SadIcon sx={{ fontSize: 'inherit' }} />}
          errorCode={is404 ? '404' : 'Error'}
          title={is404 ? 'Puzzle Not Found' : 'Failed to Load Puzzle'}
          message={
            isRouteError
              ? 'This puzzle endpoint is not available on the server. The backend may need to be updated.'
              : loadError
          }
          suggestions={
            isRouteError
              ? [
                  'This is a backend configuration issue - the puzzle API endpoint is missing',
                  'Try selecting a puzzle from the puzzle list instead',
                  'Contact support if this issue persists',
                ]
              : is404
                ? [
                    'The puzzle ID may be invalid or has been deleted',
                    'Try selecting a different puzzle from the puzzle list',
                    'Check that you have the correct URL',
                  ]
                : [
                    'Check your internet connection',
                    'Try refreshing the page',
                    'Go back to the puzzle list and try again',
                  ]
          }
          showRetry={!isRouteError}
          onRetry={() => window.location.reload()}
        />
      </GamePageContainer>
    );
  }

  if (isLoading || !isConnected || cells.length === 0) {
    return (
      <GamePageContainer>
        {!isEmbedMode && <Nav />}
        <GameSkeleton />
      </GamePageContainer>
    );
  }

  return (
    <GamePageContainer>
      {!isEmbedMode && <Nav />}

      <GameToolbar
        isPencilMode={isPencilMode}
        isAutoCheckMode={isAutoCheckMode}
        isComplete={isComplete}
        clockTime={clock.elapsedTime}
        isClockRunning={clock.isRunning}
        onTogglePencil={togglePencilMode}
        onToggleAutoCheck={toggleAutoCheckMode}
        onStartClock={startClock}
        onPauseClock={pauseClock}
        onResetClock={resetClock}
        onCheck={handleCheck}
        onReveal={handleReveal}
        onReset={handleReset}
      />

      <GameContent>
        <LeftSection>
          <ActiveHint currentClue={currentClue} />
          <GridAndCluesContainer>
            <GridSection>
              <ComponentErrorBoundary componentName="Grid">
                <Grid
                  cells={cells}
                  selectedCell={selectedCell}
                  selectedDirection={selectedDirection}
                  currentUser={currentUser}
                  users={users}
                  cursors={cursors}
                  onCellClick={handleCellSelect}
                  onCellChange={handleCellUpdate}
                  onDirectionToggle={toggleDirection}
                />
              </ComponentErrorBoundary>
            </GridSection>

            <ClueSection>
              <ComponentErrorBoundary componentName="CluePanel">
                <CluePanel
                  acrossClues={safeClues.across}
                  downClues={safeClues.down}
                  currentClue={currentClue}
                  completedClues={completedClues}
                  selectedDirection={selectedDirection}
                  onClueClick={handleClueClick}
                />
              </ComponentErrorBoundary>
            </ClueSection>
          </GridAndCluesContainer>
        </LeftSection>

        <ChatSection>
          <ComponentErrorBoundary componentName="ChatPanel">
            <ChatPanel
              gameId={gameId || null}
              userId={currentUser?.id || 'guest'}
              userName={savedUserName}
              userColor={currentUser?.color || '#1976d2'}
              isLoading={isLoading}
            />
          </ComponentErrorBoundary>
        </ChatSection>
      </GameContent>
    </GamePageContainer>
  );
};

export default Game;

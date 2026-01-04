/**
 * PlayerList Component - List of active players
 * Implements REQ-2.1: User Presence
 *
 * Features:
 * - Display all active players
 * - Show player count
 * - Compact and expanded views
 */

import {
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
  Box,
  Divider,
  styled,
} from '@mui/material';
import { People as PeopleIcon } from '@mui/icons-material';
import { PlayerAvatar } from './PlayerAvatar';
import type { User } from '@types/index';

interface PlayerListProps {
  users: User[];
  currentUserId?: string;
  compact?: boolean;
}

const PlayerListContainer = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  overflow: 'hidden',
}));

const PlayerListHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.default,
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const StyledList = styled(List)(({ theme }) => ({
  padding: 0,
  maxHeight: 300,
  overflow: 'auto',
  '&::-webkit-scrollbar': {
    width: '8px',
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: theme.palette.background.default,
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: theme.palette.divider,
    borderRadius: '4px',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
}));

const CompactPlayerList = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
  flexWrap: 'wrap',
  alignItems: 'center',
}));

/**
 * PlayerList component
 */
export const PlayerList = ({ users, currentUserId, compact = false }: PlayerListProps) => {
  const activeUsers = users.filter((u) => u.isActive);
  const sortedUsers = [...users].sort((a, b) => {
    // Current user first
    if (a.id === currentUserId) return -1;
    if (b.id === currentUserId) return 1;
    // Then active users
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    // Then alphabetically
    return a.displayName.localeCompare(b.displayName);
  });

  if (compact) {
    return (
      <PlayerListContainer elevation={2}>
        <CompactPlayerList>
          <PeopleIcon color="primary" />
          <Typography variant="body2" fontWeight={600}>
            {activeUsers.length} {activeUsers.length === 1 ? 'player' : 'players'}
          </Typography>
          <Divider orientation="vertical" flexItem />
          {activeUsers.map((user) => (
            <PlayerAvatar key={user.id} user={user} size="small" />
          ))}
        </CompactPlayerList>
      </PlayerListContainer>
    );
  }

  return (
    <PlayerListContainer elevation={2}>
      <PlayerListHeader>
        <PeopleIcon color="primary" />
        <Typography variant="h6" fontWeight={600}>
          Players
        </Typography>
        <Typography variant="caption" color="text.secondary">
          ({activeUsers.length}/{users.length})
        </Typography>
      </PlayerListHeader>

      <StyledList>
        {sortedUsers.map((user, index) => (
          <div key={user.id}>
            <ListItem>
              <ListItemAvatar>
                <PlayerAvatar user={user} />
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" fontWeight={600}>
                      {user.displayName}
                    </Typography>
                    {user.id === currentUserId && (
                      <Typography
                        variant="caption"
                        sx={{
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                        }}
                      >
                        You
                      </Typography>
                    )}
                  </Box>
                }
                secondary={user.isActive ? 'Active' : 'Inactive'}
                secondaryTypographyProps={{
                  color: user.isActive ? 'success.main' : 'text.secondary',
                  variant: 'caption',
                }}
              />
            </ListItem>
            {index < sortedUsers.length - 1 && <Divider variant="inset" component="li" />}
          </div>
        ))}
      </StyledList>

      {users.length === 0 && (
        <Box p={3} textAlign="center">
          <Typography variant="body2" color="text.secondary">
            No players yet
          </Typography>
        </Box>
      )}
    </PlayerListContainer>
  );
};

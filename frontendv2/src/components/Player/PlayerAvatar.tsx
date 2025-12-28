/**
 * PlayerAvatar Component - Player avatar with status
 * Implements REQ-2.1: User Presence
 *
 * Features:
 * - Color-coded avatar
 * - Active/inactive status badge
 * - Hover tooltip with name
 */

import { memo } from 'react';
import { Avatar, Badge, Tooltip, styled } from '@mui/material';
import { Circle as _CircleIcon } from '@mui/icons-material';
import type { User } from '@types/index';

interface PlayerAvatarProps {
  user: User;
  size?: 'small' | 'medium' | 'large';
  showStatus?: boolean;
}

const StyledBadge = styled(Badge)<{ isActive?: boolean }>(({ theme, isActive }) => ({
  '& .MuiBadge-badge': {
    backgroundColor: isActive ? theme.palette.success.main : theme.palette.grey[400],
    color: isActive ? theme.palette.success.main : theme.palette.grey[400],
    boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
    '&::after': {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      borderRadius: '50%',
      animation: isActive ? 'ripple 1.2s infinite ease-in-out' : 'none',
      border: '1px solid currentColor',
      content: '""',
    },
  },
  '@keyframes ripple': {
    '0%': {
      transform: 'scale(.8)',
      opacity: 1,
    },
    '100%': {
      transform: 'scale(2.4)',
      opacity: 0,
    },
  },
}));

const getSizeInPx = (size: 'small' | 'medium' | 'large'): number => {
  switch (size) {
    case 'small':
      return 32;
    case 'large':
      return 56;
    default:
      return 40;
  }
};

/**
 * PlayerAvatar component
 * Memoized to prevent unnecessary re-renders
 */
export const PlayerAvatar = memo<PlayerAvatarProps>(
  ({ user, size = 'medium', showStatus = true }) => {
    const avatarSize = getSizeInPx(size);
    const fontSize = size === 'large' ? '1.25rem' : size === 'small' ? '0.75rem' : '1rem';

    const avatar = (
      <Avatar
        sx={{
          bgcolor: user.color,
          width: avatarSize,
          height: avatarSize,
          fontSize,
          fontWeight: 700,
          border: `2px solid ${user.color}`,
        }}
      >
        {user.displayName.charAt(0).toUpperCase()}
      </Avatar>
    );

    if (showStatus) {
      return (
        <Tooltip title={`${user.displayName} ${user.isActive ? '(Active)' : '(Inactive)'}`}>
          <StyledBadge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            variant="dot"
            isActive={user.isActive}
          >
            {avatar}
          </StyledBadge>
        </Tooltip>
      );
    }

    return <Tooltip title={user.displayName}>{avatar}</Tooltip>;
  },
  (prevProps, nextProps) => {
    return (
      prevProps.user.id === nextProps.user.id &&
      prevProps.user.color === nextProps.user.color &&
      prevProps.user.isActive === nextProps.user.isActive &&
      prevProps.user.displayName === nextProps.user.displayName
    );
  }
);

PlayerAvatar.displayName = 'PlayerAvatar';

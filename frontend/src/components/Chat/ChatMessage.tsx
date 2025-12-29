/**
 * ChatMessage Component - Individual chat message
 * Implements REQ-2.2: Chat System
 *
 * Features:
 * - User avatar and name
 * - Timestamp
 * - Message content
 * - System messages
 */

import { memo } from 'react';
import {
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Box,
  styled,
} from '@mui/material';

export interface ChatMessageData {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  message: string;
  timestamp: number;
  isSystem?: boolean;
}

interface ChatMessageProps {
  message: ChatMessageData;
}

const MessageContainer = styled(ListItem)<{ isSystem?: boolean }>(({ theme, isSystem }) => ({
  padding: theme.spacing(1, 2),
  backgroundColor: isSystem ? theme.palette.action.hover : 'transparent',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const MessageTime = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  color: theme.palette.text.secondary,
  marginLeft: theme.spacing(1),
}));

/**
 * Format timestamp to time string
 */
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * ChatMessage renders a single chat message
 * Memoized to prevent unnecessary re-renders
 */
export const ChatMessage = memo<ChatMessageProps>(
  ({ message }) => {
    if (message.isSystem) {
      return (
        <MessageContainer isSystem>
          <ListItemText
            primary={
              <Typography variant="body2" color="text.secondary" fontStyle="italic">
                {message.message}
              </Typography>
            }
            secondary={formatTime(message.timestamp)}
          />
        </MessageContainer>
      );
    }

    return (
      <MessageContainer>
        <ListItemAvatar>
          <Avatar
            sx={{
              bgcolor: message.userColor,
              width: 32,
              height: 32,
              fontSize: '0.875rem',
            }}
          >
            {message.userName.charAt(0).toUpperCase()}
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={
            <Box display="flex" alignItems="center">
              <Typography
                variant="subtitle2"
                component="span"
                sx={{ fontWeight: 600, color: message.userColor }}
              >
                {message.userName}
              </Typography>
              <MessageTime variant="caption">{formatTime(message.timestamp)}</MessageTime>
            </Box>
          }
          secondary={
            <Typography variant="body2" component="span" sx={{ wordBreak: 'break-word' }}>
              {message.message}
            </Typography>
          }
        />
      </MessageContainer>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.message.id === nextProps.message.id;
  }
);

ChatMessage.displayName = 'ChatMessage';

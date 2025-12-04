/**
 * ChatPanel Component - Main chat interface
 * Implements REQ-2.2: Chat System
 *
 * Features:
 * - Message list with auto-scroll
 * - Message input
 * - Collapsible panel
 * - Mobile responsive
 */

import { useEffect, useRef, useState } from 'react';
import { Paper, List, Box, Typography, IconButton, Divider, Badge, styled, Tooltip, Snackbar, Alert } from '@mui/material';
import { Close as CloseIcon, Chat as ChatIcon, Share as ShareIcon } from '@mui/icons-material';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useChat } from '@hooks/user/useChat';

interface ChatPanelProps {
  gameId: string | null;
  userId: string;
  userName: string;
  userColor: string;
  isOpen?: boolean;
  onToggle?: () => void;
  isMobile?: boolean;
  isLoading?: boolean;
}

const ChatContainer = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'isMobile',
})<{ isMobile?: boolean }>(({ theme, isMobile }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: isMobile ? '100%' : 500,
  width: isMobile ? '100%' : 350,
  backgroundColor: theme.palette.background.paper,
  overflow: 'hidden',
}));

const ChatHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default,
}));

const MessageList = styled(List)(({ theme }) => ({
  flex: 1,
  overflow: 'auto',
  padding: 0,
  backgroundColor: theme.palette.background.paper,
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

const EmptyState = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(4),
  color: theme.palette.text.secondary,
}));

/**
 * ChatPanel component
 */
export const ChatPanel = ({
  gameId,
  userId,
  userName,
  userColor,
  isOpen = true,
  onToggle,
  isMobile = false,
  isLoading = false,
}: ChatPanelProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const { messages, sendMessage } = useChat({
    gameId,
    userId,
    userName,
    userColor,
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Copy game link to clipboard
  const handleShareClick = async () => {
    if (!gameId) return;
    
    const gameUrl = `${window.location.origin}/game/${gameId}`;
    try {
      await navigator.clipboard.writeText(gameUrl);
      setCopySuccess(true);
    } catch (err) {
      console.error('Failed to copy link:', err);
      // Fallback: select text in a temporary input
      const input = document.createElement('input');
      input.value = gameUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopySuccess(true);
    }
  };

  if (!isOpen) {
    return (
      <IconButton onClick={onToggle} color="primary" aria-label="Open chat">
        <Badge badgeContent={messages.length} color="error">
          <ChatIcon />
        </Badge>
      </IconButton>
    );
  }

  return (
    <ChatContainer elevation={3} isMobile={isMobile}>
      <ChatHeader>
        <Box display="flex" alignItems="center" gap={1}>
          <ChatIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>
            Chat
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ({messages.length})
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          {gameId && !isLoading && (
            <Tooltip title="Copy game link to share">
              <IconButton
                onClick={handleShareClick}
                size="small"
                aria-label="Share game link"
                color="primary"
              >
                <ShareIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {onToggle && (
            <IconButton onClick={onToggle} size="small" aria-label="Close chat">
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </ChatHeader>

      <Divider />

      {messages.length === 0 ? (
        <EmptyState>
          <ChatIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
          <Typography variant="body2" align="center">
            No messages yet
          </Typography>
          <Typography variant="caption" align="center" color="text.secondary">
            Be the first to say something!
          </Typography>
        </EmptyState>
      ) : (
        <MessageList>
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </MessageList>
      )}

      <ChatInput onSendMessage={sendMessage} />
      
      <Snackbar
        open={copySuccess}
        autoHideDuration={3000}
        onClose={() => setCopySuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setCopySuccess(false)} severity="success" sx={{ width: '100%' }}>
          Game link copied to clipboard!
        </Alert>
      </Snackbar>
    </ChatContainer>
  );
};

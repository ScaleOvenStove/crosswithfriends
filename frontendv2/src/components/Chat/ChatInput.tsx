/**
 * ChatInput Component - Message input field
 * Implements REQ-2.2.1: Text message sending
 *
 * Features:
 * - Text input with send button
 * - Enter to send
 * - Character limit
 * - Auto-focus
 */

import { useState, KeyboardEvent } from 'react';
import { Box, TextField, IconButton, styled } from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

const InputContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
  borderTop: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
}));

/**
 * ChatInput component for sending messages
 */
export const ChatInput = ({
  onSendMessage,
  disabled = false,
  placeholder = 'Type a message...',
  maxLength = 500,
}: ChatInputProps) => {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !disabled) {
      onSendMessage(trimmedMessage);
      setMessage('');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <InputContainer>
      <TextField
        fullWidth
        size="small"
        placeholder={placeholder}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={disabled}
        inputProps={{ maxLength }}
        variant="outlined"
        autoComplete="off"
      />
      <IconButton
        color="primary"
        onClick={handleSend}
        disabled={disabled || !message.trim()}
        aria-label="Send message"
      >
        <SendIcon />
      </IconButton>
    </InputContainer>
  );
};

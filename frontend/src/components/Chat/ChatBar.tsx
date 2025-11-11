import React, {useState, useRef, useMemo, useCallback, useImperativeHandle, forwardRef} from 'react';
import EmojiPicker from './EmojiPicker';
import * as emojiLib from '@crosswithfriends/shared/lib/emoji';

const MAX_EMOJIS = 150;

interface ChatBarProps {
  mobile?: boolean;
  onSendMessage: (message: string) => void;
  onUnfocus: () => void;
}

export interface ChatBarRef {
  focus: () => void;
}

const ChatBar = forwardRef<ChatBarRef, ChatBarProps>(({mobile, onSendMessage, onUnfocus}, ref) => {
  const [message, setMessage] = useState('');
  const [escapedEmoji, setEscapedEmoji] = useState<string | null>(null);
  const [enters, setEnters] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    },
  }));

  const emojiPattern = useMemo(() => {
    const words = message.split(' ');
    const lastWord = words[words.length - 1];
    if (lastWord.startsWith(':')) {
      const pattern = lastWord.substring(1).toLowerCase();
      if (pattern.match(/^[a-zA-Z_-]*$/)) {
        if (pattern !== escapedEmoji) {
          return pattern;
        }
      }
    }
    return undefined;
  }, [message, escapedEmoji]);

  const handlePressEnter = useCallback(() => {
    if (message.length > 0) {
      onSendMessage(message);
      setMessage('');
      setEnters((prev) => prev + 1);
    } else {
      onUnfocus();
    }
  }, [message, onSendMessage, onUnfocus]);

  const handleKeyDown = useCallback(
    (ev: React.KeyboardEvent) => {
      if (emojiPickerRef.current) {
        emojiPickerRef.current.handleKeyDown(ev);
        return;
      }

      if (ev.key === 'Enter') {
        ev.stopPropagation();
        ev.preventDefault();
        handlePressEnter();
      } else if (ev.key === 'Escape') {
        onUnfocus();
      }
    },
    [handlePressEnter, onUnfocus]
  );

  const handleChange = useCallback((ev: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(ev.target.value);
  }, []);

  const handleConfirmEmoji = useCallback(
    (emoji: string) => {
      const words = message.split(' ');
      const newMessage = [...words.slice(0, words.length - 1), `:${emoji}:`, ''].join(' ');
      setMessage(newMessage);
    },
    [message]
  );

  const handleEscapeEmoji = useCallback(() => {
    setEscapedEmoji(emojiPattern || null);
    setTimeout(() => {
      setEscapedEmoji(null);
    }, 5000);
  }, [emojiPattern]);

  return (
    <div className="chat--bar">
      {emojiPattern && (
        <div
          style={{
            position: 'absolute',
            bottom: 50,
            left: 0,
            right: 0,
            top: 'auto',
          }}
        >
          <EmojiPicker
            disableKeyListener
            ref={emojiPickerRef}
            pattern={emojiPattern}
            matches={emojiLib.findMatches(emojiPattern).slice(0, MAX_EMOJIS)}
            onConfirm={handleConfirmEmoji}
            onEscape={handleEscapeEmoji}
          />
        </div>
      )}
      <input
        ref={inputRef}
        className={mobile ? 'chat--bar--input--mobile' : 'chat--bar--input'}
        placeholder="[Enter] to chat"
        value={message}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
});

ChatBar.displayName = 'ChatBar';

export default ChatBar;

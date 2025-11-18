import './css/index.css';
import * as emojiLib from '@crosswithfriends/shared/lib/emoji';
import nameGenerator, {isFromNameGenerator} from '@crosswithfriends/shared/lib/nameGenerator';
import {Box, Stack, Snackbar, Alert, IconButton} from '@mui/material';
import _ from 'lodash';
import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {MdClose, MdContentCopy, MdChevronRight, MdChevronLeft} from 'react-icons/md';
import {Link} from 'react-router-dom';

import Linkify from 'react-linkify';

import EditableSpan from '../common/EditableSpan';
import Emoji from '../common/Emoji';
import MobileKeyboard from '../Player/MobileKeyboard';
import {formatMilliseconds} from '../Toolbar/Clock';

import ChatBar, {type ChatBarRef} from './ChatBar';
import ColorPicker from './ColorPicker';

const isEmojis = (str: string) => {
  const res = str.match(/[A-Za-z,.0-9!-]/g);
  return !res;
};

interface ChatMessage {
  text: string;
  senderId: string;
  timestamp: number;
  isOpponent?: boolean;
}

interface ChatProps {
  initialUsername?: string;
  bid?: number;
  id: string;
  users: Record<string, {displayName: string; color?: string; teamId?: string}>;
  onChat: (username: string, id: string, message: string) => void;
  onUpdateDisplayName: (id: string, username: string) => void;
  color?: string;
  onUpdateColor: (id: string, color: string) => void;
  onUnfocus?: () => void;
  onToggleChat: () => void;
  path: string;
  game: {
    info: {title: string; description?: string; author?: string; type?: string};
    clock: {totalTime: number};
    pid: number;
    solved?: boolean;
    clues: {across: string[]; down: string[]};
    fencingUsers?: string[];
    isFencing?: boolean;
  };
  data: {messages?: ChatMessage[]};
  opponentData?: {messages?: ChatMessage[]};
  teams?: Record<string, {color?: string}>;
  mobile?: boolean;
  hideChatBar?: boolean;
  header?: React.ReactNode;
  subheader?: React.ReactNode;
  myColor?: string;
  gid?: string;
  isFencing?: boolean;
  onSelectClue?: (direction: 'across' | 'down', clueNumber: number) => void;
  info?: {title?: string; description?: string; author?: string; type?: string};
  collapsed?: boolean;
  onShareLinkDisappeared?: () => void;
}

export type ChatRef = {
  focus: () => void;
};

const Chat = forwardRef<ChatRef, ChatProps>((props, ref) => {
  const [username, setUsername] = useState<string>('');
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [showShareMessage, setShowShareMessage] = useState<boolean>(true);
  const chatBarRef = useRef<ChatBarRef | null>(null);
  const usernameInputRef = useRef<HTMLInputElement | null>(null);
  const collapsedRef = useRef<boolean>(props.collapsed || false);
  const prevShowShareMessageRef = useRef<boolean>(true);

  const usernameKey = useMemo(() => {
    return `username_${window.location.href}`;
  }, []);

  const serverUrl = useMemo(() => {
    return `${window.location.protocol}//${window.location.host}`;
  }, []);

  const url = useMemo(() => {
    return `${serverUrl}/beta${props.path}`;
  }, [serverUrl, props.path]);

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (chatBarRef.current) {
        chatBarRef.current.focus();
      }
    },
  }));

  const isEditingRef = useRef<boolean>(false);

  const {
    id,
    onUpdateDisplayName,
    onUnfocus,
    onToggleChat,
    onSelectClue,
    header,
    info,
    bid,
    mobile,
    collapsed,
    game,
    users,
    initialUsername,
    onChat,
    color,
    onUpdateColor,
  } = props;
  const handleUpdateDisplayName = useCallback(
    (newUsername: string) => {
      let finalUsername = newUsername;
      // Only auto-generate name if user is not actively editing and field is empty
      if (!isEditingRef.current && !finalUsername) {
        finalUsername = nameGenerator();
      }
      if (onUpdateDisplayName && id) {
        onUpdateDisplayName(id, finalUsername);
      }
      setUsername(finalUsername);
      localStorage.setItem(usernameKey, finalUsername);
      // Check if localStorage has username_default, if not set it to the last
      // updated name
      if (
        localStorage.getItem('username_default') !== localStorage.getItem(usernameKey) &&
        !isFromNameGenerator(finalUsername)
      ) {
        localStorage.setItem('username_default', finalUsername);
      }
    },
    [id, onUpdateDisplayName, usernameKey]
  );

  useEffect(() => {
    let currentInitialUsername = initialUsername;
    const battleName = localStorage.getItem(`battle_${bid}`);
    // HACK
    if (battleName && !currentInitialUsername) {
      currentInitialUsername = battleName;
      setUsername(battleName);
    } else {
      setUsername(currentInitialUsername || '');
    }
    // Only call updateDisplayName if we have a valid username and the callback is available
    if (currentInitialUsername && onUpdateDisplayName) {
      handleUpdateDisplayName(currentInitialUsername);
    }
  }, [initialUsername, bid, onUpdateDisplayName, handleUpdateDisplayName]);

  const handleSendMessage = useCallback(
    (message: string) => {
      if (!id || !users[id]) {
        console.warn('Cannot send message: invalid user id or user not found');
        return;
      }
      const displayName = users[id].displayName || username || 'Unknown';
      if (onChat) {
        onChat(displayName, id, message);
      }
      localStorage.setItem(usernameKey, displayName);
      // Dismiss share message when first message is sent
      setShowShareMessage(false);
    },
    [id, users, username, usernameKey, onChat]
  );

  const handleUpdateColor = useCallback(
    (newColor: string) => {
      const finalColor = newColor || color;
      onUpdateColor(id, finalColor);
    },
    [id, color, onUpdateColor]
  );

  const handleUnfocus = useCallback(() => {
    if (onUnfocus) {
      onUnfocus();
    }
  }, [onUnfocus]);

  const handleBlur = useCallback(() => {
    const finalUsername = username || nameGenerator();
    setUsername(finalUsername);
  }, [username]);

  const handleToggleChat = useCallback(() => {
    onToggleChat();
  }, [onToggleChat]);

  const handleCopyClick = useCallback(() => {
    navigator.clipboard.writeText(url);
    setSnackbarMessage('Link copied to clipboard!');
    setSnackbarOpen(true);
  }, [url]);

  const handleSnackbarClose = useCallback(() => {
    setSnackbarOpen(false);
  }, []);

  const handleShareScoreClick = useCallback(() => {
    const text = `${Object.keys(props.users).length > 1 ? 'We' : 'I'} solved ${
      props.game.info.title
    } in ${formatMilliseconds(props.game.clock.totalTime)}!\n\n${serverUrl}/beta/play/${props.game.pid}`;
    navigator.clipboard.writeText(text);
    setSnackbarMessage('Score copied to clipboard!');
    setSnackbarOpen(true);
  }, [props.users, props.game, serverUrl]);

  const handleShareScoreKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleShareScoreClick();
      }
    },
    [handleShareScoreClick]
  );

  const handleDismissShareMessage = useCallback(() => {
    setShowShareMessage(false);
  }, []);

  const mergeMessages = useCallback(
    (data: {messages?: ChatMessage[]}, opponentData?: {messages?: ChatMessage[]}) => {
      if (!opponentData) {
        return data.messages || [];
      }

      const getMessages = (msgData: {messages?: ChatMessage[]}, isOpponent: boolean) =>
        _.map(msgData.messages, (message) => ({...message, isOpponent}));

      const messages = _.concat(getMessages(data, false), getMessages(opponentData, true));

      return _.sortBy(messages, 'timestamp');
    },
    []
  );

  const getMessageColor = useCallback(
    (senderId: string, isOpponent?: boolean) => {
      const {users: allUsers, teams} = props;
      if (isOpponent === undefined) {
        if (allUsers[senderId]?.teamId) {
          return teams?.[allUsers[senderId].teamId]?.color;
        }
        return allUsers[senderId]?.color;
      }
      return isOpponent ? 'rgb(220, 107, 103)' : 'rgb(47, 137, 141)';
    },
    [props]
  );

  const renderGameButton = useCallback(() => {
    return (
      <button
        onClick={handleToggleChat}
        className="toolbar--game"
        aria-label="Close chat"
        type="button"
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MdClose />
      </button>
    );
  }, [handleToggleChat]);

  const renderToolbar = useCallback(() => {
    if (!props.mobile) return null;
    return (
      <Box className="toolbar--mobile" sx={{display: 'flex', alignItems: 'center'}}>
        <Link to="/">Cross with Friends</Link> {renderGameButton()}
      </Box>
    );
  }, [props.mobile, renderGameButton]);

  const renderFencingOptions = useCallback(() => {
    const fencingUrl = `/fencing/${props.gid}`;
    const normalUrl = `/beta/game/${props.gid}`;
    const isFencing = props.isFencing;
    const fencingPlayers = props.game.fencingUsers?.length ?? 0;
    return (
      <div>
        {!isFencing && !!fencingPlayers && <a href={fencingUrl}>Join Fencing ({fencingPlayers} joined)</a>}
        {!isFencing && !fencingPlayers && (
          <a href={fencingUrl} style={{opacity: 0.1, textDecoration: 'none'}}>
            X
          </a>
        )}
        {isFencing && <a href={normalUrl}>Leave Fencing</a>}
      </div>
    );
  }, [props.gid, props.isFencing, props.game.fencingUsers]);

  const renderChatHeader = useCallback(() => {
    if (header) return header;
    const gameInfo = info || game.info;
    const {title, description, author, type} = gameInfo;
    const desc = description?.startsWith('; ') ? description.substring(2) : description;

    return (
      <div className="chat--header">
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          <div style={{flex: 1}}>
            <div className="chat--header--title">{title}</div>
            <div className="chat--header--subtitle">{type && `${type} | By ${author}`}</div>
            {desc && (
              <div className="chat--header--description">
                <strong>Note: </strong>
                <Linkify>{desc}</Linkify>
              </div>
            )}

            {bid && (
              <div className="chat--header--subtitle">
                Battle
                {bid}
              </div>
            )}
            {renderFencingOptions()}
          </div>
          {!mobile && (
            <IconButton
              size="small"
              onClick={handleToggleChat}
              sx={{
                flexShrink: 0,
                marginLeft: 1,
                color: '#666',
                '&:hover': {backgroundColor: 'rgba(0, 0, 0, 0.04)'},
              }}
              title={collapsed ? 'Expand chat' : 'Collapse chat'}
            >
              {collapsed ? <MdChevronLeft /> : <MdChevronRight />}
            </IconButton>
          )}
        </div>
      </div>
    );
  }, [header, info, game.info, bid, mobile, collapsed, renderFencingOptions, handleToggleChat]);

  const handleUsernameChange = useCallback(
    (newValue: string) => {
      isEditingRef.current = true;
      handleUpdateDisplayName(newValue);
      // Reset editing flag after a delay
      setTimeout(() => {
        isEditingRef.current = false;
      }, 1000);
    },
    [handleUpdateDisplayName]
  );

  const handleUsernameBlur = useCallback(() => {
    isEditingRef.current = false;
    handleBlur();
  }, [handleBlur]);

  const handleUsernameUnfocus = useCallback(() => {
    isEditingRef.current = false;
    if (chatBarRef.current) {
      chatBarRef.current.focus();
    }
  }, []);

  const renderUsernameInput = useCallback(() => {
    return props.hideChatBar ? null : (
      <div className="chat--username">
        {'You are '}
        <ColorPicker color={props.myColor} onUpdateColor={handleUpdateColor} />
        <EditableSpan
          ref={usernameInputRef}
          className="chat--username--input"
          value={username}
          onChange={handleUsernameChange}
          onBlur={handleUsernameBlur}
          onUnfocus={handleUsernameUnfocus}
          style={{color: props.myColor}}
        />
      </div>
    );
  }, [
    props.hideChatBar,
    props.myColor,
    username,
    handleUpdateColor,
    handleUsernameChange,
    handleUsernameBlur,
    handleUsernameUnfocus,
  ]);

  const renderUserPresent = useCallback((userId: string, displayName: string, userColor?: string) => {
    const style = userColor ? {color: userColor} : undefined;
    return (
      <span key={userId} style={style}>
        <span className="dot">{'\u25CF'}</span>
        {displayName}{' '}
      </span>
    );
  }, []);

  const renderUsersPresent = useCallback(
    (usersList: Record<string, {displayName: string; color?: string}>) => {
      return props.hideChatBar ? null : (
        <div className="chat--users--present">
          {Object.keys(usersList).map((userId) =>
            renderUserPresent(userId, usersList[userId].displayName, usersList[userId].color)
          )}
        </div>
      );
    },
    [props.hideChatBar, renderUserPresent]
  );

  const renderChatBar = useCallback(() => {
    return props.hideChatBar ? null : (
      <ChatBar
        ref={chatBarRef}
        mobile={props.mobile}
        placeHolder="[Enter] to chat"
        onSendMessage={handleSendMessage}
        onUnfocus={handleUnfocus}
      />
    );
  }, [props.hideChatBar, props.mobile, handleSendMessage, handleUnfocus]);

  const renderMessageTimestamp = useCallback((timestamp: number) => {
    return (
      <span className="chat--message--timestamp">
        {new Date(timestamp).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}
      </span>
    );
  }, []);

  const renderMessageSender = useCallback((name: string, messageColor?: string) => {
    // Always apply color if provided, otherwise use default text color
    const style = messageColor ? {color: messageColor} : {color: '#333'};
    return (
      <span className="chat--message--sender" style={style}>
        {name}:
      </span>
    );
  }, []);

  const renderClueRef = useCallback(
    (clueref: string[]) => {
      const defaultPattern = clueref[0];

      let clueNumber: number;
      try {
        clueNumber = parseInt(clueref[1]);
      } catch {
        // not in a valid format, so just return the pattern
        return defaultPattern;
      }

      const directionFirstChar = clueref[2][0];
      const isAcross = directionFirstChar === 'a' || directionFirstChar === 'A';
      const clues = isAcross ? game.clues['across'] : game.clues['down'];

      if (clueNumber >= 0 && clueNumber < clues.length && clues[clueNumber] !== undefined) {
        const handleClueRefClick = () => {
          const directionStr = isAcross ? 'across' : 'down';
          if (onSelectClue) {
            onSelectClue(directionStr, clueNumber);
          }
        };

        return (
          <button onClick={handleClueRefClick} type="button">
            {defaultPattern}
          </button>
        );
      } else {
        return defaultPattern;
      }
    },
    [game.clues, onSelectClue]
  );

  const renderMessageText = useCallback(
    (text: string) => {
      const words = text.split(' ');
      const tokens: Array<{type: string; data: string | string[]}> = [];
      words.forEach((word) => {
        if (word.length === 0) return;
        if (word.startsWith(':') && word.endsWith(':')) {
          const emoji = word.substring(1, word.length - 1);
          const emojiData = emojiLib.get(emoji);
          if (emojiData) {
            tokens.push({
              type: 'emoji',
              data: emoji,
            });
            return;
          }
        }

        if (word.startsWith('@')) {
          const pattern = word;
          const clueref = pattern.match(/^@(\d+)-?\s?(a(?:cross)?|d(?:own)?)$/i);
          if (clueref) {
            tokens.push({
              type: 'clueref',
              data: clueref,
            });
            return;
          }
        }

        if (tokens.length && tokens[tokens.length - 1].type === 'text') {
          (tokens[tokens.length - 1].data as string) += ` ${word}`;
        } else {
          tokens.push({
            type: 'text',
            data: word,
          });
        }
      });

      const bigEmoji = tokens.length <= 3 && _.every(tokens, (token) => token.type === 'emoji');
      return (
        <span className="chat--message--text">
          {tokens.map((token, i) => {
            const tokenKey =
              token.type === 'clueref'
                ? `clueref-${(token.data as string[]).join('-')}`
                : `${token.type}-${i}-${token.data}`;
            let tokenContent: React.ReactNode;
            if (token.type === 'emoji') {
              tokenContent = <Emoji emoji={token.data as string} big={bigEmoji} />;
            } else if (token.type === 'clueref') {
              tokenContent = renderClueRef(token.data as string[]);
            } else {
              tokenContent = token.data;
            }
            return (
              <React.Fragment key={tokenKey}>
                {tokenContent}
                {token.type !== 'emoji' && ' '}
              </React.Fragment>
            );
          })}
        </span>
      );
    },
    [renderClueRef]
  );

  const getAvatarInitials = useCallback((name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }, []);

  const renderMessage = useCallback(
    (message: {text: string; senderId: string; isOpponent?: boolean; timestamp: number}) => {
      const {text, senderId, isOpponent, timestamp} = message;
      const big = text.length <= 10 && isEmojis(text);
      const messageColor = getMessageColor(senderId, isOpponent);
      const allUsers = props.users;
      const displayName = allUsers[senderId]?.displayName ?? 'Unknown';
      const avatarInitials = getAvatarInitials(displayName);

      return (
        <div
          className={`chat--message${big ? ' big' : ''} chat--user-message`}
          style={{
            display: 'flex',
            gap: '8px',
            padding: '8px 12px',
            marginBottom: '4px',
            borderRadius: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.02)',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: messageColor || '#6aa9f4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold',
              flexShrink: 0,
            }}
            title={displayName}
          >
            {avatarInitials}
          </div>
          <div style={{flex: 1, minWidth: 0}}>
            <div
              className="chat--message--content"
              style={{display: 'flex', gap: '6px', alignItems: 'baseline'}}
            >
              {renderMessageSender(displayName, messageColor)}
              {renderMessageText(message.text)}
            </div>
            <div
              className="chat--message--timestamp"
              style={{fontSize: '0.75rem', color: '#666', marginTop: '2px'}}
            >
              {renderMessageTimestamp(timestamp)}
            </div>
          </div>
        </div>
      );
    },
    [
      props.users,
      getMessageColor,
      renderMessageSender,
      renderMessageText,
      renderMessageTimestamp,
      getAvatarInitials,
    ]
  );

  const renderMobileKeyboard = useCallback(() => {
    if (!props.mobile) {
      return null;
    }

    return (
      <Box sx={{flexShrink: 0}}>
        <MobileKeyboard layout="uppercase" />
      </Box>
    );
  }, [props.mobile]);

  const renderChatSubheader = useCallback(() => {
    if (props.subheader) return props.subheader;
    const allUsers = props.users;

    return (
      <>
        {renderUsernameInput()}
        {renderUsersPresent(allUsers)}
      </>
    );
  }, [props.subheader, props.users, renderUsernameInput, renderUsersPresent]);

  const messages = useMemo(() => {
    return mergeMessages(props.data, props.opponentData);
  }, [props.data, props.opponentData, mergeMessages]);

  const handleMessagesRef = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  // Auto-dismiss share message after 30 seconds
  useEffect(() => {
    if (showShareMessage) {
      const timer = setTimeout(() => {
        setShowShareMessage(false);
      }, 30000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [showShareMessage]);

  // Dismiss share message when first message is sent
  useEffect(() => {
    if (messages.length > 0 && showShareMessage) {
      setShowShareMessage(false);
    }
  }, [messages.length, showShareMessage]);

  // Auto-collapse sidebar when share link disappears
  useEffect(() => {
    // Only collapse if share message transitioned from true to false
    if (prevShowShareMessageRef.current && !showShareMessage && !collapsedRef.current) {
      // Share message just disappeared, collapse the sidebar
      props.onToggleChat();
      // Notify parent that share link disappeared (to scroll game window)
      if (props.onShareLinkDisappeared) {
        props.onShareLinkDisappeared();
      }
    }
    prevShowShareMessageRef.current = showShareMessage;
  }, [showShareMessage, props]);

  // Update collapsed ref when collapsed state changes
  useEffect(() => {
    collapsedRef.current = props.collapsed || false;
  }, [props.collapsed]);

  return (
    <Stack direction="column" sx={{flex: 1}}>
      {renderToolbar()}
      <div className="chat">
        {renderChatHeader()}
        {renderChatSubheader()}
        <div ref={handleMessagesRef} className="chat--messages">
          {showShareMessage && (
            <div
              className="chat--message chat--system-message"
              style={{
                padding: '12px',
                marginBottom: '8px',
                borderRadius: '8px',
                backgroundColor: 'rgba(106, 169, 244, 0.1)',
                border: '1px solid rgba(106, 169, 244, 0.3)',
              }}
            >
              <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                <i style={{flex: 1}}>
                  Game created! Share the link to play with your friends:
                  <wbr />
                </i>
                <b id="pathText" style={{marginLeft: '5px', flex: 1, wordBreak: 'break-all'}}>
                  {url}
                </b>
                <IconButton
                  size="small"
                  onClick={handleCopyClick}
                  title="Copy to Clipboard"
                  sx={{flexShrink: 0}}
                >
                  <MdContentCopy fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={handleDismissShareMessage}
                  title="Dismiss"
                  sx={{flexShrink: 0}}
                >
                  <MdClose fontSize="small" />
                </IconButton>
              </div>
            </div>
          )}
          {props.game.solved && (
            <div
              className="chat--message chat--system-message"
              style={{
                padding: '12px',
                marginBottom: '8px',
                borderRadius: '8px',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                border: '1px solid rgba(76, 175, 80, 0.3)',
              }}
            >
              <button
                onClick={handleShareScoreClick}
                type="button"
                aria-label="Share your score"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  width: '100%',
                  textAlign: 'left',
                  font: 'inherit',
                  color: 'inherit',
                }}
                onKeyDown={handleShareScoreKeyDown}
              >
                <i id="shareText" style={{flex: 1}}>
                  Congratulations! You solved the puzzle in{' '}
                  <b>{formatMilliseconds(props.game.clock.totalTime)}</b>. Click here to share your score.
                  <wbr />
                </i>
                <IconButton size="small" title="Copy to Clipboard" sx={{flexShrink: 0}}>
                  <MdContentCopy fontSize="small" />
                </IconButton>
              </button>
            </div>
          )}
          {messages.map((message) => (
            <div key={`${message.senderId}-${message.timestamp}`}>{renderMessage(message)}</div>
          ))}
        </div>
        {renderChatBar()}
      </div>
      {renderMobileKeyboard()}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
      >
        <Alert onClose={handleSnackbarClose} severity="success" sx={{width: '100%'}}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Stack>
  );
});

Chat.displayName = 'Chat';

// Memoize Chat component to prevent unnecessary re-renders
export default React.memo(Chat);

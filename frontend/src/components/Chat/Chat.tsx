import './css/index.css';
import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import _ from 'lodash';
import {Box, Stack} from '@mui/material';
import Linkify from 'react-linkify';
import {Link} from 'react-router-dom';
import {MdClose} from 'react-icons/md';
import Emoji from '../common/Emoji';
import * as emojiLib from '@crosswithfriends/shared/lib/emoji';
import nameGenerator, {isFromNameGenerator} from '@crosswithfriends/shared/lib/nameGenerator';
import ChatBar from './ChatBar';
import EditableSpan from '../common/EditableSpan';
import MobileKeyboard from '../Player/MobileKeyboard';
import ColorPicker from './ColorPicker.tsx';
import {formatMilliseconds} from '../Toolbar/Clock';

const isEmojis = (str: string) => {
  const res = str.match(/[A-Za-z,.0-9!-]/g);
  return !res;
};

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
    fencingUsers?: any[];
    isFencing?: boolean;
  };
  data: {messages?: any[]};
  opponentData?: {messages?: any[]};
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
}

export type ChatRef = {
  focus: () => void;
};

const Chat = forwardRef<ChatRef, ChatProps>((props, ref) => {
  const [username, setUsername] = useState<string>('');
  const chatBarRef = useRef<any>(null);
  const usernameInputRef = useRef<any>(null);

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

  const handleUpdateDisplayName = useCallback(
    (newUsername: string) => {
      let finalUsername = newUsername;
      if (!usernameInputRef.current?.focused) {
        finalUsername = finalUsername || nameGenerator();
      }
      const {id, onUpdateDisplayName} = props;
      onUpdateDisplayName(id, finalUsername);
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
    [props.id, props.onUpdateDisplayName, usernameKey]
  );

  useEffect(() => {
    let initialUsername = props.initialUsername;
    const battleName = localStorage.getItem(`battle_${props.bid}`);
    // HACK
    if (battleName && !initialUsername) {
      initialUsername = battleName;
      setUsername(battleName);
    } else {
      setUsername(initialUsername || '');
    }
    // Only call updateDisplayName if we have a valid username and the callback is available
    if (initialUsername && props.onUpdateDisplayName) {
      handleUpdateDisplayName(initialUsername);
    }
  }, [props.initialUsername, props.bid, props.onUpdateDisplayName, handleUpdateDisplayName]);

  const handleSendMessage = useCallback(
    (message: string) => {
      const {id} = props;
      const displayName = props.users[id].displayName;
      props.onChat(displayName, id, message);
      localStorage.setItem(usernameKey, displayName);
    },
    [props, usernameKey]
  );

  const handleUpdateColor = useCallback(
    (color: string) => {
      const finalColor = color || props.color;
      const {id} = props;
      props.onUpdateColor(id, finalColor);
    },
    [props]
  );

  const handleUnfocus = useCallback(() => {
    if (props.onUnfocus) {
      props.onUnfocus();
    }
  }, [props.onUnfocus]);

  const handleBlur = useCallback(() => {
    const finalUsername = username || nameGenerator();
    setUsername(finalUsername);
  }, [username]);

  const handleToggleChat = useCallback(() => {
    props.onToggleChat();
  }, [props.onToggleChat]);

  const handleCopyClick = useCallback(() => {
    navigator.clipboard.writeText(url);
    const link = document.getElementById('pathText');
    if (link) {
      link.classList.remove('flashBlue');
      void link.offsetWidth;
      link.classList.add('flashBlue');
    }
  }, [url]);

  const handleShareScoreClick = useCallback(() => {
    const text = `${Object.keys(props.users).length > 1 ? 'We' : 'I'} solved ${
      props.game.info.title
    } in ${formatMilliseconds(props.game.clock.totalTime)}!\n\n${serverUrl}/beta/play/${props.game.pid}`;
    navigator.clipboard.writeText(text);
    const link = document.getElementById('shareText');
    if (link) {
      link.classList.remove('flashBlue');
      void link.offsetWidth;
      link.classList.add('flashBlue');
    }
  }, [props.users, props.game, serverUrl]);

  const mergeMessages = useCallback((data: {messages?: any[]}, opponentData?: {messages?: any[]}) => {
    if (!opponentData) {
      return data.messages || [];
    }

    const getMessages = (msgData: {messages?: any[]}, isOpponent: boolean) =>
      _.map(msgData.messages, (message) => ({...message, isOpponent}));

    const messages = _.concat(getMessages(data, false), getMessages(opponentData, true));

    return _.sortBy(messages, 'timestamp');
  }, []);

  const getMessageColor = useCallback(
    (senderId: string, isOpponent?: boolean) => {
      const {users, teams} = props;
      if (isOpponent === undefined) {
        if (users[senderId]?.teamId) {
          return teams?.[users[senderId].teamId]?.color;
        }
        return users[senderId]?.color;
      }
      return isOpponent ? 'rgb(220, 107, 103)' : 'rgb(47, 137, 141)';
    },
    [props]
  );

  const renderGameButton = useCallback(() => {
    return <MdClose onClick={handleToggleChat} className="toolbar--game" />;
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
    if (props.header) return props.header;
    const {info = {}, bid} = props;
    const gameInfo = info || props.game.info;
    const {title, description, author, type} = gameInfo;
    const desc = description?.startsWith('; ') ? description.substring(2) : description;

    return (
      <div className="chat--header">
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
    );
  }, [props.header, props.info, props.game.info, props.bid, renderFencingOptions]);

  const renderUsernameInput = useCallback(() => {
    return props.hideChatBar ? null : (
      <div className="chat--username">
        {'You are '}
        <ColorPicker color={props.myColor} onUpdateColor={handleUpdateColor} />
        <EditableSpan
          ref={usernameInputRef}
          className="chat--username--input"
          value={username}
          onChange={handleUpdateDisplayName}
          onBlur={handleBlur}
          onUnfocus={() => {
            if (chatBarRef.current) {
              chatBarRef.current.focus();
            }
          }}
          style={{color: props.myColor}}
        />
      </div>
    );
  }, [props.hideChatBar, props.myColor, username, handleUpdateColor, handleUpdateDisplayName, handleBlur]);

  const renderUserPresent = useCallback((id: string, displayName: string, color?: string) => {
    const style = color ? {color} : undefined;
    return (
      <span key={id} style={style}>
        <span className="dot">{'\u25CF'}</span>
        {displayName}{' '}
      </span>
    );
  }, []);

  const renderUsersPresent = useCallback(
    (users: Record<string, {displayName: string; color?: string}>) => {
      return props.hideChatBar ? null : (
        <div className="chat--users--present">
          {Object.keys(users).map((id) => renderUserPresent(id, users[id].displayName, users[id].color))}
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

  const renderMessageSender = useCallback((name: string, color?: string) => {
    const style = color ? {color} : undefined;
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
      } catch (e) {
        // not in a valid format, so just return the pattern
        return defaultPattern;
      }

      const directionFirstChar = clueref[2][0];
      const isAcross = directionFirstChar === 'a' || directionFirstChar === 'A';
      const clues = isAcross ? props.game.clues['across'] : props.game.clues['down'];

      if (clueNumber >= 0 && clueNumber < clues.length && clues[clueNumber] !== undefined) {
        const handleClick = () => {
          const directionStr = isAcross ? 'across' : 'down';
          if (props.onSelectClue) {
            props.onSelectClue(directionStr, clueNumber);
          }
        };

        return <button onClick={handleClick}> {defaultPattern} </button>;
      } else {
        return defaultPattern;
      }
    },
    [props.game.clues, props.onSelectClue]
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
          {tokens.map((token, i) => (
            <React.Fragment key={i}>
              {token.type === 'emoji' ? (
                <Emoji emoji={token.data as string} big={bigEmoji} />
              ) : token.type === 'clueref' ? (
                renderClueRef(token.data as string[])
              ) : (
                token.data
              )}
              {token.type !== 'emoji' && ' '}
            </React.Fragment>
          ))}
        </span>
      );
    },
    [renderClueRef]
  );

  const renderMessage = useCallback(
    (message: {text: string; senderId: string; isOpponent?: boolean; timestamp: number}) => {
      const {text, senderId: id, isOpponent, timestamp} = message;
      const big = text.length <= 10 && isEmojis(text);
      const color = getMessageColor(id, isOpponent);
      const users = props.users;

      return (
        <div className={`chat--message${big ? ' big' : ''}`}>
          <div className="chat--message--content">
            {renderMessageSender(users[id]?.displayName ?? 'Unknown', color)}
            {renderMessageText(message.text)}
          </div>
          <div className="chat--message--timestamp">{renderMessageTimestamp(timestamp)}</div>
        </div>
      );
    },
    [props.users, getMessageColor, renderMessageSender, renderMessageText, renderMessageTimestamp]
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
    const users = props.users;

    return (
      <>
        {renderUsernameInput()}
        {renderUsersPresent(users)}
      </>
    );
  }, [props.subheader, props.users, renderUsernameInput, renderUsersPresent]);

  const messages = useMemo(() => {
    return mergeMessages(props.data, props.opponentData);
  }, [props.data, props.opponentData, mergeMessages]);

  return (
    <Stack direction="column" sx={{flex: 1}}>
      {renderToolbar()}
      <div className="chat">
        {renderChatHeader()}
        {renderChatSubheader()}
        <div
          ref={(el) => {
            if (el) {
              el.scrollTop = el.scrollHeight;
            }
          }}
          className="chat--messages"
        >
          <div className="chat--message chat--system-message">
            <div>
              <i>
                Game created! Share the link to play with your friends:
                <wbr />
              </i>
              <b id="pathText" style={{marginLeft: '5px'}}>
                {url}
              </b>

              <i className="fa fa-clone copyButton" title="Copy to Clipboard" onClick={handleCopyClick} />
            </div>
          </div>
          {props.game.solved && (
            <div className="chat--message chat--system-message">
              <div className="copyText" onClick={handleShareScoreClick}>
                <i id="shareText">
                  Congratulations! You solved the puzzle in{' '}
                  <b>{formatMilliseconds(props.game.clock.totalTime)}</b>. Click here to share your score.
                  <wbr />
                </i>

                <i className="fa fa-clone copyButton" title="Copy to Clipboard" />
              </div>
            </div>
          )}
          {messages.map((message, i) => (
            <div key={i}>{renderMessage(message)}</div>
          ))}
        </div>
        {renderChatBar()}
      </div>
      {renderMobileKeyboard()}
    </Stack>
  );
});

Chat.displayName = 'Chat';

// Memoize Chat component to prevent unnecessary re-renders
export default React.memo(Chat);

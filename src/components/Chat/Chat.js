import './css/index.css';
import React, {Component} from 'react';
import _ from 'lodash';
import Linkify from 'linkify-react';
import {Link} from 'react-router';
import {MdClose, MdErrorOutline, MdHelpOutline, MdLock} from 'react-icons/md';
import {FaClone, FaCrown} from 'react-icons/fa6';
import * as Sentry from '@sentry/react';
import Emoji from '../common/Emoji';
import * as emojiLib from '../../lib/emoji';
import nameGenerator, {isFromNameGenerator} from '../../lib/nameGenerator';
import ChatBar from './ChatBar';
import EditableSpan from '../common/EditableSpan';
import ColorPicker from './ColorPicker.tsx';
import {formatMilliseconds} from '../Toolbar/Clock';
import RatingWidget from '../Game/RatingWidget';
import PuzzleStatsLine from '../Game/PuzzleStatsLine';
import OwnerControls from './OwnerControls';
import ConfirmDialog from '../common/ConfirmDialog';
import InfoDialog from '../common/InfoDialog';
import AuthContext from '../../lib/AuthContext';
import {kickPlayer, unkickPlayer} from '../../api/create_game';

const isEmojis = (str) => {
  const res = str.match(/[A-Za-z,.0-9!-]/g);
  return !res;
};

export default class Chat extends Component {
  static contextType = AuthContext;

  constructor() {
    super();
    // We'll set the username state when we mount the component.
    this.state = {
      username: '',
      kickTarget: null,
      unkickTarget: null,
      showLockInfo: false,
    };
    this.chatBar = React.createRef();
    this.usernameInput = React.createRef();
  }

  get isOwner() {
    // Prefer the unified flag computed by pages/Game.js — it covers the
    // cross-device case (signed-in user whose local dfac doesn't match
    // creator.dfacId but is linked to their account). Fall back to local
    // same-device matching for callsites that don't pass the prop
    // (Fencing.tsx, Replay.js) so owners there don't lose their kick/
    // unkick controls and OwnerControls.
    if (this.props.isOwner) return true;
    const creator = this.props.game?.creator;
    if (!creator) return false;
    const userId = this.context?.user?.id;
    if (creator.userId && userId && creator.userId === userId) return true;
    if (creator.dfacId && this.props.id && creator.dfacId === this.props.id) return true;
    return false;
  }

  // Moderation endpoints require auth (the server rejects dfac-only
  // ownership because the creator.dfacId field is visible to anyone in
  // the room — it would otherwise be trivially forgeable by another
  // player). A guest owner needs to sign in to moderate. Gate the UI on
  // this so the buttons aren't there to click in the first place.
  get canModerate() {
    return this.isOwner && !!this.context?.accessToken;
  }

  handleOpenLockInfo = () => {
    this.setState({showLockInfo: true});
  };

  handleLockInfoChange = (open) => {
    this.setState({showLockInfo: open});
  };

  handleKickClick = (event) => {
    const targetDfacId = event.currentTarget.dataset.dfacId;
    if (!targetDfacId) return;
    if (!this.context?.accessToken) return;
    if (targetDfacId === this.props.id) return;
    const user = this.props.users?.[targetDfacId];
    const displayName = user?.displayName || 'this player';
    const color = user?.color || null;
    this.setState({kickTarget: {dfacId: targetDfacId, displayName, color}});
  };

  handleKickDialogChange = (open) => {
    if (!open) this.setState({kickTarget: null});
  };

  handleKickConfirm = async () => {
    const target = this.state.kickTarget;
    if (!target) return;
    const accessToken = this.context?.accessToken;
    if (!accessToken) return;
    try {
      await kickPlayer(this.props.gid, {dfac_id: target.dfacId}, accessToken);
    } catch (err) {
      Sentry.captureException(err);
    }
  };

  handleUnkickClick = (event) => {
    const targetDfacId = event.currentTarget.dataset.dfacId;
    if (!targetDfacId) return;
    if (!this.context?.accessToken) return;
    const user = this.props.users?.[targetDfacId];
    const displayName = user?.displayName || 'this player';
    const color = user?.color || null;
    this.setState({unkickTarget: {dfacId: targetDfacId, displayName, color}});
  };

  handleUnkickDialogChange = (open) => {
    if (!open) this.setState({unkickTarget: null});
  };

  handleUnkickConfirm = async () => {
    const target = this.state.unkickTarget;
    if (!target) return;
    const accessToken = this.context?.accessToken;
    if (!accessToken) return;
    try {
      const ok = await unkickPlayer(this.props.gid, {dfac_id: target.dfacId}, accessToken);
      if (ok && this.props.onUnkick) this.props.onUnkick(target.dfacId);
    } catch (err) {
      Sentry.captureException(err);
    }
  };

  componentDidMount() {
    const username = this.props.initialUsername;
    this.setState({username});
    this.handleUpdateDisplayName(username);
  }

  static get usernameKey() {
    return `username_${window.location.href}`;
  }

  handleSendMessage = (message) => {
    const {id} = this.props;
    const username = this.props.users[id].displayName;
    this.props.onChat(username, id, message);
    localStorage.setItem(Chat.usernameKey, username);
  };

  handleUpdateDisplayName = (username) => {
    let displayName = username;
    if (!this.usernameInput?.current?.focused) {
      displayName = displayName || nameGenerator();
    }
    const {id} = this.props;
    this.props.onUpdateDisplayName(id, displayName);
    this.setState({username: displayName});
    localStorage.setItem(Chat.usernameKey, displayName);
    // Check if localStorage has username_default, if not set it to the last
    // updated name
    if (
      localStorage.getItem('username_default') !== localStorage.getItem(Chat.usernameKey) &&
      !isFromNameGenerator(displayName)
    ) {
      localStorage.setItem('username_default', displayName);
    }
  };

  handleUpdateColor = (color) => {
    const resolvedColor = color || this.props.color;
    const {id} = this.props;
    this.props.onUpdateColor(id, resolvedColor);
  };

  handleUnfocus = () => {
    this.props.onUnfocus && this.props.onUnfocus();
  };

  handleBlur = () => {
    let {username} = this.state;
    username = username || nameGenerator();
    this.setState({username});
  };

  handleToggleChat = () => {
    this.props.onToggleChat();
  };

  static get serverUrl() {
    return `${window.location.protocol}//${window.location.host}`;
  }

  get url() {
    return `${Chat.serverUrl}/beta${this.props.path}`;
  }

  handleCopyClick = () => {
    navigator.clipboard.writeText(this.url);
    // `${window.location.host}/beta${this.props.path}`);
    const link = document.getElementById('pathText');
    link.classList.remove('flashBlue');
    // Force reflow to restart CSS animation
    void link.offsetWidth;
    link.classList.add('flashBlue');
  };

  handleShareScoreClick = () => {
    const text = `${Object.keys(this.props.users).length > 1 ? 'We' : 'I'} solved ${
      this.props.game.info.titleOverride || this.props.game.info.title
    } in ${formatMilliseconds(this.props.game.clock.totalTime)}!\n\n${Chat.serverUrl}/beta/play/${
      this.props.game.pid
    }`;
    navigator.clipboard.writeText(text);
    const link = document.getElementById('shareText');
    link.classList.remove('flashBlue');
    // Force reflow to restart CSS animation
    void link.offsetWidth;
    link.classList.add('flashBlue');
  };

  focus = () => {
    const chatBar = this.chatBar.current;
    if (chatBar) {
      chatBar.focus();
    }
  };

  static mergeMessages(data, opponentData) {
    if (!opponentData) {
      return data.messages || [];
    }

    const getMessages = (chatData, isOpponent) =>
      _.map(chatData.messages, (message) => ({...message, isOpponent}));

    const messages = _.concat(getMessages(data, false), getMessages(opponentData, true));

    return _.sortBy(messages, 'timestamp');
  }

  getMessageColor(senderId, isOpponent) {
    const {users, teams} = this.props;
    if (isOpponent === undefined) {
      if (users[senderId]?.teamId) {
        return teams?.[users[senderId].teamId]?.color;
      }
      return users[senderId]?.color;
    }
    return isOpponent ? 'rgb(220, 107, 103)' : 'rgb(47, 137, 141)';
  }

  renderGameButton() {
    return <MdClose onClick={this.handleToggleChat} className="toolbar--game" />;
  }

  renderToolbar() {
    if (!this.props.mobile) return null;
    return (
      <div className="flex flex--align-center toolbar--mobile">
        <Link to="/">Cross with Friends</Link> {this.renderGameButton()}
      </div>
    );
  }

  renderFencingOptions() {
    const fencingUrl = `/fencing/${this.props.gid}`;
    const normalUrl = `/beta/game/${this.props.gid}`;
    const isFencing = this.props.isFencing;
    // const fencingStarted = this.props.game.isFencing;
    const fencingPlayers = this.props.game.fencingUsers?.length ?? 0;
    return (
      <div>
        {!isFencing && !!fencingPlayers && (
          <a href={fencingUrl} className="fencing--join-link">
            Join Fencing ({fencingPlayers} joined)
          </a>
        )}
        {!isFencing && !fencingPlayers && (
          <a href={fencingUrl} style={{opacity: 0.1, textDecoration: 'none'}}>
            X
          </a>
        )}
        {isFencing && (
          <a href={normalUrl} className="fencing--leave-link">
            Leave Fencing
          </a>
        )}
      </div>
    );
  }

  renderChatHeader() {
    if (this.props.header) return this.props.header;
    const {info = {}, bid, game} = this.props;
    const {title, description, author, type, titleOverride, authorOverride} = info;
    const pid = game?.pid;
    const displayTitle = titleOverride || title;
    const displayAuthor = authorOverride || author;
    const desc = description?.startsWith('; ') ? description.substring(2) : description;
    const hasOverride = titleOverride || authorOverride;

    return (
      <div className="chat--header">
        <div className="chat--header--title">{displayTitle}</div>
        <div className="chat--header--subtitle">{type && `${type} | By ${displayAuthor}`}</div>
        {hasOverride && (
          <div className="chat--header--original">
            Originally: {title}
            {authorOverride ? ` by ${author}` : ''}
          </div>
        )}
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
        {pid && <PuzzleStatsLine pid={String(pid)} />}
        {pid && <RatingWidget pid={String(pid)} />}
        {!this.isOwner && this.props.locked && (
          <>
            <button
              type="button"
              className="chat--lock-chip"
              title="No new players can join. Click for details."
              onClick={this.handleOpenLockInfo}
            >
              <MdLock className="chat--lock-chip-icon" aria-hidden="true" />
              Game locked
            </button>
            <InfoDialog
              open={this.state.showLockInfo}
              onOpenChange={this.handleLockInfoChange}
              title="This game is locked"
              icon={<MdLock />}
            >
              <p>
                The game host locked this game, so <strong>no new players can join</strong>. Anyone who tries
                to open the game for the first time sees a &ldquo;game is locked&rdquo; message instead.
              </p>
              <p>
                You and everyone else already in the game keep playing as normal. The host can unlock the game
                at any time.
              </p>
            </InfoDialog>
          </>
        )}
        {this.isOwner && this.props.gid && this.props.restrictions && (
          <OwnerControls
            gid={this.props.gid}
            locked={!!this.props.locked}
            restrictions={this.props.restrictions}
            onRefreshModeration={this.props.onRefreshModeration}
          />
        )}
        {this.renderFencingOptions()}
      </div>
    );
  }

  renderUsernameInput() {
    return this.props.hideChatBar ? null : (
      <div className="chat--username">
        {'You are '}
        <ColorPicker color={this.props.myColor} onUpdateColor={this.handleUpdateColor} />
        <EditableSpan
          ref={this.usernameInput}
          className="chat--username--input"
          value={this.state.username}
          onChange={this.handleUpdateDisplayName}
          onBlur={this.handleBlur}
          onUnfocus={this.focus}
          style={{color: this.props.myColor}}
        />
      </div>
    );
  }

  static renderUserPresent(id, displayName, color, kickHandler, kicked, isOwner, unkickHandler) {
    // Kicked users keep their entry for attribution but render greyed out
    // with no live dot and no kick button (already gone).
    const style = kicked ? {opacity: 0.45, textDecoration: 'line-through'} : color && {color};
    return (
      <span key={id} style={style} title={kicked ? `${displayName} (kicked)` : undefined}>
        {!kicked && <span className="dot">{'\u25CF'}</span>}
        {isOwner && <FaCrown className="chat--user--owner-icon" title="Game owner" aria-label="Game owner" />}
        {displayName}
        {kickHandler && !kicked && (
          <button
            type="button"
            className="chat--user--kick-btn"
            data-dfac-id={id}
            onClick={kickHandler}
            title={`Kick ${displayName}`}
          >
            {'\u00D7'}
          </button>
        )}
        {unkickHandler && kicked && (
          <button
            type="button"
            className="chat--user--unkick-btn"
            data-dfac-id={id}
            onClick={unkickHandler}
            title={`Unkick ${displayName}`}
            aria-label={`Unkick ${displayName}`}
          >
            {'\u21A9'}
          </button>
        )}{' '}
      </span>
    );
  }

  // Kicked players are hidden from the presence list unless they left grid
  // or chat activity behind \u2014 in which case we keep them visible (greyed
  // out) so other players can still see who placed each letter / sent each
  // chat message.
  hasUserActivity(id) {
    const messages = this.props.data?.messages || [];
    if (messages.some((m) => m.senderId === id)) return true;
    const grid = this.props.game?.grid;
    if (Array.isArray(grid)) {
      for (const row of grid) {
        if (!Array.isArray(row)) continue;
        for (const cell of row) {
          if (cell && cell.user_id === id) return true;
        }
      }
    }
    return false;
  }

  renderUsersPresent(users) {
    if (this.props.hideChatBar) return null;
    const showKick = this.canModerate;
    const kickedSet = new Set(this.props.kickedDfacIds || []);
    const ownerDfacId = this.props.game?.creator?.dfacId || null;

    // Three sections: the owner gets their own slot at the top so they're
    // always identifiable at a glance. Everyone else splits between
    // players (have placed letters or sent chat) and spectators (joined
    // and picked a name but haven't done anything yet). Kicked users with
    // activity render in players (greyed for attribution); kicked users
    // without activity are hidden entirely.
    const owner = [];
    const players = [];
    const spectators = [];
    for (const id of Object.keys(users)) {
      const kicked = kickedSet.has(id);
      const active = this.hasUserActivity(id);
      if (kicked && !active) continue;
      if (ownerDfacId && id === ownerDfacId) {
        owner.push({id, kicked});
      } else if (active) {
        players.push({id, kicked});
      } else {
        spectators.push({id, kicked});
      }
    }

    const renderEntry = ({id, kicked}) =>
      Chat.renderUserPresent(
        id,
        users[id].displayName,
        users[id].color,
        showKick && !kicked && id !== this.props.id ? this.handleKickClick : null,
        kicked,
        !!ownerDfacId && id === ownerDfacId,
        showKick && kicked ? this.handleUnkickClick : null
      );

    return (
      <div className="chat--users--present">
        {owner.length > 0 && (
          <div className="chat--users--section">
            <div className="chat--users--section-label">Game owner</div>
            <div className="chat--users--section-list">{owner.map(renderEntry)}</div>
          </div>
        )}
        {players.length > 0 && (
          <div className="chat--users--section">
            <div className="chat--users--section-label">Players</div>
            <div className="chat--users--section-list">{players.map(renderEntry)}</div>
          </div>
        )}
        {spectators.length > 0 && (
          <div className="chat--users--section">
            <div className="chat--users--section-label">Spectators</div>
            <div className="chat--users--section-list">{spectators.map(renderEntry)}</div>
          </div>
        )}
      </div>
    );
  }

  renderChatBar() {
    return this.props.hideChatBar ? null : (
      <ChatBar
        ref={this.chatBar}
        mobile={this.props.mobile}
        placeHolder="[Enter] to chat"
        onSendMessage={this.handleSendMessage}
        onUnfocus={this.handleUnfocus}
      />
    );
  }

  static renderMessageTimestamp(timestamp) {
    return (
      <span className="chat--message--timestamp">
        {new Date(timestamp).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}
      </span>
    );
  }

  static renderMessageSender(name, color) {
    const style = color && {
      color,
    };
    return (
      <span className="chat--message--sender" style={style}>
        {name}:
      </span>
    );
  }

  renderMessageText(text) {
    const words = text.split(' ');
    const tokens = [];
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
        tokens[tokens.length - 1].data += ` ${word}`;
      } else {
        tokens.push({
          type: 'text',
          data: word,
        });
      }
    });

    const bigEmoji = tokens.length <= 3 && _.every(tokens, (token) => token.type === 'emoji');

    const renderToken = (token) => {
      if (token.type === 'emoji') {
        return <Emoji emoji={token.data} big={bigEmoji} />;
      }
      if (token.type === 'clueref') {
        return this.renderClueRef(token.data);
      }
      return token.data;
    };

    return (
      <span className="chat--message--text">
        {tokens.map((token, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <React.Fragment key={i}>
            {renderToken(token)}
            {token.type !== 'emoji' && ' '}
          </React.Fragment>
        ))}
      </span>
    );
  }

  // clueref is in the format [pattern, number, a(cross) | d(own)]
  renderClueRef(clueref) {
    const defaultPattern = clueref[0];

    let clueNumber;
    try {
      clueNumber = parseInt(clueref[1], 10);
    } catch {
      // not in a valid format, so just return the pattern
      return defaultPattern;
    }

    const directionFirstChar = clueref[2][0];
    const isAcross = directionFirstChar === 'a' || directionFirstChar === 'A';
    const clues = isAcross ? this.props.game.clues.across : this.props.game.clues.down;

    if (clueNumber >= 0 && clueNumber < clues.length && clues[clueNumber] !== undefined) {
      const handleClick = () => {
        const directionStr = isAcross ? 'across' : 'down';
        this.props.onSelectClue(directionStr, clueNumber);
      };

      return (
        // eslint-disable-next-line react/jsx-no-bind
        <button type="button" onClick={handleClick}>
          {' '}
          {defaultPattern}{' '}
        </button>
      );
    }
    return defaultPattern;
  }

  renderMessage(message) {
    const {text, senderId: id, isOpponent, timestamp} = message;
    const big = text.length <= 10 && isEmojis(text);
    const color = this.getMessageColor(id, isOpponent);
    const users = this.props.users;

    return (
      <div className={`chat--message${big ? ' big' : ''}`}>
        <div className="chat--message--content">
          {Chat.renderMessageSender(users[id]?.displayName ?? 'Unknown', color)}
          {this.renderMessageText(message.text)}
        </div>
        <div className="chat--message--timestamp">{Chat.renderMessageTimestamp(timestamp)}</div>
      </div>
    );
  }

  renderChatSubheader() {
    if (this.props.subheader) return this.props.subheader;
    const users = this.props.users;

    return (
      <>
        {this.renderUsernameInput()}
        {this.renderUsersPresent(users)}
      </>
    );
  }

  render() {
    const messages = Chat.mergeMessages(this.props.data, this.props.opponentData);
    const {kickTarget, unkickTarget} = this.state;
    return (
      <div className="flex--column flex--grow">
        {this.renderToolbar()}
        <ConfirmDialog
          open={!!kickTarget}
          onOpenChange={this.handleKickDialogChange}
          title={
            kickTarget ? (
              <>
                Kick{' '}
                <span style={kickTarget.color ? {color: kickTarget.color} : undefined}>
                  {kickTarget.displayName}
                </span>
                ?
              </>
            ) : (
              ''
            )
          }
          icon={<MdErrorOutline />}
          onConfirm={this.handleKickConfirm}
          confirmLabel="Kick"
          danger
        >
          <p>They will be removed from the game and cannot rejoin.</p>
        </ConfirmDialog>
        <ConfirmDialog
          open={!!unkickTarget}
          onOpenChange={this.handleUnkickDialogChange}
          title={
            unkickTarget ? (
              <>
                Unkick{' '}
                <span style={unkickTarget.color ? {color: unkickTarget.color} : undefined}>
                  {unkickTarget.displayName}
                </span>
                ?
              </>
            ) : (
              ''
            )
          }
          icon={<MdHelpOutline />}
          onConfirm={this.handleUnkickConfirm}
          confirmLabel="Unkick"
        >
          <p>They will be allowed back into the game.</p>
        </ConfirmDialog>
        <div className="chat">
          {this.renderChatHeader()}
          {this.renderChatSubheader()}
          {/* eslint-disable react/jsx-no-bind -- intentionally unstable ref to auto-scroll on every render */}
          <div
            ref={(el) => {
              if (el) {
                el.scrollTop = el.scrollHeight;
              }
            }}
            className="chat--messages"
          >
            {/* eslint-enable react/jsx-no-bind */}
            <div className="chat--message chat--system-message">
              <div>
                <i>
                  Game created! Share the link to play with your friends:
                  <wbr />
                </i>
                <b id="pathText" style={{marginLeft: '5px'}}>
                  {this.url}
                </b>

                <FaClone
                  className="copyButton"
                  title="Copy to Clipboard"
                  role="button"
                  tabIndex={0}
                  onClick={this.handleCopyClick}
                  onKeyDown={this.handleCopyClick}
                />
              </div>
            </div>
            {this.props.game.solved && (
              <div className="chat--message chat--system-message">
                <div
                  className="copyText"
                  role="button"
                  tabIndex={0}
                  onClick={this.handleShareScoreClick}
                  onKeyDown={this.handleShareScoreClick}
                >
                  <i id="shareText">
                    Congratulations! You solved the puzzle in{' '}
                    <b>{formatMilliseconds(this.props.game.clock.totalTime)}</b>. Click here to share your
                    score.
                    <wbr />
                  </i>

                  <FaClone className="copyButton" title="Copy to Clipboard" />
                </div>
              </div>
            )}
            {messages.map((message, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i}>{this.renderMessage(message)}</div>
            ))}
          </div>
          {this.renderChatBar()}
        </div>
      </div>
    );
  }
}

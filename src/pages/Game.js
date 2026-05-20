/* eslint-disable no-nested-ternary, class-methods-use-this, consistent-return, react/jsx-no-bind */
import './css/game.css';

import * as Sentry from '@sentry/react';
import {Component} from 'react';
import _ from 'lodash';
import qs from 'qs';
import {Helmet} from 'react-helmet-async';
import Nav from '../components/common/Nav';

import {GameModel} from '../store';
import HistoryWrapper from '../lib/wrappers/HistoryWrapper';
import GameComponent from '../components/Game';
import MobilePanel from '../components/common/MobilePanel';
import Chat from '../components/Chat';
import {isMobile} from '../lib/jsUtils';
import {pickDistinctColor} from '../lib/colorAssignment';
import getLocalId from '../localAuth';

import {recordSolve} from '../api/puzzle.ts';
import AuthContext from '../lib/AuthContext';
import {SERVER_URL} from '../api/constants';
import {undismissGame, fetchGameModeration} from '../api/create_game.ts';

import nameGenerator from '../lib/nameGenerator';

import withRouter from '../lib/withRouter';

class Game extends Component {
  static contextType = AuthContext;

  constructor(props) {
    super(props);
    window.gameComponent = this;
    this.state = {
      gid: undefined,
      mobile: isMobile(),
      mode: 'game',
      chatHidden: localStorage.getItem('chat_hidden') === 'true',
      focusMode: localStorage.getItem('focus_mode') === 'true',
      lastReadChat: 0,
      replayRetained: null, // null = no snapshot yet, false = snapshot exists but not retained, true = retained
      savingReplay: false,
      connectionFailed: false,
      kickedDfacIds: [],
      isOwnerFromServer: false,
      restrictions: {check: false, reveal: false, reset: false},
      locked: false,
    };
    this.initializeUser();
    this.handleResize = () => {
      this.setState({
        mobile: isMobile(),
      });
    };
    window.addEventListener('resize', this.handleResize);
    this.initialUsername =
      localStorage.getItem(this.usernameKey) !== null
        ? // If localStorage has a username for this game use that, if not
          // check if there's a default username, if there is none, use the
          // name generator
          localStorage.getItem(this.usernameKey)
        : localStorage.getItem('username_default') !== null
          ? localStorage.getItem('username_default')
          : nameGenerator();
  }

  get usernameKey() {
    return `username_${window.location.href}`;
  }

  // lifecycle stuff

  static getDerivedStateFromProps(props, prevState) {
    return {
      ...prevState,
      rid: props.match.params.rid,
      gid: props.match.params.gid,
    };
  }

  get beta() {
    return true;
  }

  get query() {
    return qs.parse(this.props.location.search.slice(1));
  }

  initializeUser() {
    this.userId = getLocalId();
  }

  initializeGame() {
    this.gameModel = new GameModel(`/game/${this.state.gid}`);
    this.historyWrapper = new HistoryWrapper();
    this.gameModel.on('wsCreateEvent', (event) => {
      this.historyWrapper.setCreateEvent(event);
      // If loaded from a snapshot (already solved), don't re-record the solve
      if (this.game.solved) {
        this.lastRecordedSolve = this.state.gid;
      }
      if (this._connectionTimer) clearTimeout(this._connectionTimer);
      this.setState({connectionFailed: false});
      this.handleUpdate();
    });
    this.gameModel.on('wsEvent', (event) => {
      this.historyWrapper.addEvent(event);
      if (this._connectionTimer) clearTimeout(this._connectionTimer);
      this.setState({connectionFailed: false});
      this.handleChange();
      this.handleUpdate();
    });
    this.gameModel.on('wsOptimisticEvent', (event) => {
      this.historyWrapper.addOptimisticEvent(event);
      this.handleChange();
      this.handleUpdate();
    });
    // Terminal rejection (restricted / banned / protocol error). The
    // optimistic version of the event is still in the historyWrapper
    // because the server never echoed it back through wsEvent. Drop it
    // so the board doesn't keep showing a check/reveal/reset effect that
    // no one else can see.
    this.gameModel.on('eventRejected', ({event}) => {
      if (!event) return;
      this.historyWrapper.removeOptimisticEvent(event.id);
      this.handleChange();
      this.handleUpdate();
    });
    this.gameModel.on('reconnect', () => {
      // Offline events were flushed by the Game model on reconnect,
      // so we can safely clear warnings and optimistic state
      this.setState({syncWarning: null});
      if (this._connectionTimer) clearTimeout(this._connectionTimer);
      this.setState({connectionFailed: false});
      this.handleChange();
      this.handleUpdate();
    });
    this.gameModel.on('syncWarning', (info) => {
      if (!info || !info.level) {
        this.setState({syncWarning: null, retryCountdown: 0});
        if (this._retryTimer) clearInterval(this._retryTimer);
        return;
      }
      this.setState({syncWarning: info.level});
      if (info.level === 'retrying' && info.retryIn) {
        this.setState({retryCountdown: info.retryIn});
        if (this._retryTimer) clearInterval(this._retryTimer);
        this._retryTimer = setInterval(() => {
          this.setState((prev) => {
            const next = prev.retryCountdown - 1;
            if (next <= 0) {
              clearInterval(this._retryTimer);
              return {retryCountdown: 0};
            }
            return {retryCountdown: next};
          });
        }, 1000);
      }
    });

    this.gameModel.on('gameNotFound', () => {
      this.setState({gameNotFound: true});
    });

    // Owner-driven moderation events from the socket layer. The kick
    // broadcast goes to everyone in the room; only the target acts on it.
    // joinRejected fires when the server refused our join because we're
    // banned or the game is locked.
    this.gameModel.on('kicked', (msg) => {
      // initializeGame() runs on every gid change without explicitly
      // tearing down the prior gameModel's listeners, so a 'kicked' event
      // from the old game can fire after we've already navigated to a
      // new one. Without this gid check, we'd forceDisconnect the new
      // session and show the blocker for a kick that wasn't ours.
      if (msg.gid !== this.state.gid) return;
      const myDfacId = this.userId;
      const myUserId = this.context?.user?.id;
      const isTarget = (msg.dfac_id && msg.dfac_id === myDfacId) || (msg.user_id && msg.user_id === myUserId);
      if (isTarget) {
        // Cut the live socket so we stop receiving updates/chat from the
        // room. The server-side ban already blocks our outgoing events,
        // but the room broadcasts still hit us until we disconnect.
        if (this.gameModel.forceDisconnect) this.gameModel.forceDisconnect();
        this.setState({moderationError: 'kicked'});
      } else if (msg.dfac_id) {
        // Track for the presence-list filter — kicked players are hidden
        // unless they left activity behind, in which case they render as
        // greyed out for attribution. See Chat.renderUsersPresent.
        this.setState((prev) => {
          if (prev.kickedDfacIds.includes(msg.dfac_id)) return null;
          return {kickedDfacIds: [...prev.kickedDfacIds, msg.dfac_id]};
        });
      }
    });
    this.gameModel.on('joinRejected', (msg) => {
      // 'banned' or 'locked' — both render the same blocker screen, just
      // with different copy. Gate on gid for the same reason the kicked
      // listener does: stale gameModel instances from prior gids can still
      // emit joinRejected on reconnect, and without this check they'd
      // incorrectly drop a blocker on the currently active game.
      if (msg.gid !== this.state.gid) return;
      this.setState({moderationError: msg.reason});
    });
    this.gameModel.on('unkicked', (msg) => {
      if (msg.gid !== this.state.gid) return;
      if (!msg.dfac_id) return;
      this.setState((prev) => ({
        kickedDfacIds: prev.kickedDfacIds.filter((id) => id !== msg.dfac_id),
      }));
    });
    this.gameModel.on('restrictionsChanged', (msg) => {
      if (msg.gid !== this.state.gid) return;
      if (!msg.action) return;
      this.setState((prev) => ({
        restrictions: {...prev.restrictions, [msg.action]: !!msg.restricted},
      }));
    });
    this.gameModel.on('lockChanged', (msg) => {
      if (msg.gid !== this.state.gid) return;
      this.setState({locked: !!msg.locked});
    });

    // Defer updateDisplayName until after we confirm the game has a create
    // event server-side. Emitting on mount produced orphan rows in
    // game_events for legacy gids that never had a create (#478).
    this.gameModel.on('gameReady', () => {
      this.handleUpdateDisplayName(this.userId, this.initialUsername);
    });

    this.gameModel.on('archived', () => {
      this.setState({
        archived: true,
      });
    });

    // Show error if socket doesn't connect within 10 seconds
    // Also clear any moderation blocker carried over from a previous gid —
    // navigating to a fresh game in the same SPA session shouldn't show
    // "you were removed" once we successfully connect to the new one.
    this.setState({
      connectionFailed: false,
      gameNotFound: false,
      moderationError: undefined,
      kickedDfacIds: [],
      isOwnerFromServer: false,
      restrictions: {check: false, reveal: false, reset: false},
      locked: false,
    });
    // Seed kicked-id list + owner status from the server. The socket
    // 'kicked' broadcast covers kicks that happen while we're connected;
    // the fetch covers kicks that happened before we joined (or before a
    // refresh). isOwner is server-resolved to handle the case where the
    // owner's creator.dfacId is linked to the authed user but doesn't
    // match the local dfac id (different device, same account).
    this.fetchModerationState(this.state.gid);
    if (this._connectionTimer) clearTimeout(this._connectionTimer);
    this._connectionTimer = setTimeout(() => {
      if (!this.historyWrapper || !this.historyWrapper.ready) {
        this.setState({connectionFailed: true});
      }
    }, 10000);

    this.gameModel.attach();
  }

  componentDidMount() {
    this.initializeGame();
    this.maybeUndismiss();
  }

  // Imperative refresh trigger handed to OwnerControls so a successful
  // lock/restriction toggle re-syncs the panel even if the socket bounces
  // or drops the lock_changed / restrictions_changed broadcast. The
  // broadcast still handles the common path (and updates other tabs);
  // this is just a defensive backstop for the owner's own tab.
  handleRefreshModeration = () => {
    if (this.state.gid) this.fetchModerationState(this.state.gid);
  };

  fetchModerationState = async (gid) => {
    try {
      const accessToken = this.context?.accessToken;
      const state = await fetchGameModeration(gid, accessToken);
      if (!state || this.state.gid !== gid) return;
      this.setState({
        kickedDfacIds: state.kickedDfacIds || [],
        isOwnerFromServer: !!state.isOwner,
        restrictions: state.restrictions,
        locked: !!state.locked,
      });
    } catch (e) {
      Sentry.captureException(e);
    }
  };

  maybeUndismiss() {
    const accessToken = this.context?.accessToken;
    if (accessToken && this.state.gid) {
      undismissGame(this.state.gid, accessToken).catch((e) => {
        Sentry.captureException(e);
        console.error('undismiss failed:', e);
      });
      this._undismissed = true;
    }
  }

  componentWillUnmount() {
    if (this._retryTimer) clearInterval(this._retryTimer);
    if (this._connectionTimer) clearTimeout(this._connectionTimer);
    window.removeEventListener('resize', this.handleResize);
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.gid !== this.state.gid) {
      this.initializeGame();
    }
    if (!this._undismissed) {
      this.maybeUndismiss();
    }
    // Re-fetch moderation when the user signs in/out mid-game so the
    // server-resolved isOwner reflects the new token.
    const token = this.context?.accessToken || null;
    if (this._lastModerationToken !== token && this.state.gid) {
      this._lastModerationToken = token;
      this.fetchModerationState(this.state.gid);
    }
  }

  get showingGame() {
    return !this.state.mobile || this.state.mode === 'game';
  }

  get showingChat() {
    return !this.state.mobile || this.state.mode === 'chat';
  }

  get game() {
    return this.historyWrapper.getSnapshot();
  }

  // Unified ownership check that covers all three cases moderation gates on:
  // - server-resolved (cross-device: same account, different dfac id)
  // - signed-in user id matches creator.userId on the same device
  // - guest dfac id matches creator.dfacId on the same device
  // The Toolbar/Chat both consume this, so a guest-owner-on-same-device
  // doesn't get their own actions gated by the restrictions UI.
  // Safe to call from any render path that already requires
  // historyWrapper.ready (renderGame / renderChat both gate on it).
  get isOwner() {
    if (this.state.isOwnerFromServer) return true;
    const creator = this.game?.creator;
    if (!creator) return false;
    const userId = this.context?.user?.id;
    if (creator.userId && userId && creator.userId === userId) return true;
    if (creator.dfacId && this.userId && creator.dfacId === this.userId) return true;
    return false;
  }

  get unreads() {
    const lastMessage = Math.max(...(this.game.chat.messages || []).map((m) => m.timestamp));
    return lastMessage > this.state.lastReadChat;
  }

  get userColorKey() {
    return `user_color`;
  }

  get userColor() {
    const existingColor = this.game.users[this.props.id]?.color || localStorage.getItem(this.userColorKey);

    if (existingColor) {
      localStorage.setItem(this.userColorKey, existingColor);
      return existingColor;
    }

    const otherColors = Object.entries(this.game.users)
      .filter(([uid]) => uid !== this.props.id)
      .map(([, user]) => user?.color)
      .filter(Boolean);

    const color = pickDistinctColor(otherColors);
    localStorage.setItem(this.userColorKey, color);
    return color;
  }

  handleToggleFocusMode = () => {
    this.setState((prevState) => {
      const focusMode = !prevState.focusMode;
      localStorage.setItem('focus_mode', String(focusMode));
      return {focusMode};
    });
  };

  handleToggleChat = () => {
    if (this.state.mobile) {
      this.setState((prevState) => ({mode: prevState.mode === 'game' ? 'chat' : 'game'}));
    } else {
      this.setState((prevState) => {
        const chatHidden = !prevState.chatHidden;
        localStorage.setItem('chat_hidden', String(chatHidden));
        return {chatHidden};
      });
    }
  };

  handleUnkick = (dfacId) => {
    this.setState((prev) => ({
      kickedDfacIds: prev.kickedDfacIds.filter((id) => id !== dfacId),
    }));
  };

  handleChat = (username, id, message) => {
    this.gameModel.chat(username, id, message);
  };

  handleUpdateDisplayName = (id, displayName) => {
    this.gameModel.updateDisplayName(id, displayName);
  };

  handleUpdateColor = (id, color) => {
    this.gameModel.updateColor(id, color);
    localStorage.setItem(this.userColorKey, color);
  };

  updateSeenChatMessage = (message) => {
    if (message.timestamp > this.state.lastReadChat) {
      this.setState({lastReadChat: message.timestamp});
    }
  };

  handleUnfocusGame = () => {
    this.chat && this.chat.focus();
  };

  handleUnfocusChat = () => {
    this.gameComponent && this.gameComponent.focus();
  };

  handleSelectClue = (direction, number) => {
    this.gameComponent.handleSelectClue(direction, number);
  };

  handleUpdate = _.debounce(
    () => {
      this.forceUpdate();
    },
    0,
    {
      leading: true,
    }
  );

  handleChange = _.debounce(async () => {
    if (!this.gameModel || !this.historyWrapper.ready) {
      return;
    }

    if (this.game.solved) {
      // Wait for optimistic events to be confirmed before saving the snapshot,
      // because optimistic processing skips clock tick() — saving now would
      // capture an incomplete totalTime.
      if (this.historyWrapper.optimisticEvents.length > 0) return;
      if (this.lastRecordedSolve === this.state.gid) return;
      this.lastRecordedSolve = this.state.gid;
      // log to postgres
      const authToken = this.context?.accessToken || null;
      const playerCount = Object.keys(this.game.users || {}).length || 1;
      // Compute the true total time: if the clock hasn't been ticked yet
      // (e.g. optimistic event just confirmed), add the unaccounted elapsed time.
      const gameClock = this.game.clock;
      const unaccountedTime =
        gameClock.paused || !gameClock.lastUpdated ? 0 : Date.now() - gameClock.lastUpdated;
      const solvedClock = {
        ...gameClock,
        totalTime: gameClock.totalTime + Math.max(0, unaccountedTime),
        paused: true,
      };
      const snapshot = {
        grid: this.game.grid,
        users: this.game.users,
        clock: solvedClock,
        chat: this.game.chat,
      };
      await recordSolve(
        this.game.pid,
        this.state.gid,
        solvedClock.totalTime,
        authToken,
        playerCount,
        snapshot
      );
      this.setState({replayRetained: false});
    }
  });

  handleSaveReplay = async () => {
    const accessToken = this.context?.accessToken;
    if (!accessToken) return;
    this.setState({savingReplay: true});
    try {
      const resp = await fetch(`${SERVER_URL}/api/game-snapshot/${this.state.gid}/keep-replay`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (resp.ok) {
        this.setState({replayRetained: true, savingReplay: false});
      } else {
        this.setState({savingReplay: false});
      }
    } catch (e) {
      Sentry.captureException(e);
      console.error('Failed to save replay:', e);
      this.setState({savingReplay: false});
    }
  };

  // ================
  // Render Methods

  renderGame() {
    if (!this.gameModel || !this.historyWrapper.ready) {
      return;
    }

    const {mobile} = this.state;
    const id = this.userId;
    const color = this.userColor;
    return (
      <GameComponent
        ref={(c) => {
          this.gameComponent = c;
        }}
        beta={this.beta}
        id={id}
        gid={this.state.gid}
        myColor={color}
        historyWrapper={this.historyWrapper}
        gameModel={this.gameModel}
        onUnfocus={this.handleUnfocusGame}
        onChange={this.handleChange}
        onSolve={this.handleSolve}
        onToggleChat={this.handleToggleChat}
        chatHidden={this.state.chatHidden}
        mobile={mobile}
        unreads={this.unreads}
        syncFailed={this.state.syncWarning === 'failed'}
        onSaveReplay={this.handleSaveReplay}
        replayRetained={this.state.replayRetained}
        savingReplay={this.state.savingReplay}
        isAuthenticated={this.context?.isAuthenticated}
        onPreferenceChange={this.context?.savePreference}
        focusMode={this.state.focusMode}
        onToggleFocusMode={this.handleToggleFocusMode}
        restrictions={this.state.restrictions}
        isOwner={this.isOwner}
      />
    );
  }

  renderChat() {
    if (!this.gameModel || !this.historyWrapper.ready) {
      return;
    }

    const id = this.userId;
    const color = this.userColor;
    const {mobile} = this.state;
    return (
      <Chat
        ref={(c) => {
          this.chat = c;
        }}
        info={this.game.info}
        path={this.gameModel.path}
        data={this.game.chat}
        game={this.game}
        gid={this.state.gid}
        users={this.game.users}
        kickedDfacIds={this.state.kickedDfacIds}
        isOwner={this.isOwner}
        locked={this.state.locked}
        restrictions={this.state.restrictions}
        onRefreshModeration={this.handleRefreshModeration}
        onUnkick={this.handleUnkick}
        id={id}
        myColor={color}
        onChat={this.handleChat}
        onUpdateDisplayName={this.handleUpdateDisplayName}
        onUpdateColor={this.handleUpdateColor}
        onUnfocus={this.handleUnfocusChat}
        onToggleChat={this.handleToggleChat}
        onSelectClue={this.handleSelectClue}
        mobile={mobile}
        updateSeenChatMessage={this.updateSeenChatMessage}
        initialUsername={this.initialUsername}
      />
    );
  }

  getPuzzleTitle() {
    if (!this.gameModel || !this.historyWrapper.ready) {
      return;
    }
    const game = this.historyWrapper.getSnapshot();
    if (!game || !game.info) return '';
    return game.info.titleOverride || game.info.title;
  }

  renderContent() {
    const mobileContent = (
      <>
        <MobilePanel />
        {this.showingGame && this.renderGame()}
        {this.showingChat && this.renderChat()}
      </>
    );

    const {chatHidden, focusMode} = this.state;
    const desktopContent = (
      <>
        <Nav hidden={focusMode} />
        <div className="game">
          <div className={`flex--column flex--shrink-0${chatHidden ? ' flex--center-h' : ''}`}>
            {this.showingGame && this.renderGame()}
          </div>
          {!chatHidden && <div className="flex flex--grow">{this.showingChat && this.renderChat()}</div>}
        </div>
      </>
    );

    return this.state.mobile ? mobileContent : desktopContent;
  }

  render() {
    return (
      <div
        className="flex--column flex--grow room"
        style={{
          width: '100%',
          height: '100%',
        }}
      >
        <Helmet>
          <title>{this.getPuzzleTitle()}</title>
        </Helmet>
        {this.state.moderationError && (
          <div className="game-moderation-blocker">
            <div className="game-moderation-blocker--card">
              <h2>
                {this.state.moderationError === 'kicked'
                  ? 'You were removed from this game'
                  : this.state.moderationError === 'locked'
                    ? 'This game is locked'
                    : "You can't join this game"}
              </h2>
              <p>
                {this.state.moderationError === 'kicked'
                  ? 'The game owner removed you.'
                  : this.state.moderationError === 'locked'
                    ? 'The game owner closed this game to new players.'
                    : 'The game owner has banned this account from the game.'}
              </p>
              <a href="/" className="btn btn--contained btn--primary">
                Back to home
              </a>
            </div>
          </div>
        )}
        {this.state.syncWarning === 'retrying' && (
          <div
            style={{
              background: '#e65100',
              color: 'white',
              padding: '6px 12px',
              textAlign: 'center',
              fontSize: '14px',
            }}
          >
            Connection interrupted — retrying
            {this.state.retryCountdown > 0 ? ` in ${this.state.retryCountdown}s` : ''}...
          </div>
        )}
        {this.state.syncWarning === 'failed' && (
          <div
            style={{
              background: window.socket?.connected ? '#2e7d32' : '#b71c1c',
              color: 'white',
              padding: '8px 12px',
              textAlign: 'center',
              fontSize: '14px',
            }}
          >
            {window.socket?.connected ? (
              <>
                You are back online! Any letters typed while offline were not saved. Click refresh to resync
                your game.
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  style={{
                    background: 'white',
                    color: '#2e7d32',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 12px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    marginLeft: '8px',
                  }}
                >
                  Refresh
                </button>
              </>
            ) : (
              'Connection lost — leaving this page may lose your progress. Stay here until reconnected.'
            )}
          </div>
        )}
        {this.state.connectionFailed && !this.state.syncWarning && (
          <div
            style={{
              background: '#b71c1c',
              color: 'white',
              padding: '8px 12px',
              textAlign: 'center',
              fontSize: '14px',
            }}
          >
            {import.meta.env.VITE_MAINTENANCE_MESSAGE ||
              'Unable to connect to the server. The backend may be undergoing maintenance.'}{' '}
            Reach out on{' '}
            <a
              href="https://discord.gg/RmjCV8EZ73"
              target="_blank"
              rel="noopener noreferrer"
              style={{color: 'white', textDecoration: 'underline'}}
            >
              Discord
            </a>{' '}
            for more info.
          </div>
        )}
        {this.state.gameNotFound ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              padding: '40px 20px',
              textAlign: 'center',
            }}
          >
            <h2 style={{marginBottom: '12px'}}>Game not found</h2>
            <p style={{color: '#666', maxWidth: '400px', lineHeight: '1.5'}}>
              This game could not be loaded. It may have been created during a server issue and was not saved
              properly.
            </p>
            <a
              href="/"
              style={{
                marginTop: '20px',
                padding: '10px 24px',
                background: '#2196F3',
                color: 'white',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 'bold',
              }}
            >
              Back to Home
            </a>
          </div>
        ) : (
          this.renderContent()
        )}
      </div>
    );
  }
}

export default withRouter(Game);

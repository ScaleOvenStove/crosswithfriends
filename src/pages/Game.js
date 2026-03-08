/* eslint-disable no-nested-ternary, class-methods-use-this, consistent-return, react/jsx-no-bind */
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
import {undismissGame} from '../api/create_game.ts';

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
      lastReadChat: 0,
      replayRetained: null, // null = no snapshot yet, false = snapshot exists but not retained, true = retained
      savingReplay: false,
      connectionFailed: false,
    };
    this.initializeUser();
    window.addEventListener('resize', () => {
      this.setState({
        mobile: isMobile(),
      });
    });
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
    this.gameModel.on('reconnect', () => {
      // Don't clear optimistic events — the retry loop will re-send them
      // and they'll be confirmed through the normal server broadcast flow
      // Only clear the warning banner if the model isn't in 'failed' state —
      // failed events exhausted retries and were never persisted
      if (this.gameModel.syncState !== 'failed') {
        this.setState({syncWarning: null});
      }
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

    this.gameModel.on('archived', () => {
      this.setState({
        archived: true,
      });
    });

    // Show error if socket doesn't connect within 10 seconds
    this.setState({connectionFailed: false});
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
    this.handleUpdateDisplayName(this.userId, this.initialUsername);
    this.maybeUndismiss();
  }

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
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.gid !== this.state.gid) {
      this.initializeGame();
    }
    if (!this._undismissed) {
      this.maybeUndismiss();
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

  handleToggleChat = () => {
    this.setState((prevState) => ({mode: prevState.mode === 'game' ? 'chat' : 'game'}));
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
        mobile={mobile}
        unreads={this.unreads}
        syncFailed={this.state.syncWarning === 'failed'}
        onSaveReplay={this.handleSaveReplay}
        replayRetained={this.state.replayRetained}
        savingReplay={this.state.savingReplay}
        isAuthenticated={this.context?.isAuthenticated}
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
    return game.info.title;
  }

  renderContent() {
    const mobileContent = (
      <>
        <MobilePanel />
        {this.showingGame && this.renderGame()}
        {this.showingChat && this.renderChat()}
      </>
    );

    const desktopContent = (
      <>
        <Nav />
        <div className="flex flex--grow" style={{overflow: 'auto'}}>
          <div className="flex--column flex--shrink-0">{this.showingGame && this.renderGame()}</div>
          <div className="flex flex--grow">{this.showingChat && this.renderChat()}</div>
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
        {this.renderContent()}
      </div>
    );
  }
}

export default withRouter(Game);

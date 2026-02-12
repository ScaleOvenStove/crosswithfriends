/* eslint-disable no-nested-ternary, class-methods-use-this, consistent-return, react/jsx-no-bind */
import 'react-flexview/lib/flexView.css';

import React, {Component} from 'react';
import _ from 'lodash';
import querystring from 'querystring';
import {Helmet} from 'react-helmet';
import Flex from 'react-flexview';
import Nav from '../components/common/Nav';

import {GameModel, getUser, BattleModel} from '../store';
import HistoryWrapper from '../lib/wrappers/HistoryWrapper';
import GameComponent from '../components/Game';
import MobilePanel from '../components/common/MobilePanel';
import Chat from '../components/Chat';
import Powerups from '../components/common/Powerups';
import {isMobile, rand_color} from '../lib/jsUtils';

import * as powerupLib from '../lib/powerups';
import {recordSolve} from '../api/puzzle.ts';

import nameGenerator from '../lib/nameGenerator';

export default class Game extends Component {
  constructor(props) {
    super(props);
    window.gameComponent = this;
    this.state = {
      gid: undefined,
      mobile: isMobile(),
      mode: 'game',
      powerups: undefined,
      lastReadChat: 0,
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
    return querystring.parse(this.props.location.search.slice(1));
  }

  initializeUser() {
    this.user = getUser();
    this.user.onAuth(() => {
      this.forceUpdate();
    });
  }

  initializeBattle(battleData) {
    if (!battleData) {
      return;
    }

    const {bid, team} = battleData;
    this.setState({bid, team});
    if (this.battleModel) this.battleModel.detach();

    this.battleModel = new BattleModel(`/battle/${bid}`);

    this.battleModel.once('games', (games) => {
      const opponent = games[1 - team];
      this.setState({opponent}, () => this.initializeOpponentGame());
    });

    this.battleModel.on('usePowerup', (powerup) => {
      const {gameModel, opponentGameModel} = this;
      const {selected} = this.gameComponent.player.state;
      powerupLib.applyOneTimeEffects(powerup, {gameModel, opponentGameModel, selected});
      this.handleChange();
    });

    _.forEach(['powerups', 'startedAt', 'winner', 'players', 'pickups'], (subpath) => {
      this.battleModel.on(subpath, (value) => {
        this.setState({[subpath]: value});
      });
    });
    this.battleModel.attach();
  }

  initializeGame() {
    if (this.gameModel) this.gameModel.detach();
    this.gameModel = new GameModel(`/game/${this.state.gid}`);
    this.historyWrapper = new HistoryWrapper();
    this.gameModel.once('battleData', (battleData) => {
      this.initializeBattle(battleData);
    });
    this.gameModel.on('wsCreateEvent', (event) => {
      this.historyWrapper.setCreateEvent(event);
      this.handleUpdate();
    });
    this.gameModel.on('wsEvent', (event) => {
      this.historyWrapper.addEvent(event);
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
    this.gameModel.attach();
  }

  // TODO: combine this logic with the above...
  initializeOpponentGame() {
    if (!this.state.opponent) return;

    if (this.opponentGameModel) this.opponentGameModel.detach();

    this.opponentGameModel = new GameModel(`/game/${this.state.opponent}`);
    this.opponentHistoryWrapper = new HistoryWrapper();
    this.opponentGameModel.on('createEvent', (event) => {
      this.opponentHistoryWrapper.setCreateEvent(event);
      this.handleUpdate();
    });
    this.opponentGameModel.on('event', (event) => {
      this.opponentHistoryWrapper.addEvent(event);
      this.handleChange();
      this.handleUpdate();
    });

    // For now, every client spawns pickups. That makes sense maybe from a balance perpsective.
    // It's just easier to write. Also for now you can have multiple in the same tile oops.
    // TODO: fix these.
    setInterval(() => {
      this.battleModel.spawnPowerups(1, [this.game, this.opponentGame]);
    }, 6 * 1000);

    this.opponentGameModel.attach();
  }

  componentDidMount() {
    this.initializeGame();
    this.handleUpdateDisplayName(this.user.id, this.initialUsername);
  }

  componentWillUnmount() {
    if (this._retryTimer) clearInterval(this._retryTimer);
    if (this.gameModel) this.gameModel.detach();
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.gid !== this.state.gid) {
      this.initializeGame();
    }
    if (prevState.winner !== this.state.winner && this.state.winner) {
      const {winner, startedAt, players} = this.state;
      const {team, completedAt} = winner;

      const winningPlayers = _.filter(_.values(players), {team});
      const winningPlayersString = _.join(_.map(winningPlayers, 'name'), ', ');

      const victoryMessage = `Team ${Number(team) + 1} [${winningPlayersString}] won! `;
      const timeMessage = `Time taken: ${Number((completedAt - startedAt) / 1000)} seconds.`;

      this.gameModel.chat('BattleBot', null, victoryMessage + timeMessage);
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

  get opponentGame() {
    if (!this.opponentGameModel || !this.opponentHistoryWrapper.ready || !this.opponentHistoryWrapper) {
      return undefined;
    }
    return this.opponentHistoryWrapper.getSnapshot();
  }

  get unreads() {
    const lastMessage = Math.max(...(this.game.chat.messages || []).map((m) => m.timestamp));
    return lastMessage > this.state.lastReadChat;
  }

  get userColorKey() {
    return `user_color`;
  }

  //TODO (jackz): this is how color is persisted
  get userColor() {
    const color =
      this.game.users[this.props.id]?.color || localStorage.getItem(this.userColorKey) || rand_color();
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

  handleChange = _.debounce(async ({isEdit = false} = {}) => {
    if (!this.gameModel || !this.historyWrapper.ready) {
      return;
    }

    if (isEdit) {
      await this.user.joinGame(this.state.gid, {
        pid: this.game.pid,
        solved: false,
        v2: true,
      });
    }
    if (this.game.solved) {
      if (this.lastRecordedSolve === this.state.gid) return;
      this.lastRecordedSolve = this.state.gid;
      if (this.gameModel.puzzleModel) {
        this.gameModel.puzzleModel.logSolve(this.state.gid, {
          solved: true,
          totalTime: this.game.clock.totalTime,
        });
      }
      // double log to postgres
      await recordSolve(this.game.pid, this.state.gid, this.game.clock.totalTime);
      this.user.markSolved(this.state.gid);
      if (this.battleModel) {
        this.battleModel.setSolved(this.state.team);
      }
    }
  });

  handleUsePowerup = (powerup) => {
    this.battleModel.usePowerup(powerup.type, this.state.team);
  };

  // ================
  // Render Methods

  renderGame() {
    if (!this.gameModel || !this.historyWrapper.ready) {
      return;
    }

    const {mobile} = this.state;
    const {id} = this.user;
    const color = this.userColor;
    const ownPowerups = _.get(this.state.powerups, this.state.team);
    const opponentPowerups = _.get(this.state.powerups, 1 - this.state.team);
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
        opponentHistoryWrapper={
          this.opponentGameModel && this.opponentHistoryWrapper.ready && this.opponentHistoryWrapper
        }
        ownPowerups={ownPowerups}
        opponentPowerups={opponentPowerups}
        pickups={this.state.pickups}
        battleModel={this.battleModel}
        team={this.state.team}
        unreads={this.unreads}
        syncFailed={this.state.syncWarning === 'failed'}
      />
    );
  }

  renderChat() {
    if (!this.gameModel || !this.historyWrapper.ready) {
      return;
    }

    const {id} = this.user;
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
        opponentData={this.opponentGame && this.opponentGame.chat}
        bid={this.state.bid}
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
    const powerups = _.get(this.state.powerups, this.state.team);

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
        <Flex grow={1} style={{overflow: 'auto'}}>
          <Flex column shrink={0}>
            {this.showingGame && this.renderGame()}
          </Flex>
          <Flex grow={1}>{this.showingChat && this.renderChat()}</Flex>
        </Flex>
        {powerups && <Powerups powerups={powerups} handleUsePowerup={this.handleUsePowerup} />}
      </>
    );

    return this.state.mobile ? mobileContent : desktopContent;
  }

  render() {
    return (
      <Flex
        className="room"
        column
        grow={1}
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
              background: '#b71c1c',
              color: 'white',
              padding: '8px 12px',
              textAlign: 'center',
              fontSize: '14px',
            }}
          >
            Connection lost — leaving this page may lose your progress. Stay here until reconnected.
            {window.socket?.connected && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  style={{
                    background: 'white',
                    color: '#b71c1c',
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
            )}
          </div>
        )}
        {this.renderContent()}
      </Flex>
    );
  }
}

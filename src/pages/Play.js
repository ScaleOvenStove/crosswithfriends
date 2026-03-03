import './css/play.css';

import {Component} from 'react';
import {Helmet} from 'react-helmet-async';
import _ from 'lodash';
import qs from 'qs';
import {formatTimestamp} from '../lib/formatTimestamp';
import {Link} from 'react-router';

import Nav from '../components/common/Nav';
import ConfirmDialog from '../components/common/ConfirmDialog';
import actions from '../actions';
import {getUser, BattleModel} from '../store';
import redirect from '../lib/redirect';
import {createGame, dismissGame} from '../api/create_game';
import {fetchPuzzleInfo} from '../api/puzzle';
import {fetchGameProgress} from '../api/game_progress';
import AuthContext from '../lib/AuthContext';

import withRouter from '../lib/withRouter';

class Play extends Component {
  static contextType = AuthContext;
  constructor() {
    super();
    this.state = {
      userHistory: null,
      creating: false,
      puzzleInfo: null,
      abandonGid: null,
      gameProgress: {},
    };
    this._handleNewGame = this.create.bind(this);
    this._handleNewFencingGame = this.createFencing.bind(this);
    this._handleAbandonClick = this.handleAbandonClick.bind(this);
    this._handleAbandonConfirm = this.confirmAbandon.bind(this);
    this._handleAbandonClose = this.closeAbandon.bind(this);
  }

  componentDidMount() {
    this.user = getUser();
    this.user.onAuth(() => {
      this.user.listUserHistory().then((userHistory) => {
        this.setState({userHistory: userHistory || {}});
        this.fetchProgress(userHistory || {});
      });
    });

    fetchPuzzleInfo(this.pid).then((info) => {
      if (info) this.setState({puzzleInfo: info});
    });

    if (this.query.mode === 'battle') {
      this.createAndJoinBattle();
    }
  }

  get pid() {
    return Number(this.props.match.params.pid);
  }

  get query() {
    return qs.parse(this.props.location.search.slice(1));
  }

  get is_fencing() {
    return !!this.query.fencing;
  }

  get is_new() {
    return !!this.query.new;
  }

  componentDidUpdate() {
    if (this.query.mode === 'battle') {
      return;
    }

    const {games} = this;
    if (!games) return; // history not loaded yet
    const shouldAutocreate = !this.state.creating && (games.length === 0 || this.is_new || this.is_fencing);
    if (shouldAutocreate) {
      this.create();
      return;
    }
    const shouldAutojoin = games && games.length === 1 && !this.state.creating;
    if (shouldAutojoin) {
      const {gid} = games[0];
      const {v2} = games[0];
      let href;
      if (!v2) {
        href = `/game/${gid}`;
      } else if (this.is_fencing) {
        href = `/fencing/${gid}`;
      } else {
        href = `/beta/game/${gid}`;
      }

      redirect(href, null);
    }
  }

  get games() {
    const {userHistory} = this.state;
    if (!userHistory) {
      return null;
    }

    return _.keys(userHistory)
      .filter((gid) => userHistory[gid].pid === this.pid)
      .map((gid) => ({
        ...userHistory[gid],
        gid,
      }));
  }

  create() {
    this.setState({
      creating: true,
    });
    actions.getNextGid(async (gid) => {
      await createGame({gid, pid: this.pid});
      await this.user.joinGame(gid, {
        pid: this.pid,
        solved: false,
        v2: true,
      });
      redirect(this.is_fencing ? `/fencing/${gid}` : `/beta/game/${gid}`);
    });
  }

  createFencing() {
    this.setState({creating: true});
    actions.getNextGid(async (gid) => {
      await createGame({gid, pid: this.pid});
      await this.user.joinGame(gid, {
        pid: this.pid,
        solved: false,
        v2: true,
      });
      redirect(`/fencing/${gid}`);
    });
  }

  handleAbandonClick(e) {
    this.setState({abandonGid: e.currentTarget.dataset.gid});
  }

  closeAbandon() {
    this.setState({abandonGid: null});
  }

  async confirmAbandon() {
    const {abandonGid} = this.state;
    if (!abandonGid) return;
    const accessToken = this.context?.accessToken;
    if (accessToken) {
      // Authenticated: use per-user Postgres dismissal (reversible)
      await dismissGame(abandonGid, accessToken);
    }
    // Always remove from Firebase history so the Play page updates
    await this.user.removeGame(abandonGid);
    const userHistory = await this.user.listUserHistory();
    this.setState({userHistory: userHistory || {}, abandonGid: null});
  }

  fetchProgress(userHistory) {
    const pid = this.pid;
    const inProgressGids = _.keys(userHistory).filter(
      (gid) => userHistory[gid].pid === pid && !userHistory[gid].solved
    );
    if (inProgressGids.length === 0) return;
    fetchGameProgress(inProgressGids).then((progress) => {
      this.setState({gameProgress: progress});
    });
  }

  createAndJoinBattle() {
    actions.getNextBid((bid) => {
      const battle = new BattleModel(`/battle/${bid}`);
      battle.initialize(this.pid, bid);
      battle.once('ready', () => {
        redirect(`/beta/battle/${bid}`);
      });
    });
  }

  renderMain() {
    if (this.state.creating) {
      return <div className="play">Creating game...</div>;
    }

    if (!this.games) {
      return <div className="play">Loading...</div>;
    }

    const sortedGames = _.sortBy(this.games, (g) => -(g.time || 0));

    return (
      <div className="play">
        <div className="play--title">Your Games</div>
        {this.state.puzzleInfo && (
          <div className="play--puzzle-info">
            {this.state.puzzleInfo.title && (
              <div className="play--puzzle-title">{this.state.puzzleInfo.title}</div>
            )}
            {this.state.puzzleInfo.author && (
              <div className="play--puzzle-author">{this.state.puzzleInfo.author}</div>
            )}
          </div>
        )}
        <table className="play--table">
          <tbody>
            {sortedGames.map(({gid, time, v2, solved}) => {
              let href;
              if (!v2) {
                href = `/game/${gid}`;
              } else if (this.is_fencing) {
                href = `/fencing/${gid}`;
              } else {
                href = `/beta/game/${gid}`;
              }
              let statusLabel = 'In progress';
              if (solved) {
                statusLabel = 'Solved';
              } else if (this.state.gameProgress[gid] != null) {
                statusLabel = `${this.state.gameProgress[gid]}%`;
              }
              return (
                <tr key={gid}>
                  <td className="play--date">{formatTimestamp(time)}</td>
                  <td>
                    <Link to={href}>Game {gid}</Link>
                  </td>
                  <td>
                    <span className={`play--status${solved ? '' : ' play--status-inprogress'}`}>
                      {statusLabel}
                    </span>
                  </td>
                  <td>
                    {!solved && (
                      <button
                        className="play--abandon"
                        title="Remove this game"
                        data-gid={gid}
                        onClick={this._handleAbandonClick}
                      >
                        &times;
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="play--actions">
          <button className="btn btn--contained btn--primary" onClick={this._handleNewGame}>
            Start a new game
          </button>
          <button className="btn btn--contained" onClick={this._handleNewFencingGame}>
            Start Fencing Game
          </button>
        </div>
      </div>
    );
  }

  render() {
    return (
      <div>
        <Helmet>
          <title>
            {this.state.puzzleInfo?.title
              ? `${this.state.puzzleInfo.title} - Cross with Friends`
              : 'Play - Cross with Friends'}
          </title>
        </Helmet>
        <Nav />
        {this.renderMain()}
        <ConfirmDialog
          open={!!this.state.abandonGid}
          onOpenChange={this._handleAbandonClose}
          title="Remove game?"
          confirmLabel="Remove"
          danger
          onConfirm={this._handleAbandonConfirm}
        >
          This will remove the game from your list. You can rejoin later if you have the link.
        </ConfirmDialog>
      </div>
    );
  }
}

export default withRouter(Play);

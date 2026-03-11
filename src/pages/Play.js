import './css/play.css';

import {Component} from 'react';
import {Helmet} from 'react-helmet-async';
import _ from 'lodash';
import qs from 'qs';
import {formatTimestamp} from '../lib/formatTimestamp';
import {Link} from 'react-router';

import * as Sentry from '@sentry/react';
import Nav from '../components/common/Nav';
import ConfirmDialog from '../components/common/ConfirmDialog';
import actions from '../actions';
import redirect from '../lib/redirect';
import {createGame, dismissGame} from '../api/create_game';
import {fetchPuzzleInfo} from '../api/puzzle';
import {fetchUserGames} from '../api/user_games';
import getLocalId from '../localAuth';
import AuthContext from '../lib/AuthContext';

import withRouter from '../lib/withRouter';

class Play extends Component {
  static contextType = AuthContext;
  constructor() {
    super();
    this.state = {
      games: null,
      creating: false,
      puzzleInfo: null,
      abandonGid: null,
      error: null,
    };
    this._handleNewGame = this.create.bind(this);
    this._handleNewFencingGame = this.createFencing.bind(this);
    this._handleAbandonClick = this.handleAbandonClick.bind(this);
    this._handleAbandonConfirm = this.confirmAbandon.bind(this);
    this._handleAbandonClose = this.closeAbandon.bind(this);
  }

  componentDidMount() {
    this._lastAccessToken = this.context?.accessToken ?? null;
    this.loadGames();

    fetchPuzzleInfo(this.pid).then((info) => {
      if (info) this.setState({puzzleInfo: info});
    });
  }

  async loadGames() {
    const accessToken = this.context?.accessToken;
    const dfacId = getLocalId();
    const games = await fetchUserGames(this.pid, accessToken, dfacId);
    this.setState({games});
  }

  get pid() {
    return this.props.match.params.pid;
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
    // Re-fetch when auth context hydrates after mount
    const currentToken = this.context?.accessToken ?? null;
    if (currentToken !== this._lastAccessToken) {
      this._lastAccessToken = currentToken;
      this.loadGames();
    }

    const {games} = this.state;
    if (!games) return; // not loaded yet
    const shouldAutocreate =
      !this.state.creating && !this.state.error && (games.length === 0 || this.is_new || this.is_fencing);
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

  create() {
    this.setState({creating: true, error: null});
    actions.getNextGid(async (gid) => {
      try {
        await createGame({gid, pid: this.pid});
        redirect(this.is_fencing ? `/fencing/${gid}` : `/beta/game/${gid}`);
      } catch (e) {
        console.error('Failed to create game:', e);
        Sentry.captureException(e);
        this.setState({creating: false, error: e.message || 'Failed to create game'});
      }
    });
  }

  createFencing() {
    this.setState({creating: true, error: null});
    actions.getNextGid(async (gid) => {
      try {
        await createGame({gid, pid: this.pid});
        redirect(`/fencing/${gid}`);
      } catch (e) {
        console.error('Failed to create fencing game:', e);
        Sentry.captureException(e);
        this.setState({creating: false, error: e.message || 'Failed to create game'});
      }
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
      await dismissGame(abandonGid, accessToken);
    }
    // Re-fetch games from API (dismissed games are excluded server-side for auth'd users)
    // For guests, the game will still appear since there's no server-side dismissal
    await this.loadGames();
    this.setState({abandonGid: null});
  }

  renderMain() {
    if (this.state.error) {
      return (
        <div className="play">
          <div style={{color: '#e74c3c', marginBottom: 16}}>
            <strong>Error:</strong> {this.state.error}
          </div>
          <Link className="btn btn--contained btn--primary" to="/">
            Back to Home
          </Link>
        </div>
      );
    }

    if (this.state.creating) {
      return <div className="play">Creating game...</div>;
    }

    if (!this.state.games) {
      return <div className="play">Loading...</div>;
    }

    const sortedGames = _.sortBy(this.state.games, (g) => -(g.time || 0));

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
            {sortedGames.map(({gid, time, v2, solved, percentComplete}) => {
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
              } else if (percentComplete != null && percentComplete > 0) {
                statusLabel = `${percentComplete}%`;
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

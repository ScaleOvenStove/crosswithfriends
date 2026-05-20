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
import {fetchPuzzleInfo, fetchPuzzleStats} from '../api/puzzle';
import {fetchUserGames} from '../api/user_games';
import {formatMilliseconds} from '../components/Toolbar/Clock';
import getLocalId from '../localAuth';
import AuthContext from '../lib/AuthContext';

import withRouter from '../lib/withRouter';

function describeGameError(e) {
  const msg = e?.message || '';
  if (msg.includes('Server error')) {
    return 'The server returned an error. Please try again in a moment.';
  }
  if (e?.name === 'TypeError' || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'Unable to reach the server. This may be caused by a browser extension, firewall, or network issue. Try disabling ad blockers or VPNs and refreshing.';
  }
  return 'Unable to create game. Please check your connection and try again.';
}

class Play extends Component {
  static contextType = AuthContext;
  constructor() {
    super();
    this.state = {
      games: null,
      creating: false,
      puzzleInfo: null,
      puzzleStats: null,
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
    this._lastAuthLoading = this.context?.loading ?? true;

    // AuthContext is async on page load (it refreshes the access token before
    // exposing the session). If we read context here and it's still loading,
    // accessToken is null and a logged-in user looks like a guest. Fetching
    // games with no token returns only games matching the local dfac_id —
    // which can be empty if the user solved on another device — and the
    // autocreate path below would then spawn a fresh empty game per visit
    // (see "blank in-progress games" reports). Defer the initial fetch until
    // auth has resolved.
    if (!this._lastAuthLoading) {
      this.loadGames();
    }

    fetchPuzzleInfo(this.pid).then((info) => {
      if (info) this.setState({puzzleInfo: info});
    });

    fetchPuzzleStats(this.pid).then((stats) => {
      if (stats) this.setState({puzzleStats: stats});
    });
  }

  async loadGames(skipCache = false) {
    try {
      const accessToken = this.context?.accessToken;
      const dfacId = getLocalId();
      let games = await fetchUserGames(this.pid, accessToken, dfacId, skipCache);
      if (!accessToken) {
        try {
          const guestDismissed = JSON.parse(localStorage.getItem('cwf:guest_dismissed_games') || '[]');
          games = games.filter((g) => !guestDismissed.includes(g.gid));
        } catch (err) {
          console.warn('Failed to parse guest dismissed games:', err);
        }
      }
      this.setState({games});
    } catch (e) {
      console.warn('Failed to load games:', e);
      this.setState({error: 'Unable to load games. Please check your connection and try again.'});
    }
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
    const currentToken = this.context?.accessToken ?? null;
    const currentLoading = this.context?.loading ?? true;

    // While auth is still resolving, don't fetch games or decide on
    // autocreate/autojoin — see the comment in componentDidMount.
    if (currentLoading) {
      this._lastAuthLoading = true;
      return;
    }

    // First update after auth resolves: kick off the initial fetch with the
    // correct token, then wait for it to land before any autocreate decision.
    if (this._lastAuthLoading) {
      this._lastAuthLoading = false;
      this._lastAccessToken = currentToken;
      this.loadGames();
      return;
    }

    // Re-fetch when the token changes after the initial load (login/logout).
    if (currentToken !== this._lastAccessToken) {
      this._lastAccessToken = currentToken;
      this.loadGames();
      return;
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
    const accessToken = this.context?.accessToken ?? null;
    actions
      .getNextGid(async (gid) => {
        try {
          await createGame({gid, pid: this.pid, dfac_id: getLocalId()}, accessToken);
          redirect(this.is_fencing ? `/fencing/${gid}` : `/beta/game/${gid}`);
        } catch (e) {
          console.error('Failed to create game:', e);
          Sentry.captureException(e);
          this.setState({creating: false, error: e.message || 'Failed to create game'});
        }
      })
      .catch((e) => {
        Sentry.captureException(e, {extra: {phase: 'getNextGid', pid: this.pid}});
        this.setState({creating: false, error: describeGameError(e)});
      });
  }

  createFencing() {
    this.setState({creating: true, error: null});
    const accessToken = this.context?.accessToken ?? null;
    actions
      .getNextGid(async (gid) => {
        try {
          await createGame({gid, pid: this.pid, dfac_id: getLocalId()}, accessToken);
          redirect(`/fencing/${gid}`);
        } catch (e) {
          console.error('Failed to create fencing game:', e);
          Sentry.captureException(e);
          this.setState({creating: false, error: e.message || 'Failed to create game'});
        }
      })
      .catch((e) => {
        Sentry.captureException(e, {extra: {phase: 'getNextGid', pid: this.pid}});
        this.setState({creating: false, error: describeGameError(e)});
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
    const priorGames = this.state.games;

    if (priorGames) {
      this.setState({
        games: priorGames.filter((g) => g.gid !== abandonGid),
      });
    }

    try {
      if (accessToken) {
        await dismissGame(abandonGid, accessToken);
      } else {
        try {
          const guestDismissed = JSON.parse(localStorage.getItem('cwf:guest_dismissed_games') || '[]');
          if (!guestDismissed.includes(abandonGid)) {
            guestDismissed.push(abandonGid);
            localStorage.setItem('cwf:guest_dismissed_games', JSON.stringify(guestDismissed));
          }
        } catch (err) {
          console.warn('Failed to store guest dismissed game:', err);
        }
      }
      await this.loadGames(true);
    } catch (err) {
      console.warn('Failed to abandon game:', err);
      Sentry.captureException(err, {extra: {phase: 'confirmAbandon', gid: abandonGid}});
      if (priorGames) this.setState({games: priorGames});
    } finally {
      this.setState({abandonGid: null});
    }
  }

  renderMain() {
    if (this.state.error) {
      return (
        <div className="play">
          <div className="play--error-message">
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
            {(this.state.puzzleInfo.titleOverride || this.state.puzzleInfo.title) && (
              <div className="play--puzzle-title">
                {this.state.puzzleInfo.titleOverride || this.state.puzzleInfo.title}
              </div>
            )}
            {(this.state.puzzleInfo.authorOverride || this.state.puzzleInfo.author) && (
              <div className="play--puzzle-author">
                {this.state.puzzleInfo.authorOverride || this.state.puzzleInfo.author}
              </div>
            )}
            {(this.state.puzzleInfo.titleOverride || this.state.puzzleInfo.authorOverride) && (
              <div className="play--puzzle-original">
                Originally: {this.state.puzzleInfo.title}
                {this.state.puzzleInfo.authorOverride ? ` by ${this.state.puzzleInfo.author}` : ''}
              </div>
            )}
            {this.state.puzzleStats && this.state.puzzleStats.medianMs != null && (
              <div className="play--puzzle-stats">
                Typical solve time: {formatMilliseconds(this.state.puzzleStats.medianMs)} (
                {this.state.puzzleStats.sampleCount} solves)
              </div>
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
            {this.state.puzzleInfo?.titleOverride || this.state.puzzleInfo?.title
              ? `${this.state.puzzleInfo.titleOverride || this.state.puzzleInfo.title} - Cross with Friends`
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

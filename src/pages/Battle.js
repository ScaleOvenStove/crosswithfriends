import './css/battle.css';

import {Component} from 'react';
import _ from 'lodash';
import {Helmet} from 'react-helmet-async';

import clsx from 'clsx';
import {BattleModel} from '../store';
import redirect from '../lib/redirect';
import {isMobile} from '../lib/jsUtils';

function renderPlayer(player, idx) {
  return (
    <div className="flex battle--player" key={idx}>
      {' '}
      {player.name}{' '}
    </div>
  );
}

function renderTeam(team, idx) {
  return (
    <div className="flex battle--team" key={idx}>
      <div className="flex battle--team-name">
        {' '}
        Team
        {Number(idx) + 1}
      </div>
      {_.map(team, renderPlayer)}
    </div>
  );
}

import withRouter from '../lib/withRouter';

class Battle extends Component {
  constructor(props) {
    super(props);
    this.state = {
      bid: undefined,
      team: undefined,
      games: undefined,
      startedAt: undefined,
      redirecting: false,
      name: undefined,
      players: undefined,
    };
    this.mobile = isMobile();
  }

  componentDidMount() {
    this.initializeBattle();
    window.addEventListener('beforeunload', this.handleUnload);
  }

  componentDidUpdate() {
    if (
      this.state.startedAt &&
      this.state.team !== undefined &&
      this.state.games &&
      !this.state.redirecting
    ) {
      const self = this.state.games[this.state.team];

      this.setState({redirecting: true}, () => redirect(`/beta/game/${self}`));
    }
  }

  componentWillUnmount() {
    window.removeEventListener('beforeunload', this.handleUnload);
  }

  // ================
  // Getters

  get bid() {
    return Number(this.props.match.params.bid);
  }

  // ================

  initializeBattle() {
    if (this.battleModel) this.battleModel.detach();
    this.battleModel = new BattleModel(`/battle/${this.bid}`);
    this.battleModel.on('games', (games) => {
      this.setState({games});
    });
    this.battleModel.on('startedAt', (startedAt) => {
      this.setState({startedAt});
    });
    this.battleModel.on('players', (players) => {
      this.setState({players: _.values(players)});
    });
    this.battleModel.attach();
  }

  handleTeamSelect = (team) => {
    this.battleModel.addPlayer(this.state.name, team);
    this.setState({team});
  };

  handleChangeName = (name) => {
    localStorage.setItem(`battle_${this.state.bid}`, name);
    this.setState({name});
  };

  handleUnload = () => {
    if (this.state.name && _.isNumber(this.state.team) && !this.state.redirecting) {
      this.battleModel.removePlayer(this.state.name, this.state.team);
    }
  };

  handleSelectTeam0 = () => {
    if (this.state.name) this.handleTeamSelect(0);
  };

  handleSelectTeam1 = () => {
    if (this.state.name) this.handleTeamSelect(1);
  };

  handleNameInputChange = (event) => {
    this.handleChangeName(event.target.value);
  };

  handleStart = () => {
    this.battleModel.start();
  };

  // ================
  // Render Methods

  renderTeamSelector() {
    const disabled = !this.state.name; // both undefined & '' are falsy
    const buttonClass = clsx('battle--button', {
      disabled,
    });
    return (
      <div className="flex battle--selector">
        <div className="flex battle--buttons">
          <div
            className={`flex ${buttonClass}`}
            style={{justifyContent: 'center'}}
            role={disabled ? undefined : 'button'}
            tabIndex={disabled ? undefined : 0}
            onClick={disabled ? undefined : this.handleSelectTeam0}
            onKeyDown={disabled ? undefined : this.handleSelectTeam0}
          >
            Team 1
          </div>
          <div
            className={`flex ${buttonClass}`}
            style={{justifyContent: 'center'}}
            role={disabled ? undefined : 'button'}
            tabIndex={disabled ? undefined : 0}
            onClick={disabled ? undefined : this.handleSelectTeam1}
            onKeyDown={disabled ? undefined : this.handleSelectTeam1}
          >
            Team 2
          </div>
        </div>
        <div className="flex battle--name">
          <input className="battle--input" placeholder="Name..." onChange={this.handleNameInputChange} />
        </div>
        {this.renderTeams()}
      </div>
    );
  }

  renderTeams() {
    const numTeams = Math.max(_.max(_.map(this.state.players, 'team')), 2);
    const teams = _.map(_.range(numTeams), (team) => _.filter(this.state.players, {team}));

    return <div className="flex battle--teams">{_.map(teams, renderTeam)}</div>;
  }

  renderPreGameLobby() {
    return (
      <div className="flex battle--selector">
        <div className="flex battle--teams">(This starts the game for all players)</div>
        <div className="flex battle--buttons">
          <div
            className="flex battle--button"
            style={{justifyContent: 'center'}}
            role="button"
            tabIndex={0}
            onClick={this.handleStart}
            onKeyDown={this.handleStart}
          >
            Start
          </div>
        </div>
        {this.renderTeams()}
      </div>
    );
  }

  render() {
    return (
      <div
        className={`flex--column flex--grow ${clsx('battle', {mobile: this.mobile})}`}
        style={{
          width: '100%',
          height: '100%',
        }}
      >
        <Helmet>
          <title>Down For A Battle</title>
        </Helmet>
        <div className="flex flex--grow battle--main">
          <div className="flex--column flex--shrink-0">
            {!_.isNumber(this.state.team) && this.renderTeamSelector()}
            {_.isNumber(this.state.team) && !this.state.startedAt && this.renderPreGameLobby()}
          </div>
        </div>
      </div>
    );
  }
}

export default withRouter(Battle);

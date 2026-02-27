import './css/powerups.css';
import React from 'react';
import _ from 'lodash';
import Emoji from './Emoji';
import powerups, {hasExpired, inUse, timeLeft} from '../../lib/powerups';

export default class Powerups extends React.Component {
  constructor() {
    super();
    this.renderPowerup = this.renderPowerup.bind(this);
  }

  componentDidMount() {
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => this.forceUpdate(), 500);
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  handlePowerupClick = (e) => {
    const powerupType = e.currentTarget.getAttribute('data-powerup-type');
    if (!powerupType) return;
    const powerup = this.props.powerups.find((p) => p.type === powerupType);
    if (powerup && !inUse(powerup)) {
      this.props.handleUsePowerup(powerup);
    }
  };

  // TODO: forceUpdate to make sure hasExpired check clears powerups that time out.
  // Maybe by using a delay callback?
  renderPowerup(powerup, count) {
    if (hasExpired(powerup)) {
      return null;
    }
    const {type} = powerup;
    const {icon, name} = powerups[type];
    const inuse = inUse(powerup);
    const className = `powerups--emoji ${inuse ? 'powerups--in-use' : 'powerups--unused'}`;

    const secsLeft = timeLeft(powerup);
    const format = (x) => x.toString().padStart(2, '0');
    const timeMins = format(Math.floor(secsLeft / 60));
    const timeSecs = format(secsLeft % 60);

    return (
      <div
        key={type}
        className="flex--column powerups--powerup"
        style={{alignItems: 'center'}}
        data-powerup-type={inuse ? undefined : type}
        role={inuse ? undefined : 'button'}
        tabIndex={inuse ? undefined : 0}
        onClick={inuse ? undefined : this.handlePowerupClick}
        onKeyDown={inuse ? undefined : this.handlePowerupClick}
      >
        <div className="flex powerups--label">{name}</div>
        <div className={`flex ${className}`}>
          <div className="flex--column">
            <Emoji emoji={icon} big className="powerups--eemoji" />
            <div className="powerups--info" style={{opacity: inuse ? 1 : 0}}>
              {timeMins}:{timeSecs}
            </div>
          </div>
          {count > 1 && <div className="powerups--count">{count}</div>}
        </div>
      </div>
    );
  }

  render() {
    return (
      <div className="flex powerups--main">
        <div className="flex powerups--header">POWERUPS</div>
        {_.values(_.groupBy(this.props.powerups, 'type'))
          .map((powerupGroup) => powerupGroup.filter((powerup) => !hasExpired(powerup)))
          .map(
            (powerupGroup) =>
              // only render the first powerup of a given type
              powerupGroup.length > 0 && this.renderPowerup(powerupGroup[0], powerupGroup.length)
          )}
      </div>
    );
  }
}

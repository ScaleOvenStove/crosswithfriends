import './css/clock.css';
import {Component} from 'react';
import {FaPause, FaStopwatch} from 'react-icons/fa6';
import {MAX_CLOCK_INCREMENT} from '../../lib/timing';

export const formatMilliseconds = (ms) => {
  function pad2(num) {
    let s = `${100}${num}`;
    s = s.substr(s.length - 2);
    return s;
  }
  let secs = Math.floor(ms / 1000);
  let mins = Math.floor(secs / 60);
  secs %= 60;
  const hours = Math.floor(mins / 60);
  mins %= 60;

  return `${(hours ? `${hours}:` : '') + pad2(mins)}:${pad2(secs)}`;
};

export default class Clock extends Component {
  constructor() {
    super();
    this.state = {
      clock: '00:00',
    };
    this._togglePause = this.togglePause.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
  }

  _handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      this._togglePause();
    }
  }

  componentDidMount() {
    if (this.intvl) clearInterval(this.intvl);
    this.intvl = setInterval(this.updateClock.bind(this), 1000);
    this.updateClock();
  }

  componentWillUnmount() {
    clearInterval(this.intvl);
  }

  updateClock() {
    const {pausedTime} = this.props;
    const start = this.props.startTime;
    const stop = this.props.stopTime;
    const now = Date.now();

    let clock = 0; // start with pausedTime
    if (pausedTime) {
      clock += pausedTime;
    }

    if (start && !this.props.replayMode && !this.props.isPaused) {
      // not paused
      if (stop) {
        // finished
        clock += stop - start;
      } else if (this.isCapped) {
        clock += MAX_CLOCK_INCREMENT;
      } else {
        clock += now - start;
      }
    }

    this.setState({
      clock: formatMilliseconds(Math.max(0, clock)),
    });
  }

  get isCapped() {
    if (!this.props.v2) return false;
    const start = this.props.startTime;
    const now = Date.now();
    return now > start + MAX_CLOCK_INCREMENT;
  }

  get isSolved() {
    return !!this.props.solved;
  }

  get isPaused() {
    if (this.props.replayMode) return false;
    if (this.isSolved) return false;
    // to this component, there's no difference between capped & paused
    return this.props.isPaused || this.isCapped;
  }

  togglePause() {
    if (this.isSolved) return;
    const {onPause, onStart} = this.props;
    if (this.isPaused) {
      onStart();
    } else {
      onPause && onPause();
    }
  }

  render() {
    const {clock} = this.state;
    const solved = this.isSolved;
    const isPaused = this.isPaused;
    const StatusIcon = isPaused ? FaPause : FaStopwatch;
    // eslint-disable-next-line no-nested-ternary
    const titleStr = solved ? 'Solve time' : isPaused ? 'Click to unpause' : 'Click to pause';
    return (
      <div
        className={`clock${isPaused ? ' clock--paused' : ''}${solved ? ' clock--solved' : ''}`}
        onClick={this._togglePause}
        onKeyDown={this._handleKeyDown}
        role="button"
        tabIndex={0}
        title={titleStr}
        aria-pressed={isPaused}
      >
        <StatusIcon className="clock__icon" aria-hidden="true" />
        <span className="clock__value">{clock}</span>
      </div>
    );
  }
}

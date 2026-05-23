import {Component} from 'react';
import Confetti from 'react-confetti';
import jingleSound from '..//..//assets/cwfJingle.mp3';

const jingleAudio = new Audio(jingleSound);

function soundEnabled() {
  try {
    const stored = localStorage.getItem('sound');
    if (stored == null) return true;
    return JSON.parse(stored) !== false;
  } catch {
    return true;
  }
}

export default class ConfettiWrapper extends Component {
  constructor() {
    super();
    this.state = {
      done: false,
      numberOfPieces: 200,
    };
    this.handleConfettiComplete = this.handleConfettiComplete.bind(this);
  }

  componentDidMount() {
    setTimeout(() => {
      this.setState({
        numberOfPieces: 0,
      });
    }, 7000);
    if (!soundEnabled()) return;
    if (jingleAudio.readyState > 0) {
      jingleAudio.currentTime = 0;
    }
    // Mobile browsers (notably iOS Safari) reject audio.play() if the page
    // hasn't received a user-gesture interaction yet — solving a puzzle via
    // autoplay or programmatic reveal counts as "no interaction" by some
    // engines. Swallow the rejection rather than logging: the catch was
    // ending up in Sentry via the console-error integration, masquerading
    // as a real bug.
    jingleAudio.play().catch(() => {});
  }

  handleConfettiComplete() {
    this.setState({done: true});
  }

  render() {
    if (this.state.done) return null;
    return (
      <Confetti numberOfPieces={this.state.numberOfPieces} onConfettiComplete={this.handleConfettiComplete} />
    );
  }
}

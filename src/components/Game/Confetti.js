import React, {Component} from 'react';
import Confetti from 'react-confetti';

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

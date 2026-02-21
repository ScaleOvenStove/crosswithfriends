import './css/Popup.css';
import React, {Component} from 'react';

/*
 * Summary of Popup component
 *
 * Props: { icon, label, onBlur }
 *
 * State: { active }
 *
 * Potential parents (so far):
 * - Toolbar
 * */

function handleMouseDown(e) {
  e.preventDefault();
}

export default class Popup extends Component {
  constructor() {
    super();
    this.state = {
      active: false,
    };
    this.handleClick = this.handleClick.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
  }

  handleClick() {
    this.setState((prevState) => ({active: !prevState.active}));
  }

  handleBlur() {
    this.setState({active: false});
    this.props.onBlur();
  }

  render() {
    return (
      <div className={`${this.state.active ? 'active ' : ''}popup-menu`} onBlur={this.handleBlur}>
        <button
          tabIndex={-1}
          className={`popup-menu--button fa ${this.props.icon ? this.props.icon : ''}`}
          onMouseDown={handleMouseDown}
          onClick={this.handleClick}
        >
          {this.props.label ? this.props.label : ''}
        </button>
        <div className="popup-menu--content">{this.props.children}</div>
      </div>
    );
  }
}

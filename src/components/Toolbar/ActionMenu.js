import './css/ActionMenu.css';
import React, {Component} from 'react';
import {findDOMNode} from 'react-dom';

/*
 * Summary of ActionMenu component
 *
 * Props: { grid, clues }
 *
 * State: { selected, direction }
 *
 * Children: [ GridControls, Grid, Clues ]
 * - GridControls.props:
 *   - attributes: { selected, direction, grid, clues }
 *   - callbacks: { setSelected, setDirection }
 * - Grid.props:
 *   - attributes: { grid, selected, direction }
 *   - callbacks: { setSelected, changeDirection }
 * - Clues.props:
 *   - attributes: { getClueList() }
 *   - callbacks: { selectClue }
 *
 * Potential parents (so far):
 * - Toolbar
 * */

export default class ActionMenu extends Component {
  containerRef = React.createRef();

  constructor() {
    super();
    this.state = {
      active: false,
    };
    this._onClick = this.onClick.bind(this);
    this._onBlur = this.onBlur.bind(this);
  }

  handlePointerDown = (e) => {
    // eslint-disable-next-line react/no-find-dom-node
    const refNode = findDOMNode(this.containerRef.current);
    if (refNode?.contains(e.target)) {
      return;
    }
    this.setState({active: false});
  };

  static onButtonMouseDown(e) {
    e.preventDefault();
  }

  onClick() {
    this.setState(
      (prevState) => ({active: !prevState.active}),
      () => {
        if (this.state.active) {
          window.addEventListener('pointerdown', this.handlePointerDown);
        } else {
          window.removeEventListener('pointerdown', this.handlePointerDown);
        }
      }
    );
  }

  onBlur() {
    this.setState({active: false});
    this.props.onBlur();
  }

  handleAction = (ev) => {
    ev.preventDefault();
    const actionKey = ev.currentTarget.dataset.actionKey;
    this.props.actions[actionKey]();
    this.onBlur();
    this.setState({active: false});
  };

  render() {
    return (
      <div
        ref={this.containerRef}
        className={`${this.state.active ? 'active ' : ''}action-menu`}
        onBlur={this._onBlur}
      >
        <button
          tabIndex={-1}
          className="action-menu--button"
          onMouseDown={ActionMenu.onButtonMouseDown}
          onClick={this._onClick}
        >
          {this.props.label}
        </button>
        <div className="action-menu--list">
          {Object.keys(this.props.actions).map((key) => (
            <div
              key={key}
              role="button"
              tabIndex={0}
              className="action-menu--list--action"
              data-action-key={key}
              onMouseDown={this.handleAction}
              onTouchStart={this.handleAction}
            >
              <span> {key} </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
}

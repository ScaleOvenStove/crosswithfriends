import './css/ActionMenu.css';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {Component} from 'react';

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
  shouldRefocusGrid = false;

  handleActionSelect = (event) => {
    const actionKey = event.currentTarget.dataset.actionKey;
    this.shouldRefocusGrid = true;
    this.props.actions[actionKey]();
  };

  handleCloseAutoFocus = (event) => {
    if (!this.shouldRefocusGrid) {
      return;
    }

    event.preventDefault();
    this.shouldRefocusGrid = false;
    this.props.onBlur();
  };

  handleEscapeKeyDown = () => {
    this.shouldRefocusGrid = true;
  };

  handleInteractOutside = () => {
    this.shouldRefocusGrid = false;
  };

  render() {
    return (
      <DropdownMenu.Root>
        <div className="action-menu">
          <DropdownMenu.Trigger asChild>
            <button type="button" tabIndex={-1} className="action-menu--button">
              {this.props.label}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="action-menu--list"
              align="start"
              side="bottom"
              sideOffset={4}
              collisionPadding={8}
              onCloseAutoFocus={this.handleCloseAutoFocus}
              onEscapeKeyDown={this.handleEscapeKeyDown}
              onInteractOutside={this.handleInteractOutside}
            >
              {Object.keys(this.props.actions).map((key) => (
                <DropdownMenu.Item
                  key={key}
                  className="action-menu--list--action"
                  data-action-key={key}
                  onSelect={this.handleActionSelect}
                >
                  <span>{key}</span>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </div>
      </DropdownMenu.Root>
    );
  }
}

import './css/ActionMenu.css';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {Component} from 'react';
import {MdLock} from 'react-icons/md';
import InfoDialog from '../common/InfoDialog';

// Prevent the grid from losing focus when clicking the restricted button —
// matches the behavior of the normal action menus.
function preventMouseDownDefault(e) {
  e.preventDefault();
}

export default class ActionMenu extends Component {
  state = {showRestrictedInfo: false};

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

  handleOpenRestrictedInfo = () => {
    this.setState({showRestrictedInfo: true});
  };

  handleRestrictedInfoChange = (open) => {
    this.setState({showRestrictedInfo: open});
  };

  render() {
    // Disabled state: render a button that looks disabled (greyed + lock
    // glyph) but is actually clickable — click opens an explainer dialog
    // so non-owner players know why the menu doesn't work. The whole
    // action is gated together (matches the server-side restriction
    // shape — one toggle covers Square/Word/Puzzle).
    if (this.props.disabled) {
      const {disabledTitle, disabledExplainer, label} = this.props;
      return (
        <div className="action-menu">
          <button
            type="button"
            tabIndex={-1}
            className="action-menu--button action-menu--button-restricted"
            title={disabledTitle}
            onClick={this.handleOpenRestrictedInfo}
            onMouseDown={preventMouseDownDefault}
          >
            <MdLock className="action-menu--lock-icon" aria-hidden="true" />
            {label}
          </button>
          <InfoDialog
            open={this.state.showRestrictedInfo}
            onOpenChange={this.handleRestrictedInfoChange}
            title={`${label} is restricted`}
            icon={<MdLock />}
          >
            {disabledExplainer || <p>{disabledTitle}</p>}
          </InfoDialog>
        </div>
      );
    }
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

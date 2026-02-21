import './css/index.css';
import React, {Component} from 'react';
import {MdBorderAll, MdChatBubble, MdList, MdSlowMotionVideo} from 'react-icons/md';
import {AiOutlineMenuFold, AiOutlineMenuUnfold} from 'react-icons/ai';
import {RiPaintFill, RiPaintLine} from 'react-icons/ri';
import Flex from 'react-flexview';
import {Link} from 'react-router-dom';
import swal from '@sweetalert/with-react';
import Clock from './Clock';
import ActionMenu from './ActionMenu';
import Popup from './Popup';
import {isMobile} from '../../lib/jsUtils';

const pencilColorKey = 'pencil-color';

function handleMouseDown(e) {
  e.preventDefault();
}

function handleStopPropagation(e) {
  e.stopPropagation();
}

function handleKeyDown(callback) {
  return (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      callback(e);
    }
  };
}

function handlePencilColorPickerChange(e) {
  const color = e.target.value;
  document.documentElement.style.setProperty('--pencil-color', color);
  localStorage.setItem(pencilColorKey, color);
}

function confirmResetPuzzle(callback) {
  swal({
    title: `Are you sure you want to reset the entire puzzle?`,
    icon: 'warning',
    buttons: true,
    dangerMode: true,
  }).then((confirmed) => {
    if (confirmed) {
      callback();
    }
  });
}

export default class Toolbar extends Component {
  // eslint-disable-next-line class-methods-use-this
  componentDidMount() {
    document.documentElement.style.setProperty(
      '--pencil-color',
      localStorage.getItem(pencilColorKey) || '#888888'
    );
  }

  handleBlur = () => {
    this.props.onRefocus();
  };

  handlePencilColorPickerRef = (input) => {
    this.pencilColorPicker = input;
  };

  handlePencilClick = (e) => {
    e.preventDefault();
    this.props.onTogglePencil();
  };

  handlePencilColorPickerClick = (e) => {
    e.stopPropagation();
    let hexColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--pencil-color')
      .trim()
      .substring(1);
    if (hexColor.length === 3) {
      hexColor = hexColor
        .split('')
        .map((hex) => hex + hex)
        .join('');
    }
    this.pencilColorPicker.value = `#${hexColor}`;
    this.pencilColorPicker.click();
  };

  handleAutocheckClick = (e) => {
    e.preventDefault();
    this.props.onToggleAutocheck();
  };

  handleToggleListView = (e) => {
    e.preventDefault();
    this.props.onToggleListView();
  };

  handleToggleChat = (e) => {
    e.preventDefault();
    this.props.onToggleChat();
  };

  handleToggleExpandMenu = (e) => {
    e.preventDefault();
    this.props.onToggleExpandMenu();
  };

  renderClockControl() {
    const {startTime, onStartClock, onPauseClock} = this.props;
    return startTime ? (
      <button
        className="toolbar--btn pause"
        tabIndex={-1}
        onMouseDown={handleMouseDown}
        onClick={onPauseClock}
      >
        Pause Clock
      </button>
    ) : (
      <button
        className="toolbar--btn start"
        tabIndex={-1}
        onMouseDown={handleMouseDown}
        onClick={onStartClock}
      >
        Start Clock
      </button>
    );
  }

  renderCheckMenu() {
    return (
      <div className="toolbar--menu check">
        <ActionMenu
          label="Check"
          onBlur={this.handleBlur}
          actions={{
            Square: this.check.bind(this, 'square'),
            Word: this.check.bind(this, 'word'),
            Puzzle: this.check.bind(this, 'puzzle'),
          }}
        />
      </div>
    );
  }

  renderRevealMenu() {
    return (
      <div className="toolbar--menu reveal">
        <ActionMenu
          label="Reveal"
          onBlur={this.handleBlur}
          actions={{
            Square: this.reveal.bind(this, 'square'),
            Word: this.reveal.bind(this, 'word'),
            Puzzle: this.reveal.bind(this, 'puzzle'),
          }}
        />
      </div>
    );
  }

  renderResetMenu() {
    return (
      <ActionMenu
        label="Reset"
        onBlur={this.handleBlur}
        actions={{
          Square: this.reset.bind(this, 'square'),
          Word: this.reset.bind(this, 'word'),
          Puzzle: confirmResetPuzzle.bind(this, () => this.reset('puzzle')),
          'Puzzle and Timer': this.resetPuzzleAndTimer.bind(this),
        }}
      />
    );
  }

  handleVimModeClick = () => {
    this.props.onToggleVimMode();
  };

  handleSkipFilledSquaresClick = () => {
    this.props.onToggleSkipFilledSquares();
  };

  renderExtrasMenu() {
    const {vimMode, onToggleColorAttributionMode, skipFilledSquares} = this.props;
    const vimModeLabel = vimMode ? 'Disable Vim Mode' : 'Enable Vim Mode';
    const skipFilledSquaresLabel = skipFilledSquares ? "Don't skip filled squares" : 'Skip filled squares';
    return (
      <ActionMenu
        label="Extras"
        onBlur={this.handleBlur}
        actions={{
          [vimModeLabel]: this.handleVimModeClick,
          [skipFilledSquaresLabel]: this.handleSkipFilledSquaresClick,
          'Color Attribution': onToggleColorAttributionMode,
          'List View': this.props.onToggleListView,
          Pencil: this.props.onTogglePencil,
          Autocheck: this.props.onToggleAutocheck,
          'Create new game link': () => window.open(`/beta/play/${this.props.pid}?new=1`, '_blank'),
        }}
      />
    );
  }

  renderPlayAgainLink() {
    return (
      <ActionMenu
        label="Play Again"
        onBlur={this.handleBlur}
        actions={{
          'Reset this game': confirmResetPuzzle.bind(this, () => {
            this.reset('puzzle', true);
            this.props.onResetClock();
          }),
          'Create new game link': () => window.open(`/beta/play/${this.props.pid}?new=1`, '_blank'),
        }}
      />
    );
  }

  renderReplayLink() {
    const replayLink = `/beta/replay/${this.props.gid}`;
    return (
      <a
        className="toolbar--replay-link"
        title="Open Replay"
        href={replayLink}
        target="_blank"
        rel="noreferrer"
      >
        <MdSlowMotionVideo />
      </a>
    );
  }

  renderColorAttributionToggle() {
    const {colorAttributionMode, onToggleColorAttributionMode} = this.props;
    if (isMobile()) {
      return (
        <div
          className="toolbar--color-attribution-toggle"
          title="Color Attribution"
          role="button"
          tabIndex={0}
          onClick={onToggleColorAttributionMode}
          onKeyDown={handleKeyDown(onToggleColorAttributionMode)}
        >
          {colorAttributionMode ? <RiPaintFill /> : <RiPaintLine />}
        </div>
      );
    }
    return (
      <div
        className={`toolbar--color-attribution-toggle${colorAttributionMode ? ' on' : ''}`}
        title="Color Attribution"
        role="button"
        tabIndex={0}
        onClick={onToggleColorAttributionMode}
        onKeyDown={handleKeyDown(onToggleColorAttributionMode)}
      >
        <RiPaintFill />
      </div>
    );
  }

  renderListViewButton() {
    const {listMode, mobile} = this.props;
    if (mobile) {
      if (listMode) {
        return (
          <MdBorderAll
            onClick={this.handleToggleListView}
            className={`toolbar--list-view${listMode ? ' on' : ''}`}
          />
        );
      }
      return (
        <MdList
          onClick={this.handleToggleListView}
          className={`toolbar--list-view${listMode ? ' on' : ''}`}
        />
      );
    }
    return (
      <div
        className={`toolbar--list-view${listMode ? ' on' : ''}`}
        role="button"
        tabIndex={0}
        onClick={this.handleToggleListView}
        onKeyDown={handleKeyDown(this.handleToggleListView)}
        onMouseDown={handleMouseDown}
        title="List View"
      >
        <i className="fa fa-list" />
      </div>
    );
  }

  renderChatButton() {
    return <MdChatBubble onClick={this.handleToggleChat} className="toolbar--chat" />;
  }

  renderExpandMenuButton() {
    const {expandMenu} = this.props;
    return expandMenu ? (
      <AiOutlineMenuFold onClick={this.handleToggleExpandMenu} />
    ) : (
      <AiOutlineMenuUnfold onClick={this.handleToggleExpandMenu} />
    );
  }

  renderPencil() {
    const {pencilMode} = this.props;
    return (
      <div
        className={`toolbar--pencil${pencilMode ? ' on' : ''}`}
        role="button"
        tabIndex={0}
        onClick={this.handlePencilClick}
        onKeyDown={handleKeyDown(this.handlePencilClick)}
        onMouseDown={handleMouseDown}
        title="Shortcut: ."
      >
        <i className="fa fa-pencil" />
        {pencilMode && (
          <div className="toolbar--pencil-color-picker-container">
            <div
              className="toolbar--pencil-color-picker"
              role="button"
              tabIndex={0}
              onClick={this.handlePencilColorPickerClick}
              onKeyDown={handleKeyDown(this.handlePencilColorPickerClick)}
            />
            <input
              type="color"
              ref={this.handlePencilColorPickerRef}
              onClick={handleStopPropagation}
              onChange={handlePencilColorPickerChange}
            />
          </div>
        )}
      </div>
    );
  }

  renderAutocheck() {
    const {autocheckMode} = this.props;
    return (
      <div
        className={`toolbar--autocheck${autocheckMode ? ' on' : ''}`}
        role="button"
        tabIndex={0}
        onClick={this.handleAutocheckClick}
        onKeyDown={handleKeyDown(this.handleAutocheckClick)}
        onMouseDown={handleMouseDown}
        title="Autocheck"
      >
        <i className="fa fa-check-square" />
      </div>
    );
  }

  renderInfo() {
    return (
      <div className="toolbar--info">
        <Popup icon="fa-info-circle" onBlur={this.handleBlur}>
          <h3>How to Enter Answers</h3>
          <ul>
            <li>
              Click a cell once to enter an answer, and click that same cell again to switch between
              horizontal and vertical orientations
            </li>
            <li>Click the clues to move the cursor directly to the cell for that answer</li>
            <li>
              Hold down the <code>Shift</code> key to enter multiple characters for rebus answers
            </li>
          </ul>
          <h4>Basic Keyboard Shortcuts</h4>
          <table>
            <tbody>
              <tr>
                <th>Shortcut</th>
                <th>Description</th>
              </tr>
              <tr>
                <td>Letter / Number</td>
                <td>Fill in current cell and advance cursor to the next cell in the same word, if any</td>
              </tr>
              <tr>
                <td>
                  <code>.</code> (period)
                </td>
                <td>Toggle pencil mode on/off</td>
              </tr>
              <tr>
                <td>Arrow keys</td>
                <td>
                  Either move cursor along current orientation or change orientation without moving cursor
                </td>
              </tr>
              <tr>
                <td>Space bar</td>
                <td>Flip orientation between down/across</td>
              </tr>
              <tr>
                <td>
                  <code>Delete</code> or <code>Backspace</code>
                </td>
                <td>Clear current cell</td>
              </tr>
              <tr>
                <td>
                  <code>Alt</code> / <code>Option</code> + <code>S</code>, <code>W</code>, or <code>P</code>
                </td>
                <td>
                  Check <b>S</b>quare, <b>W</b>ord, or <b>P</b>uzzle
                </td>
              </tr>
              <tr>
                <td>
                  <code>Alt</code> / <code>Option</code> + <code>Shift</code> + <code>S</code>, <code>W</code>
                  , or <code>P</code>
                </td>
                <td>
                  Reveal <b>S</b>quare, <b>W</b>ord, or <b>P</b>uzzle
                </td>
              </tr>
            </tbody>
          </table>
          <h4>Advanced Keyboard Shortcuts</h4>
          <table>
            <tbody>
              <tr>
                <td>
                  <code>[</code> and <code>]</code> OR <code>Shift</code> with arrow keys
                </td>
                <td>Move cursor perpendicular to current orientation without changing orientation</td>
              </tr>
              <tr>
                <td>
                  <code>Tab</code> and <code>Shift+Tab</code>
                </td>
                <td>Move cursor to the next or previous clue</td>
              </tr>
              <tr>
                <td>
                  <code>Home</code> OR <code>End</code>
                </td>
                <td>Move cursor to the beginning or end of a clue</td>
              </tr>
            </tbody>
          </table>
        </Popup>
      </div>
    );
  }

  check(scopeString) {
    this.props.onCheck(scopeString);
  }

  reveal(scopeString) {
    swal({
      title: `Are you sure you want to show the ${scopeString}?`,
      text: `All players will be able to see the ${scopeString}'s answer.`,
      icon: 'warning',
      buttons: true,
      dangerMode: true,
    }).then((shouldReveal) => {
      if (shouldReveal) {
        this.props.onReveal(scopeString);
      }
    });
  }

  reset(scopeString, force = false) {
    this.props.onReset(scopeString, force);
  }

  keybind(mode) {
    this.props.onKeybind(mode);
  }

  resetPuzzleAndTimer() {
    confirmResetPuzzle(() => {
      this.reset('puzzle');
      this.props.onResetClock();
    });
  }

  renderSaveReplay() {
    const {onSaveReplay, replayRetained, savingReplay, isAuthenticated, solved} = this.props;
    if (!solved || !isAuthenticated || !onSaveReplay || replayRetained === null) return null;
    if (replayRetained) {
      return <span className="toolbar--replay-saved">Replay saved</span>;
    }
    return (
      <button
        className="toolbar--save-replay"
        onClick={onSaveReplay}
        disabled={savingReplay}
        onMouseDown={handleMouseDown}
      >
        {savingReplay ? 'Saving...' : 'Save Replay'}
      </button>
    );
  }

  renderMarkSolvedButton() {
    return (
      <button
        className="toolbar--mark-solved"
        onClick={this.props.onMarkSolved}
        onMouseDown={handleMouseDown}
      >
        Mark as Solved
      </button>
    );
  }

  renderUnmarkSolvedButton() {
    return (
      <button
        className="toolbar--unmark-solved"
        onClick={this.props.onUnmarkSolved}
        onMouseDown={handleMouseDown}
      >
        Unmark as Solved
      </button>
    );
  }

  render() {
    const {
      mobile,
      startTime,
      stopTime,
      pausedTime,
      onStartClock,
      onPauseClock,
      solved,
      contest,
      replayMode,
      expandMenu,
    } = this.props;

    if (mobile) {
      return (
        <Flex className="toolbar--mobile" vAlignContent="center">
          <Flex className="toolbar--mobile--top" grow={1} vAlignContent="center">
            <Link to="/">CWF</Link>{' '}
            {!expandMenu ? (
              <>
                <Clock
                  v2={this.props.v2}
                  startTime={startTime}
                  stopTime={stopTime}
                  pausedTime={pausedTime}
                  replayMode={replayMode}
                  isPaused={this.props.isPaused || !startTime}
                  onStart={onStartClock}
                  onPause={onPauseClock}
                />
                {!solved && !replayMode && !contest && this.renderCheckMenu()}
                {!solved && !replayMode && !contest && this.renderRevealMenu()}
                {!solved && !replayMode && contest && this.renderMarkSolvedButton()}
                {solved && !replayMode && contest && this.renderUnmarkSolvedButton()}
                {solved && !replayMode && this.renderReplayLink()}
                {solved && !replayMode && this.renderSaveReplay()}
              </>
            ) : (
              <>
                {!solved && !replayMode && this.renderResetMenu()}
                {solved && !replayMode && this.renderPlayAgainLink()}
                {this.renderColorAttributionToggle()}
                {this.renderListViewButton()}
                {this.renderAutocheck()}
                {this.renderChatButton()}
              </>
            )}
            {this.renderExpandMenuButton()}
          </Flex>
        </Flex>
      );
    }

    return (
      <div className="toolbar">
        <div className="toolbar--timer">
          <Clock
            v2={this.props.v2}
            replayMode={replayMode}
            startTime={startTime}
            stopTime={stopTime}
            pausedTime={pausedTime}
            isPaused={this.props.isPaused || !startTime}
            onStart={onStartClock}
            onPause={onPauseClock}
          />
        </div>
        {!solved && !replayMode && !contest && this.renderCheckMenu()}
        {!solved && !replayMode && !contest && this.renderRevealMenu()}
        {!solved && !replayMode && <div className="toolbar--menu reset">{this.renderResetMenu()}</div>}
        {!solved && !replayMode && contest && this.renderMarkSolvedButton()}
        {solved && !replayMode && contest && this.renderUnmarkSolvedButton()}
        {solved && !replayMode && this.renderReplayLink()}
        {solved && !replayMode && this.renderSaveReplay()}
        {this.renderColorAttributionToggle()}
        {this.renderListViewButton()}
        {!replayMode && this.renderPencil()}
        {!solved && !replayMode && !contest && this.renderAutocheck()}
        {!replayMode && this.renderExtrasMenu()}
        {solved && !replayMode && this.renderPlayAgainLink()}
        {!replayMode && this.renderInfo()}
      </div>
    );
  }
}

import './css/index.css';
import {Component} from 'react';
import {MdBorderAll, MdChatBubble, MdList, MdSlowMotionVideo, MdErrorOutline} from 'react-icons/md';
import {AiOutlineMenuFold, AiOutlineMenuUnfold} from 'react-icons/ai';
import {RiPaintFill, RiPaintLine} from 'react-icons/ri';
import {Link} from 'react-router-dom';
import Clock from './Clock';
import ConfirmDialog from '../common/ConfirmDialog';
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

export default class Toolbar extends Component {
  constructor(props) {
    super(props);
    this.state = {
      revealDialogOpen: false,
      revealScope: null,
      resetDialogOpen: false,
      resetCallback: null,
    };
  }

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
          Puzzle: () => this.openResetDialog(() => this.reset('puzzle')),
          'Puzzle and Timer': () => this.openResetDialog(() => this.resetPuzzleAndTimer()),
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
    const {vimMode, onToggleColorAttributionMode, skipFilledSquares, autoAdvanceCursor} = this.props;
    const vimModeLabel = vimMode ? 'Vim mode off' : 'Vim mode';
    const skipFilledSquaresLabel = skipFilledSquares ? "Don't skip filled" : 'Skip filled';
    const autoAdvanceLabel = autoAdvanceCursor ? 'No auto-advance' : 'Auto-advance';
    return (
      <ActionMenu
        label="Extras"
        onBlur={this.handleBlur}
        actions={{
          [vimModeLabel]: this.handleVimModeClick,
          [skipFilledSquaresLabel]: this.handleSkipFilledSquaresClick,
          [autoAdvanceLabel]: this.props.onToggleAutoAdvanceCursor,
          'Color Attribution': onToggleColorAttributionMode,
          'List View': this.props.onToggleListView,
          Pencil: this.props.onTogglePencil,
          Autocheck: this.props.onToggleAutocheck,
          'New game link': () => window.open(`/beta/play/${this.props.pid}?new=1`, '_blank'),
        }}
      />
    );
  }

  renderPlayAgainLink() {
    const {contest, onUnmarkSolved} = this.props;
    const actions = {};
    if (contest && onUnmarkSolved) {
      actions['Unmark as Solved'] = onUnmarkSolved;
    }
    actions['Reset this game'] = () =>
      this.openResetDialog(() => {
        this.reset('puzzle', true);
        this.props.onResetClock();
      });
    actions['Create new game link'] = () => window.open(`/beta/play/${this.props.pid}?new=1`, '_blank');
    return <ActionMenu label="Play Again" onBlur={this.handleBlur} actions={actions} />;
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
    this.setState({revealDialogOpen: true, revealScope: scopeString});
  }

  handleRevealConfirm = () => {
    const {revealScope} = this.state;
    if (revealScope) {
      this.props.onReveal(revealScope);
    }
  };

  handleRevealDialogChange = (open) => {
    if (!open) this.setState({revealDialogOpen: false, revealScope: null});
  };

  reset(scopeString, force = false) {
    this.props.onReset(scopeString, force);
  }

  keybind(mode) {
    this.props.onKeybind(mode);
  }

  openResetDialog(callback) {
    this.setState({resetDialogOpen: true, resetCallback: callback});
  }

  handleResetConfirm = () => {
    const {resetCallback} = this.state;
    if (resetCallback) resetCallback();
  };

  handleResetDialogChange = (open) => {
    if (!open) this.setState({resetDialogOpen: false, resetCallback: null});
  };

  resetPuzzleAndTimer() {
    this.reset('puzzle');
    this.props.onResetClock();
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

  renderDialogs() {
    const {revealDialogOpen, revealScope, resetDialogOpen} = this.state;
    return (
      <>
        <ConfirmDialog
          open={revealDialogOpen}
          onOpenChange={this.handleRevealDialogChange}
          title={`Are you sure you want to show the ${revealScope}?`}
          icon={<MdErrorOutline />}
          onConfirm={this.handleRevealConfirm}
          confirmLabel="Reveal"
          danger
        >
          <p>All players will be able to see the {revealScope}&apos;s answer.</p>
        </ConfirmDialog>
        <ConfirmDialog
          open={resetDialogOpen}
          onOpenChange={this.handleResetDialogChange}
          title="Are you sure you want to reset the entire puzzle?"
          icon={<MdErrorOutline />}
          onConfirm={this.handleResetConfirm}
          confirmLabel="Reset"
          danger
        />
      </>
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
        <>
          <div className="flex flex--align-center toolbar--mobile">
            <div className="flex flex--grow flex--align-center toolbar--mobile--top">
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
                  {solved && !replayMode && this.renderReplayLink()}
                  {solved && !replayMode && this.renderSaveReplay()}
                </>
              ) : (
                <>
                  {!solved && !replayMode && this.renderResetMenu()}
                  {solved && !replayMode && this.renderPlayAgainLink()}
                  {this.renderColorAttributionToggle()}
                  {this.renderListViewButton()}
                  {!contest && this.renderAutocheck()}
                  {!replayMode && this.renderExtrasMenu()}
                  {this.renderChatButton()}
                </>
              )}
              {this.renderExpandMenuButton()}
            </div>
          </div>
          {this.renderDialogs()}
        </>
      );
    }

    return (
      <>
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
        {this.renderDialogs()}
      </>
    );
  }
}

/* eslint-disable react/jsx-no-bind */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable consistent-return */
import {Component} from 'react';
import _ from 'lodash';
import Confetti from './Confetti.js';

import Player from '../Player';
import Toolbar from '../Toolbar';
import MilestoneToast from './MilestoneToast';
import {toArr} from '../../lib/jsUtils';
import {toHex, darken, GREENISH} from '../../lib/colors';
import GridWrapper from '../../lib/wrappers/GridWrapper';

const skipFilledSquaresKey = 'skip-filled-squares';
const autoAdvanceCursorKey = 'auto-advance-cursor';
const vimModeKey = 'vim-mode';
const showProgressKey = 'show-progress';
const vimModeRegex = /^\d+(a|d)*$/;

// component for gameplay -- incl. grid/clues & toolbar
export default class Game extends Component {
  constructor() {
    super();
    this.state = {
      listMode: false,
      pencilMode: false,
      autocheckMode: false,
      vimMode: false,
      vimInsert: false,
      vimCommand: false,
      skipFilledSquares: true,
      autoAdvanceCursor: true,
      colorAttributionMode: false,
      expandMenu: false,
      lastMilestone: 0,
      milestoneInitialized: false,
      milestoneMessage: null,
      showProgress: true,
    };
  }

  componentDidMount() {
    let vimMode = false;
    try {
      vimMode = JSON.parse(localStorage.getItem(vimModeKey)) || false;
    } catch (_e) {
      console.error('Failed to parse local storage vim mode!');
    }
    // with body { overflow: hidden }, it should disable swipe-to-scroll on iOS safari)
    this.setState({
      vimMode,
    });

    let skipFilledSquares = this.state.skipFilledSquares;
    try {
      const storedValue = localStorage.getItem(skipFilledSquaresKey);
      if (storedValue != null) {
        skipFilledSquares = JSON.parse(localStorage.getItem(skipFilledSquaresKey));
      }
    } catch (_e) {
      console.error('Failed to parse local storage: skipFilledSquares');
    }
    this.setState({skipFilledSquares});

    let autoAdvanceCursor = this.state.autoAdvanceCursor;
    try {
      const storedValue = localStorage.getItem(autoAdvanceCursorKey);
      if (storedValue != null) {
        autoAdvanceCursor = JSON.parse(storedValue);
      }
    } catch (_e) {
      console.error('Failed to parse local storage: autoAdvanceCursor');
    }
    this.setState({autoAdvanceCursor});

    let showProgress = this.state.showProgress;
    try {
      const storedValue = localStorage.getItem(showProgressKey);
      if (storedValue != null) {
        showProgress = JSON.parse(storedValue);
      }
    } catch (_e) {
      console.error('Failed to parse local storage: showProgress');
    }
    this.setState({showProgress});

    this.componentDidUpdate({});
  }

  componentWillUnmount() {
    clearTimeout(this.milestoneTimeout);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.myColor !== this.props.myColor) {
      this.handleUpdateColor(this.props.id, this.props.myColor);
    }

    // Initialize lastMilestone from current grid so resuming a puzzle
    // doesn't fire stale milestone toasts on the first edit.
    if (!this.state.milestoneInitialized && this.game && this.game.grid) {
      const initPercent = this.getPercentComplete();
      const milestones = [75, 50, 25];
      let initialMilestone = 0;
      for (const m of milestones) {
        if (initPercent >= m) {
          initialMilestone = m;
          break;
        }
      }
      this.setState({lastMilestone: initialMilestone, milestoneInitialized: true});
    }
  }

  get game() {
    return this.props.historyWrapper && this.props.historyWrapper.getSnapshot();
  }

  get gameModel() {
    return this.props.gameModel;
  }

  scope(s) {
    if (s === 'square') {
      return this.player.getSelectedSquares();
    }
    if (s === 'word') {
      return this.player.getSelectedAndHighlightedSquares();
    }
    if (s === 'puzzle') {
      return this.player.getAllSquares();
    }
    return [];
  }

  handleUpdateGrid = (r, c, value) => {
    const {id, myColor} = this.props;
    const {pencilMode} = this.state;
    const {autocheckMode} = this.state;
    this.gameModel.updateCell(r, c, id, myColor, pencilMode, value, autocheckMode);
    this.props.onChange();
    this.checkMilestone();
  };

  checkMilestone() {
    if (!this.state.showProgress) return;
    const game = this.game;
    if (!game || game.solved) return;
    const gridWrapper = new GridWrapper(game.grid);
    const percent = gridWrapper.getPercentComplete();
    const milestones = [75, 50, 25];
    for (const m of milestones) {
      if (percent >= m && this.state.lastMilestone < m) {
        this.setState({lastMilestone: m, milestoneMessage: `${m}% complete!`});
        clearTimeout(this.milestoneTimeout);
        this.milestoneTimeout = setTimeout(() => {
          this.setState({milestoneMessage: null});
        }, 3000);
        break;
      }
    }
  }

  handleUpdateCursor = ({r, c}) => {
    const {id} = this.props;
    if (this.game.solved && !_.find(this.game.cursors, (cursor) => cursor.id === id)) {
      return;
    }
    this.gameModel.updateCursor(r, c, id);
  };

  handleAddPing = ({r, c}) => {
    const {id} = this.props;
    this.gameModel.addPing(r, c, id);
  };

  handleUpdateColor = (id, color) => {
    this.gameModel.updateColor(id, color);
  };

  handleStartClock = () => {
    this.props.gameModel.updateClock('start');
  };

  handlePauseClock = () => {
    this.props.gameModel.updateClock('pause');
  };

  handleResetClock = () => {
    this.props.gameModel.updateClock('reset');
  };

  handleCheck = (scopeString) => {
    const scope = this.scope(scopeString);
    this.props.gameModel.check(scope);
  };

  handleReveal = (scopeString) => {
    const scope = this.scope(scopeString);
    this.props.gameModel.reveal(scope);
    this.props.onChange();
  };

  handleReset = (scopeString, force = false) => {
    const scope = this.scope(scopeString);
    this.props.gameModel.reset(scope, force);
  };

  handleMarkSolved = () => {
    this.props.gameModel.markSolved();
    this.props.onChange();
  };

  handleUnmarkSolved = () => {
    this.props.gameModel.unmarkSolved();
    this.props.onChange();
  };

  handleKeybind = (mode) => {
    this.setState({
      vimMode: mode === 'vim',
    });
  };

  handleToggleVimMode = () => {
    this.setState((prevState) => {
      const newVimMode = !prevState.vimMode;
      localStorage.setItem(vimModeKey, JSON.stringify(newVimMode));
      return {vimMode: newVimMode};
    });
  };

  handleVimInsert = () => {
    this.setState({
      vimInsert: true,
    });
  };

  handleVimCommand = () => {
    this.setState((prevState) => ({
      vimCommand: !prevState.vimCommand,
    }));
  };

  handleVimNormal = () => {
    this.setState({
      vimInsert: false,
      vimCommand: false,
    });
  };

  handleToggleSkipFilledSquares = () => {
    this.setState((prevState) => {
      const skipFilledSquares = !prevState.skipFilledSquares;
      localStorage.setItem(skipFilledSquaresKey, JSON.stringify(skipFilledSquares));
      return {skipFilledSquares: skipFilledSquares};
    });
  };

  handleToggleAutoAdvanceCursor = () => {
    this.setState((prevState) => {
      const autoAdvanceCursor = !prevState.autoAdvanceCursor;
      localStorage.setItem(autoAdvanceCursorKey, JSON.stringify(autoAdvanceCursor));
      return {autoAdvanceCursor};
    });
  };

  handleToggleShowProgress = () => {
    this.setState((prevState) => {
      const showProgress = !prevState.showProgress;
      localStorage.setItem(showProgressKey, JSON.stringify(showProgress));
      return {showProgress};
    });
  };

  handleTogglePencil = () => {
    this.setState((prevState) => ({
      pencilMode: !prevState.pencilMode,
    }));
  };

  handleToggleAutocheck = () => {
    this.setState((prevState) => ({
      autocheckMode: !prevState.autocheckMode,
    }));
  };

  handleToggleListView = () => {
    this.setState((prevState) => ({
      listMode: !prevState.listMode,
    }));
  };

  handleToggleChat = () => {
    this.props.onToggleChat();
  };

  handleToggleExpandMenu = () => {
    this.setState((prevState) => ({
      expandMenu: !prevState.expandMenu,
    }));
  };

  handleRefocus = () => {
    this.focus();
  };

  handlePressPeriod = this.handleTogglePencil;

  handleVimCommandPressEnter = (command) => {
    if (vimModeRegex.test(command)) {
      let dir = 'across';
      const int = parseInt(command, 10);
      if (command.endsWith('d')) {
        dir = 'down';
      }
      this.player.selectClue(dir, int);
    }
    this.handleRefocus();
  };

  handlePressEnter = () => {
    this.props.onUnfocus();
  };

  focus() {
    this.player && this.player.focus();
  }

  handleSelectClue(direction, number) {
    this.player.selectClue(direction, number);
  }

  renderPlayer() {
    const {id, myColor, mobile, beta} = this.props;
    if (!this.game) {
      return <div>Loading...</div>;
    }

    const {
      grid,
      circles,
      shades,
      images,
      cursors,
      pings,
      users,
      solved,
      solution,
      themeColor,
      optimisticCounter,
    } = this.game;
    const clues = {
      ...this.game.clues,
    };
    if (window.location.host === 'foracross.com' || window.location.host.includes('.foracross.com')) {
      const dirToHide = window.location.host.includes('down') ? 'across' : 'down';
      clues[dirToHide] = _.assign([], clues[dirToHide]).map((val) => val && '-');
    }
    const screenWidth = window.innerWidth - 1; // this is important for mobile to fit on screen
    const themeStyles = {
      clueBarStyle: {
        backgroundColor: toHex(themeColor),
      },
      gridStyle: {
        cellStyle: {
          selected: {
            backgroundColor: myColor,
          },
          highlighted: {
            backgroundColor: toHex(darken(themeColor)),
          },
          frozen: {
            backgroundColor: toHex(GREENISH),
          },
        },
      },
    };
    const cols = grid[0].length;
    const rows = grid.length;
    let width;
    if (this.props.mobile) {
      width = Math.min((35 * 15 * cols) / rows, screenWidth - 20);
    } else {
      // Size grid to fill available viewport height without overflowing the screen.
      // Reserved space: nav (~41px) + toolbar (~30px) + clue bar (~44px) + padding (~24px) + margin (~46px)
      const DESKTOP_CHROME_HEIGHT = 185;
      const availableHeight = window.innerHeight - DESKTOP_CHROME_HEIGHT;
      const viewportWidth = (availableHeight * cols) / rows;
      // Cap at the old fixed sizing so zooming out shrinks the grid as expected
      const fixedWidth = (35 * 15 * cols) / rows;
      width = Math.min(viewportWidth, fixedWidth, screenWidth - 20);
    }
    const minSize = this.props.mobile ? 1 : 20;
    const size = Math.max(minSize, width / cols);
    return (
      <Player
        ref={(c) => {
          this.player = c;
        }}
        beta={beta}
        size={size}
        grid={grid}
        solution={solution}
        circles={circles}
        shades={shades}
        images={images}
        clues={{
          across: toArr(clues.across),
          down: toArr(clues.down),
        }}
        id={id}
        cursors={cursors}
        pings={pings}
        users={users}
        frozen={solved || this.props.syncFailed}
        myColor={myColor}
        updateGrid={this.handleUpdateGrid}
        updateCursor={this.handleUpdateCursor}
        addPing={this.handleAddPing}
        onPressEnter={this.handlePressEnter}
        onPressPeriod={this.handlePressPeriod}
        listMode={this.state.listMode}
        vimMode={this.state.vimMode}
        vimInsert={this.state.vimInsert}
        vimCommand={this.state.vimCommand}
        onVimInsert={this.handleVimInsert}
        onVimNormal={this.handleVimNormal}
        onVimCommand={this.handleVimCommand}
        onVimCommandPressEnter={this.handleVimCommandPressEnter}
        onVimCommandPressEscape={this.handleRefocus}
        skipFilledSquares={this.state.skipFilledSquares}
        onToggleSkipFilledSquares={this.handleToggleSkipFilledSquares}
        autoAdvanceCursor={this.state.autoAdvanceCursor}
        colorAttributionMode={this.state.colorAttributionMode}
        mobile={mobile}
        optimisticCounter={optimisticCounter}
        onCheck={this.handleCheck}
        onReveal={this.handleReveal}
        contest={!!this.game.contest}
        {...themeStyles}
      />
    );
  }

  getPercentComplete() {
    if (!this.game || !this.game.grid) return 0;
    const gridWrapper = new GridWrapper(this.game.grid);
    return gridWrapper.getPercentComplete();
  }

  renderToolbar() {
    if (!this.game) return;
    const {clock, solved} = this.game;
    const {mobile} = this.props;
    const {
      pencilMode,
      autocheckMode,
      vimMode,
      vimInsert,
      vimCommand,
      skipFilledSquares,
      listMode,
      expandMenu,
    } = this.state;
    const {lastUpdated: startTime, totalTime: pausedTime, paused: isPaused} = clock;
    return (
      <Toolbar
        v2
        gid={this.props.gid}
        pid={this.game.pid}
        mobile={mobile}
        startTime={startTime}
        pausedTime={pausedTime}
        isPaused={isPaused || this.props.syncFailed}
        listMode={listMode}
        expandMenu={expandMenu}
        pencilMode={pencilMode}
        autocheckMode={autocheckMode}
        vimMode={vimMode}
        skipFilledSquares={skipFilledSquares}
        autoAdvanceCursor={this.state.autoAdvanceCursor}
        solved={solved}
        contest={!!this.game.contest}
        vimInsert={vimInsert}
        vimCommand={vimCommand}
        onStartClock={this.handleStartClock}
        onPauseClock={this.handlePauseClock}
        onResetClock={this.handleResetClock}
        onCheck={this.handleCheck}
        onReveal={this.handleReveal}
        onReset={this.handleReset}
        onMarkSolved={this.handleMarkSolved}
        onUnmarkSolved={this.handleUnmarkSolved}
        onKeybind={this.handleKeybind}
        onTogglePencil={this.handleTogglePencil}
        onToggleVimMode={this.handleToggleVimMode}
        onToggleSkipFilledSquares={this.handleToggleSkipFilledSquares}
        onToggleAutoAdvanceCursor={this.handleToggleAutoAdvanceCursor}
        onToggleAutocheck={this.handleToggleAutocheck}
        onToggleListView={this.handleToggleListView}
        onToggleChat={this.handleToggleChat}
        chatHidden={this.props.chatHidden}
        onToggleExpandMenu={this.handleToggleExpandMenu}
        colorAttributionMode={this.state.colorAttributionMode}
        onToggleColorAttributionMode={() => {
          this.setState((prevState) => ({colorAttributionMode: !prevState.colorAttributionMode}));
        }}
        onRefocus={this.handleRefocus}
        unreads={this.props.unreads}
        onSaveReplay={this.props.onSaveReplay}
        replayRetained={this.props.replayRetained}
        savingReplay={this.props.savingReplay}
        isAuthenticated={this.props.isAuthenticated}
        showProgress={this.state.showProgress}
        onToggleShowProgress={this.handleToggleShowProgress}
        percentComplete={this.state.showProgress ? this.getPercentComplete() : 0}
      />
    );
  }

  render() {
    const padding = this.props.mobile ? 0 : 12;
    return (
      <div className="flex--column flex--grow">
        {this.renderToolbar()}
        <div
          className="flex flex--grow"
          style={{
            padding,
          }}
        >
          {this.renderPlayer()}
        </div>
        {this.game.solved && <Confetti />}
        {this.state.milestoneMessage && <MilestoneToast message={this.state.milestoneMessage} />}
      </div>
    );
  }
}

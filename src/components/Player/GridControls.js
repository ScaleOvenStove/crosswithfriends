/* eslint no-plusplus: "off" */
import './css/gridControls.css';

import React, {Component} from 'react';

import GridObject from '../../lib/wrappers/GridWrapper';

function safe_while(condition, step, capLimit = 500) {
  let remaining = capLimit;
  while (condition() && remaining >= 0) {
    step();
    remaining -= 1;
  }
}

// Callers uppercase before checking, so a letter that has case must already be uppercase. Any script's letters
// count, not just A-Z, so puzzles in other languages can be filled in (É, Ñ, Ø typed via AltGr or dead keys, or
// characters from an IME). A letter whose uppercase is more than one character (ß -> SS) fails the single-
// character match and is not entered.
export function validLetter(letter) {
  const VALID_SYMBOLS = '!@#$%^&*()-+=`~/?\\'; // special theme puzzles have these sometimes;
  if (VALID_SYMBOLS.indexOf(letter) !== -1) return true;
  return /^[\p{L}0-9]$/u.test(letter) && letter === letter.toUpperCase();
}

// With an input method editor active (ibus/fcitx on Linux, the Japanese/Chinese/Korean IMEs everywhere), a
// keydown carries no usable key: Chrome reports key "Process" and Firefox keyCode 229, and the character only
// shows up afterwards as an input event on the focused hidden <input>. isComposing covers keys pressed
// mid-composition, which belong to the IME (e.g. arrows moving through its candidate list).
function isImeKeyDown(ev) {
  return ev.key === 'Process' || ev.keyCode === 229 || Boolean(ev.nativeEvent?.isComposing ?? ev.isComposing);
}

const ALT_KEY_SCOPES = {KeyS: 'square', KeyW: 'word', KeyP: 'puzzle'};

export default class GridControls extends Component {
  constructor() {
    super();
    // Sticky rebus entry for physical keyboards. Holding Shift also enters a rebus, but Shift turns
    // the number row into symbols, so a multi-digit rebus is impossible without this.
    this.state = {rebusMode: false};
    this.inputRef = React.createRef();
    this.handleClick = this.handleClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    // Set by an IME keydown so the input event it produces is relayed to the grid; see handleInput.
    this.imeInputPending = false;
    this.imeShiftKey = false;
    this.composing = false;
  }

  actions = {
    left: this.setDirectionWithCallback('across', this.moveSelectedBy(0, -1).bind(this)).bind(this),
    up: this.setDirectionWithCallback('down', this.moveSelectedBy(-1, 0).bind(this)).bind(this),
    down: this.setDirectionWithCallback('down', this.moveSelectedBy(1, 0).bind(this)).bind(this),
    right: this.setDirectionWithCallback('across', this.moveSelectedBy(0, 1).bind(this)).bind(this),
    forward: this.moveSelectedUsingDirection(1).bind(this),
    backward: this.moveSelectedUsingDirection(-1).bind(this),
    home: this.moveToEdge(true).bind(this),
    end: this.moveToEdge(false).bind(this),
    backspace: this.backspace.bind(this),
    delete: this.delete.bind(this),
    tab: this.selectNextClue.bind(this),
    space: this.flipDirection.bind(this),
  };

  get grid() {
    return new GridObject(this.props.grid);
  }

  getSelectedClueNumber() {
    return this.grid.getParent(this.props.selected.r, this.props.selected.c, this.props.direction);
  }

  componentDidMount() {
    this.focus();
  }

  componentDidUpdate(prevProps) {
    const {selected} = this.props;
    if (
      this.state.rebusMode &&
      (prevProps.selected.r !== selected.r || prevProps.selected.c !== selected.c)
    ) {
      this.setState({rebusMode: false});
    }
  }

  toggleRebusMode() {
    if (this.state.rebusMode) {
      this.exitRebusMode();
      return;
    }
    const {r, c} = this.props.selected;
    if (this.props.frozen || !this.isSelectable(r, c) || this.props.grid[r][c].isImage) return;
    // By commit time the rebus has filled the cell, so remember whether it was the word's last gap.
    this.rebusStartedEmpty = !this.grid.isFilled(r, c);
    // Queued writes target this cell even if the selection moves before they run.
    this.rebusCell = {r, c};
    this.setState({rebusMode: true});
  }

  // Commits the rebus by leaving the cell, the way typing a single letter would. A rebus closed with
  // nothing in it stays put, since there is no entry to move past.
  exitRebusMode() {
    this.setState({rebusMode: false});
    const {r, c} = this.rebusCell;
    this.afterPendingWrites(() => {
      // The user already moved on before the queue drained; don't move them again.
      if (this.props.selected.r !== r || this.props.selected.c !== c) return;
      if (!this.grid.isFilled(r, c)) return;
      this.goToNextEmptyCell({
        nextClueIfFilled: this.props.autoAdvanceCursor,
        currentWasEmpty: this.rebusStartedEmpty,
      });
    });
  }

  rebusBackspace() {
    const {r, c} = this.rebusCell;
    this.afterPendingWrites(() => {
      const cell = this.props.grid[r][c];
      if (cell.good || !cell.value) return;
      this.props.updateGrid(r, c, cell.value.slice(0, -1));
    });
  }

  // typeLetter defers its writes (30ms apart) and each one reads props.selected when it runs, so anything
  // that moves the cursor or edits the cell must wait for them or it reorders the rebus.
  afterPendingWrites(fn) {
    const delay = this.nextTime ? this.nextTime - Date.now() : 0;
    if (delay > 0) {
      setTimeout(fn, delay);
    } else {
      fn();
    }
  }

  selectNextClue(backwards, parallel = false) {
    let currentClueNumber = this.getSelectedClueNumber();
    let currentDirection = this.props.direction;
    const skipFilledSquares = this.props.skipFilledSquares;
    const trySelectNextClue = () => {
      const {direction, clueNumber} = this.grid.getNextClue(
        currentClueNumber,
        currentDirection,
        this.props.clues,
        backwards,
        parallel,
        skipFilledSquares
      );
      currentClueNumber = clueNumber;
      currentDirection = direction;
    };
    const hasSelectableCells = () => this.isClueSelectable(currentDirection, currentClueNumber);

    trySelectNextClue();
    safe_while(() => !hasSelectableCells(), trySelectNextClue);
    this.selectClue(currentDirection, currentClueNumber, skipFilledSquares);
  }

  selectClue(direction, number, skipFilledSquares) {
    const clueRoot = this.grid.getCellByNumber(number);
    if (clueRoot) {
      this.setDirection(direction);
      const firstEmptyCell = this.grid.getNextEmptyCell(clueRoot.r, clueRoot.c, direction, {
        skipFilledSquares,
      });
      let targetCell = firstEmptyCell || clueRoot;
      // if not selectable
      while (targetCell && !this.isSelectable(targetCell.r, targetCell.c)) {
        const nextCell = this.grid.getNextCell(targetCell.r, targetCell.c, direction);
        if (!nextCell) break;
        targetCell = nextCell;
      }
      if (targetCell && this.isSelectable(targetCell.r, targetCell.c)) {
        this.setSelected(targetCell);
      }
    }
  }

  isSelectable(r, c) {
    return (
      (this.props.editMode || this.grid.isWhite(r, c)) &&
      !this.props.grid[r][c].isHidden &&
      !this.props.grid[r][c].isImage
    );
  }

  isClueSelectable(direction, clueNumber) {
    const clueRoot = this.grid.getCellByNumber(clueNumber);
    if (!clueRoot) return false;
    // check if any cell is selectable
    let {r, c} = clueRoot;
    while (
      this.grid.isInBounds(r, c) &&
      this.grid.isWhite(r, c) &&
      this.grid.getParent(r, c, direction) === clueNumber
    ) {
      if (this.isSelectable(r, c)) {
        return true;
      }
      if (direction === 'across') c++;
      else r++;
    }
    return false;
  }

  flipDirection() {
    if (this.props.direction === 'across') {
      if (this.canSetDirection('down')) {
        this.setDirection('down');
      }
    } else if (this.canSetDirection('across')) {
      this.setDirection('across');
    }
  }

  moveSelectedBy(dr, dc) {
    return () => {
      const {selected} = this.props;
      let {r, c} = selected;
      const step = () => {
        r += dr;
        c += dc;
      };
      step();
      safe_while(() => this.grid.isInBounds(r, c) && !this.isSelectable(r, c), step);
      if (this.grid.isInBounds(r, c)) {
        this.setSelected({r, c});
      }
    };
  }

  moveSelectedUsingDirection(d) {
    return () => {
      const [dr, dc] = this.props.direction === 'down' ? [0, d] : [d, 0];
      return this.moveSelectedBy(dr, dc)();
    };
  }

  moveToEdge(start) {
    return () => {
      const {selected, direction} = this.props;
      let {r, c} = selected;
      ({r, c} = this.grid.getEdge(r, c, direction, start));
      if (this.grid.isInBounds(r, c)) {
        this.setSelected({r, c});
      }
    };
  }

  setDirectionWithCallback(direction, cbk) {
    return () => {
      if (this.props.direction !== direction) {
        if (this.canSetDirection(direction)) {
          this.setDirection(direction);
        } else {
          cbk();
        }
      } else {
        cbk();
      }
    };
  }

  // factored out handleAction for mobileGridControls
  handleAction(action, shiftKey) {
    if (!(action in this.actions)) {
      console.error('illegal action', action);
      return; // weird!
    }
    this.actions[action](shiftKey);
  }

  // Alt+S/W/P check (or with Shift, reveal) the square/word/puzzle. Matched on code rather than key since
  // macOS Option turns the letter into a symbol ("ß"). Returns true only for those, so every other Alt combo
  // (Alt+D to the address bar, Alt+Left to go back, menu accelerators) is left to the browser.
  handleAltKey(code, shiftKey) {
    if (this.props.contest) return false; // no check/reveal for contest puzzles
    const scope = ALT_KEY_SCOPES[code];
    if (!scope) return false;
    const altAction = shiftKey ? this.props.onReveal : this.props.onCheck;
    altAction(scope);
    return true;
  }

  // takes in key, a string
  _handleKeyDown = (key, shiftKey, altKey, code) => {
    const actionKeys = {
      ArrowLeft: 'left',
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowRight: 'right',
      Backspace: 'backspace',
      '{del}': 'backspace',
      Delete: 'delete',
      Tab: 'tab',
      ' ': 'space',
      '[': 'backward',
      ']': 'forward',
      Home: 'home',
      End: 'end',
    };

    if (shiftKey) {
      const isAcross = this.props.direction === 'across';
      actionKeys[isAcross ? 'ArrowUp' : 'ArrowLeft'] = 'backward';
      actionKeys[isAcross ? 'ArrowDown' : 'ArrowRight'] = 'forward';
    }

    // Checked first so an Alt combo the grid doesn't own reaches the browser instead of acting as its plain key.
    if (altKey) {
      return this.handleAltKey(code, shiftKey) || undefined;
    }
    const {onPressEnter, onPressPeriod} = this.props;
    if (key === 'Escape' || key === 'Insert') {
      this.toggleRebusMode();
      return true;
    }
    if (this.state.rebusMode) {
      if (key === 'Enter') {
        this.exitRebusMode();
        return true;
      }
      if (key === 'Backspace' || key === '{del}') {
        this.rebusBackspace();
        return true;
      }
    }
    if (key in actionKeys) {
      this.handleAction(actionKeys[key], shiftKey);
      return true;
    }
    if (key === '.') {
      onPressPeriod && onPressPeriod();
      return true;
    }
    if (key === 'Enter') {
      onPressEnter && onPressEnter();
      return true;
    }
    if (!this.props.frozen) {
      const letter = key.toUpperCase();
      if (validLetter(letter)) {
        this.typeLetter(letter, shiftKey || this.state.rebusMode, {
          nextClueIfFilled: this.props.autoAdvanceCursor,
        });
        return true;
      }
    }
    return undefined;
  };

  _handleKeyDownVim = (key, shiftKey, altKey, code) => {
    const actionKeys = {
      ArrowLeft: 'left',
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowRight: 'right',
      Backspace: 'backspace',
      '{del}': 'backspace',
      Delete: 'delete',
      Tab: 'tab',
      ' ': 'space',
      '[': 'backward',
      ']': 'forward',
      Home: 'home',
      End: 'end',
    };

    const normalModeActionKeys = {
      h: 'left',
      j: 'down',
      k: 'up',
      l: 'right',
      x: 'delete',
      '^': 'home',
      $: 'end',
    };

    const {onVimNormal, onVimInsert, vimInsert, onVimCommand, vimCommand, onPressEnter, onPressPeriod} =
      this.props;
    if (altKey) {
      return this.handleAltKey(code, shiftKey) || undefined;
    }
    if (key in actionKeys) {
      this.handleAction(actionKeys[key], shiftKey);
      return true;
    }
    if (!vimInsert && !vimCommand) {
      if (key in normalModeActionKeys) {
        this.handleAction(normalModeActionKeys[key], shiftKey);
      } else if (key === 'w') {
        this.selectNextClue(false);
      } else if (key === 'b') {
        this.selectNextClue(true);
      } else if (key === 'i') {
        onVimInsert && onVimInsert();
      } else if (key === 's') {
        this.delete();
        onVimInsert && onVimInsert();
      } else if (key === ':') {
        onVimCommand && onVimCommand();
      }
    } else if (key === '.') {
      onPressPeriod && onPressPeriod();
      return true;
    } else if (key === 'Enter') {
      onPressEnter && onPressEnter();
      return true;
    } else if (key === 'Escape') {
      onVimNormal && onVimNormal();
    } else if (vimInsert && !this.props.frozen) {
      const letter = key.toUpperCase();
      if (validLetter(letter)) {
        this.typeLetter(letter, shiftKey, {nextClueIfFilled: this.props.autoAdvanceCursor});
        return true;
      }
    }
    return undefined;
  };

  handleClick(ev) {
    ev.preventDefault();
    this.focus();
  }

  // takes in a Keyboard Event
  handleKeyDown(ev) {
    const {vimMode} = this.props;
    const keyDownHandler = vimMode ? this._handleKeyDownVim : this._handleKeyDown;

    if (ev.target !== this.inputRef && (ev.tagName === 'INPUT' || ev.metaKey || ev.ctrlKey)) {
      return;
    }
    if (isImeKeyDown(ev)) {
      // Leave the key to the IME (no preventDefault) and pick up what it writes in handleInput.
      this.imeInputPending = true;
      this.imeShiftKey = ev.shiftKey;
      return;
    }
    this.imeInputPending = false;
    // React 16 SyntheticEvent doesn't expose ev.code; read from nativeEvent
    const code = ev.nativeEvent ? ev.nativeEvent.code : ev.code;
    if (keyDownHandler(ev.key, ev.shiftKey, ev.altKey, code)) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  }

  handleCompositionStart = () => {
    this.composing = true;
  };

  // Text composed in the IME (pinyin, kana, ...) is committed here. Chrome fires its last input event before
  // compositionend and Firefox after; whichever comes first drains the box and the other finds it empty.
  handleCompositionEnd = (ev) => {
    this.composing = false;
    this.consumeInput(ev.target, true, false);
  };

  // Keys handled in handleKeyDown are preventDefault-ed and never reach the hidden input, so anything that
  // lands in it came from an IME (relayed to the grid) or from a key the grid ignored, like an apostrophe or
  // vim's normal-mode commands (already acted on in keydown, so only discarded). Either way the box is emptied
  // so it doesn't collect text.
  handleInput = (ev) => {
    if (this.composing || ev.nativeEvent?.isComposing) return;
    const relay = this.imeInputPending;
    this.imeInputPending = false;
    this.consumeInput(ev.target, relay, this.imeShiftKey);
  };

  consumeInput(input, relay, shiftKey) {
    if (!input) return;
    const text = input.value;
    input.value = '';
    if (!relay) return;
    const keyDownHandler = this.props.vimMode ? this._handleKeyDownVim : this._handleKeyDown;
    for (const char of text) {
      keyDownHandler(char, shiftKey, false, undefined);
    }
  }

  goToNextEmptyCell({nextClueIfFilled = false, currentWasEmpty} = {}) {
    const skipFilledSquares = this.props.skipFilledSquares;
    const {r, c} = this.props.selected;
    const nextEmptyCell = this.grid.getNextEmptyCell(r, c, this.props.direction, {
      skipFirst: true,
      skipFilledSquares,
    });
    if (nextEmptyCell) {
      this.setSelected(nextEmptyCell);
      return nextEmptyCell;
    }

    // No more empty cells found. Auto-advance only when the word transitions
    // from incomplete to complete, i.e. the current cell was the last empty cell.
    // Do NOT advance when overwriting a letter in an already-complete word.
    if (nextClueIfFilled) {
      // When skipFilledSquares is off, the search above doesn't look for empties,
      // so do a proper empty-cell check with skipFilledSquares forced on.
      const noOtherEmptyCells =
        skipFilledSquares ||
        !this.grid.getNextEmptyCell(r, c, this.props.direction, {
          skipFirst: true,
          skipFilledSquares: true,
        });
      if (noOtherEmptyCells && (currentWasEmpty ?? !this.grid.isFilled(r, c))) {
        this.selectNextClue();
        return undefined;
      }
    }

    const nextCell = this.grid.getNextCell(r, c, this.props.direction);
    if (nextCell) {
      this.setSelected(nextCell);
      return nextCell;
    }
    return undefined;
  }

  goToPreviousCell() {
    let {r, c} = this.props.selected;
    const grid = this.props.grid;
    const step = () => {
      if (this.props.direction === 'across') {
        if (c > 0) {
          c--;
        } else {
          c = grid[0].length - 1;
          r--;
        }
      } else if (r > 0) {
        r--;
      } else {
        r = grid.length - 1;
        c--;
      }
    };
    const ok = () => this.grid.isInBounds(r, c) && this.grid.isWhite(r, c) && !this.props.grid[r][c].isImage;
    step();
    safe_while(() => this.grid.isInBounds(r, c) && !ok(), step);
    if (ok()) {
      this.setSelected({r, c});
      return {r, c};
    }
    return undefined;
  }

  typeLetter(letter, isRebus, {nextClueIfFilled} = {}) {
    const {r, c} = this.props.selected;
    if (!this.isSelectable(r, c)) {
      return undefined; // don't type in hidden/non-selectable cells
    }
    if (this.props.grid[r][c].isImage) {
      return undefined; // don't type in image cells
    }
    if (this.props.beta) {
      this.typeLetterSync(letter, isRebus, {nextClueIfFilled});
      return undefined;
    }
    if (!this.nextTime) this.nextTime = Date.now();
    const rebusCell = this.state.rebusMode ? this.rebusCell : undefined;
    setTimeout(
      () => {
        let rebusFlag = isRebus;
        if (letter === '/') rebusFlag = true;
        const {r: selR, c: selC} = rebusCell || this.props.selected;
        const value = this.props.grid[selR][selC].value;
        if (!rebusFlag) {
          this.goToNextEmptyCell({nextClueIfFilled});
        }
        this.props.updateGrid(selR, selC, rebusFlag ? (value || '').substr(0, 10) + letter : letter);
      },
      Math.max(0, this.nextTime - Date.now())
    );
    this.nextTime = Math.max(this.nextTime, Date.now()) + 30;
    return undefined;
  }

  typeLetterSync(letter, isRebus, {nextClueIfFilled} = {}) {
    const rebusFlag = letter === '/' ? true : isRebus;
    const {r, c} = this.props.selected;
    const value = this.props.grid[r][c].value;
    if (!rebusFlag) {
      this.goToNextEmptyCell({nextClueIfFilled});
    }
    this.props.updateGrid(r, c, rebusFlag ? (value || '').substr(0, 10) + letter : letter);
  }

  // Returns true if the letter was successfully deleted
  delete() {
    const {r, c} = this.props.selected;
    if (this.props.grid[r][c].isImage) return false;
    if (this.props.grid[r][c].value !== '' && !this.props.grid[r][c].good) {
      this.props.updateGrid(r, c, '');
      return true;
    }
    return false;
  }

  backspace(shouldStay) {
    if (!this.delete() && !shouldStay) {
      const cell = this.goToPreviousCell();
      if (cell) {
        this.props.updateGrid(cell.r, cell.c, '');
      }
    }
  }

  isGridFilled() {
    return this.grid.isGridFilled();
  }

  setDirection(direction) {
    this.props.onSetDirection(direction);
  }

  canSetDirection(direction) {
    return this.props.canSetDirection(direction);
  }

  setSelected(selected) {
    this.props.onSetSelected(selected);
  }

  focus() {
    this.inputRef.current.focus({preventScroll: true});
  }

  render() {
    const gridStyle = {
      // Disable double-tap-to-zoom as it delays clicks by up to 300ms (to see if it becomes a double-tap)
      touchAction: 'manipulation',
    };
    const inputStyle = {
      opacity: 0,
      width: 0,
      height: 0,
    };
    return (
      <div
        role="grid"
        className="grid-controls"
        tabIndex={0}
        onClick={this.handleClick}
        onKeyDown={this.handleKeyDown}
        style={gridStyle}
      >
        <div className="grid--content">{this.props.children}</div>
        {this.state.rebusMode && (
          <div className="grid-controls--rebus-badge" role="status">
            Rebus — press Enter when done
          </div>
        )}
        <input
          tabIndex={-1}
          name="grid"
          ref={this.inputRef}
          style={inputStyle}
          autoComplete="off"
          autoCapitalize="none"
          data-1p-ignore
          data-lpignore="true"
          data-bw-ignore="true"
          data-form-type="other"
          onInput={this.handleInput}
          onCompositionStart={this.handleCompositionStart}
          onCompositionEnd={this.handleCompositionEnd}
        />
      </div>
    );
  }
}

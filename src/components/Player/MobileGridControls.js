import './css/mobileGridControls.css';

import React, {useEffect} from 'react';
import {MdKeyboardArrowLeft, MdKeyboardArrowRight} from 'react-icons/md';
import _ from 'lodash';
import Clue from './ClueText';
import GridControls, {validLetter} from './GridControls';
import GridObject from '../../lib/wrappers/GridWrapper';

const RunOnce = ({effect}) => {
  useEffect(() => {
    effect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

function getClueAbbreviation({clueNumber = '', direction = ''} = {}) {
  return `${clueNumber}${direction.substring(0, 1).toUpperCase()}`;
}

// Firefox Android routes hardware volume keys through the focused element
// instead of the OS media bus, so while our hidden IME-capture textarea is
// focused the device volume rocker stops working (#479). Blur on detection
// so the next press reaches the OS. Includes both the modern AudioVolume*
// values and the deprecated Volume* values still used by some older Android
// browsers / WebViews.
const VOLUME_KEYS = new Set([
  'AudioVolumeUp',
  'AudioVolumeDown',
  'AudioVolumeMute',
  'VolumeUp',
  'VolumeDown',
  'VolumeMute',
]);
function handleVolumeKeyBlur(ev) {
  if (VOLUME_KEYS.has(ev.key)) {
    ev.target.blur();
  }
}

// Splits the change from prev to next into [number of characters deleted from the end, string appended].
function diffValues(prev, next) {
  let common = 0;
  while (common < prev.length && common < next.length && prev[common] === next[common]) {
    common += 1;
  }
  return [prev.length - common, next.slice(common)];
}

// Spacebar, comma and period trigger grid actions (flip direction, next clue) rather than typing. They stay in
// the box, so deleting one has to count as a grid backspace, the same as it did when the box was reset after
// every key.
const ACTION_CHARS = ' ,.';

// The "$" sentinel followed by only the characters that count for the grid: letters it accepts, plus the action
// characters (so backspacing over one reaches the grid). Anything else, like the apostrophe in "don't", is
// ignored both when typed and when deleted.
function gridChars(value) {
  if (value === '') return '';
  return (
    value[0] +
    [...value.slice(1)]
      .filter((char) => ACTION_CHARS.includes(char) || validLetter(char.toUpperCase()))
      .join('')
  );
}

export default class MobileGridControls extends GridControls {
  constructor() {
    super();
    this.state = {
      anchors: [],
      transform: {scale: 1, translateX: 0, translateY: 0},
      dbgstr: undefined,
    };
    this.lastInputValues = new WeakMap();
    this.nextStepAt = 0;
    this.debugLog = [];
    this.inputRef = React.createRef();
    this.zoomContainer = React.createRef();
    this.gridControlsRef = React.createRef();
    this.wasUnfocused = Date.now() - 1000;
    this.lastTouchMove = Date.now();
    this.boundCenterGridX = () => this.centerGridX();
    this._touchStartTransform = null;
    this._fitOnScreenTimer = null;
    // Set on the tap path before onSetSelected, consumed by the next
    // componentDidUpdate so a tap-triggered selection change doesn't pan
    // (the user saw the cell in order to tap it).
    this._lastSelectionFromTap = false;
  }

  componentDidMount() {
    super.componentDidMount();
    // Listen to visualViewport resize events to handle keyboard show/hide on mobile.
    // window.resize doesn't reliably fire on iOS Safari when the virtual keyboard
    // appears/disappears, but visualViewport.resize does.
    if (window.visualViewport) {
      // Re-clamp the grid transform when the keyboard shows/hides so a
      // previously-panned grid doesn't fall outside the new viewport.
      this._handleViewportResize = () => this.fitOnScreen();
      window.visualViewport.addEventListener('resize', this._handleViewportResize);
    }
  }

  componentWillUnmount() {
    clearTimeout(this._fitOnScreenTimer);
    if (window.visualViewport && this._handleViewportResize) {
      window.visualViewport.removeEventListener('resize', this._handleViewportResize);
    }
  }

  componentDidUpdate(prevProps, prevState) {
    // After a touch gesture ends (all fingers lifted), enforce grid boundaries —
    // but ONLY if the gesture actually moved/zoomed the grid. A simple cell tap
    // doesn't change the transform, so we skip this branch for taps.
    if (prevState.anchors.length > 0 && this.state.anchors.length === 0) {
      const st = this._touchStartTransform;
      const ct = this.state.transform;
      if (
        st &&
        (st.scale !== ct.scale || st.translateX !== ct.translateX || st.translateY !== ct.translateY)
      ) {
        this.fitOnScreen();
      }
    }
    // Keep the selected cell in view for non-tap selection changes (typing
    // advances, tab/arrow nav). Taps are handled by handleTouchEnd setting
    // _lastSelectionFromTap so this path is a no-op for them.
    if (prevProps.selected.r !== this.props.selected.r || prevProps.selected.c !== this.props.selected.c) {
      if (this._lastSelectionFromTap) {
        this._lastSelectionFromTap = false;
      } else {
        clearTimeout(this._fitOnScreenTimer);
        this._fitOnScreenTimer = setTimeout(() => this.fitOnScreen(true), 200);
      }
    }
  }

  fitOnScreen(fitCurrentClue) {
    if (!fitCurrentClue && this.state.lastFitOnScreen > Date.now() - 100) return;

    const rect = this.zoomContainer.current.getBoundingClientRect();
    let {scale, translateX, translateY} = this.state.transform;
    const {selected, size} = this.props;

    // default scale already fits screen width; no need to zoom out further
    scale = Math.max(1, scale);

    // this shouldn't go larger than half a tile (scaled) for now; the min X/Y
    // calculations don't work when the difference between the usable size and
    // grid size are positive, but smaller than PADDING
    const PADDING = (size / 2) * scale; // px

    const usableWidth = visualViewport.width;
    const gridWidth = this.grid.cols * size * scale;
    const minX = Math.min(0, usableWidth - gridWidth - PADDING);
    const maxX = PADDING;
    translateX = Math.min(Math.max(translateX, minX), maxX);

    const usableHeight = visualViewport.height - rect.y;
    const gridHeight = this.grid.rows * size * scale;
    const minY = Math.min(0, usableHeight - gridHeight - PADDING);
    const maxY = PADDING;
    // General Y clamp only applies to pinch/pan-end and keyboard resize.
    // For selection changes, the fitCurrentClue block below pans only when the
    // cell is actually off-screen, avoiding fighting between the two clamps.
    if (!fitCurrentClue) {
      translateY = Math.min(Math.max(translateY, minY), maxY);
    }

    if (fitCurrentClue) {
      const posX = selected.c * size;
      const posY = selected.r * size;
      const paddingX = (rect.width - this.grid.cols * size) / 2;
      const paddingY = (rect.height - this.grid.rows * size) / 2;
      const tX = (posX + paddingX) * scale;
      const tY = (posY + paddingY) * scale;
      const visibleHeight = usableHeight;

      // Only adjust horizontal panning if the cell is actually off-screen.
      const cellScreenX = tX + translateX;
      const cellRight = cellScreenX + size * scale;
      if (cellScreenX < 0 || cellRight > rect.width) {
        translateX = _.clamp(translateX, -tX, rect.width - tX - size * scale);
      }

      // Only adjust vertical panning if the cell is significantly off-screen
      // (above the viewport or behind the keyboard). The tolerance prevents
      // small pans when cells are right at the boundary.
      const TOLERANCE = size * scale; // one cell height of slack
      const cellScreenY = tY + translateY;
      const cellBottom = cellScreenY + size * scale;
      if (cellScreenY < -TOLERANCE || cellBottom > visibleHeight + TOLERANCE) {
        translateY = _.clamp(translateY, -tY, visibleHeight - tY - size * scale);
      }
    }

    // Skip setState if nothing actually changed — avoids unnecessary re-renders
    // and prevents cascading componentDidUpdate triggers.
    const cur = this.state.transform;
    if (cur.scale === scale && cur.translateX === translateX && cur.translateY === translateY) {
      return;
    }

    this.setState({
      transform: {
        scale,
        translateX,
        translateY,
      },
      lastFitOnScreen: Date.now(),
    });
  }

  centerGridX() {
    let {scale, translateX, translateY} = this.state.transform;
    const usableWidth = visualViewport.width;
    // this.props.size can't be trusted; Player.updateSize will soon recalculate
    // it using this formula
    const size = Math.floor(usableWidth / this.grid.cols);
    const gridWidth = this.grid.cols * size;
    translateX = (usableWidth - gridWidth) / 2;
    translateY = translateX;
    this.setState({transform: {scale, translateX, translateY}});
  }

  handleClueBarTouchEnd = (e) => {
    if (!this.touchingClueBarStart) return;
    const countAsTapBuffer = 4; // px
    const touch = e.changedTouches ? e.changedTouches[0] : e;
    const touchTravelDist = Math.abs(touch.pageY - this.touchingClueBarStart.pageY);
    const maxTravelDist = this.touchingClueBarMaxTravelDist || 0;
    this.touchingClueBarStart = null;
    this.touchingClueBarMaxTravelDist = 0;
    if (touchTravelDist <= countAsTapBuffer && maxTravelDist <= countAsTapBuffer) {
      this.flipDirection();
      this.keepFocus();
    }
  };

  handleClueBarTouchMove = (e) => {
    if (!this.touchingClueBarStart) return;
    const touch = e.touches[0];
    const travelDist = Math.abs(touch.pageY - this.touchingClueBarStart.pageY);
    this.touchingClueBarMaxTravelDist = Math.max(this.touchingClueBarMaxTravelDist || 0, travelDist);
  };

  handleClueBarTouchStart = (e) => {
    this.touchingClueBarStart = e.touches[0];
    this.touchingClueBarMaxTravelDist = 0;
  };

  handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      this.props.onSetCursorLock(true);
    }
    this._touchStartTransform = this.state.transform;
    this.lastTouchStart = Date.now();
    this.handleTouchMove(e);
  };

  handleTouchMove = (e) => {
    e.preventDefault(); // annoying -- https://www.chromestatus.com/features/5093566007214080
    e.stopPropagation();

    const transform = this.state.transform;
    const rect = this.zoomContainer.current.getBoundingClientRect();
    const previousAnchors = e.touches.length >= this.state.anchors.length && this.state.anchors;
    const anchors = _.map(e.touches, ({pageX, pageY}, i) => {
      const x = pageX - rect.x;
      const y = pageY - rect.y;
      return {
        pixelPosition: {
          x: (x - transform.translateX) / transform.scale,
          y: (y - transform.translateY) / transform.scale,
        },
        ...previousAnchors[i],
        touchPosition: {x, y},
      };
    });
    const nTransform = this.getTransform(anchors, transform);
    if (nTransform) {
      this.lastTouchMove = Date.now();
    }

    this.setState({
      anchors,
      transform: nTransform ?? this.state.transform,
    });
  };

  handleTouchEnd = (e) => {
    if (e.touches.length === 0 && this.state.anchors.length === 1 && this.lastTouchStart > Date.now() - 100) {
      this.props.onSetCursorLock(false);
      let el = e.target; // a descendant of grid for sure
      let rc;
      for (let i = 0; el && i < 20; i += 1) {
        if (el.className.includes('grid--cell')) {
          rc = el.getAttribute('data-rc');
          break;
        }
        el = el.parentElement;
      }
      if (rc) {
        const [r, c] = rc.split(' ').map((x) => Number(x));
        if (this.props.selected.r === r && this.props.selected.c === c) {
          this.props.onChangeDirection();
        } else {
          this._lastSelectionFromTap = true;
          this.props.onSetSelected({r, c});
        }
      }
      this.focusKeyboard();
    }
    e.preventDefault();
    this.handleTouchMove(e);
  };

  handleRightArrowTouchEnd = (e) => {
    e.preventDefault();
    this.handleAction('tab');
    this.keepFocus();
  };

  handleLeftArrowTouchEnd = (e) => {
    e.preventDefault();
    this.handleAction('tab', true);
    this.keepFocus();
  };

  gridContentRef = (e) => {
    if (!e) return;
    e.addEventListener('touchstart', this.handleTouchStart, {passive: false});
    e.addEventListener('touchmove', this.handleTouchMove, {passive: false});
    e.addEventListener('touchend', this.handleTouchEnd, {passive: false});
  };

  leftArrowRef = (e) => {
    if (e) e.addEventListener('touchend', this.handleLeftArrowTouchEnd, {passive: false});
  };

  clueBarRef = (e) => {
    if (!e) return;
    e.addEventListener('touchstart', this.handleClueBarTouchStart, {passive: false});
    e.addEventListener('touchmove', this.handleClueBarTouchMove, {passive: false});
    e.addEventListener('touchend', this.handleClueBarTouchEnd, {passive: false});
  };

  rightArrowRef = (e) => {
    if (e) e.addEventListener('touchend', this.handleRightArrowTouchEnd, {passive: false});
  };

  getTransform(anchors, {scale, translateX, translateY}) {
    if (!this.props.enablePan || anchors.length === 0) {
      return undefined;
    }

    const getCenterAndDistance = (point1, point2) => {
      if (!point1) {
        return {
          center: {x: 1, y: 1},
          distance: 1,
        };
      }
      if (!point2) {
        return {
          center: point1,
          distance: 1,
        };
      }
      return {
        center: {
          x: (point1.x + point2.x) / 2,
          y: (point1.y + point2.y) / 2,
        },
        distance: Math.sqrt(
          (point1.x - point2.x) * (point1.x - point2.x) + (point1.y - point2.y) * (point1.y - point2.y)
        ),
      };
    };
    const {center: pixelCenter, distance: pixelDistance} = getCenterAndDistance(
      ..._.map(anchors, ({pixelPosition}) => pixelPosition)
    );
    const {center: touchCenter, distance: touchDistance} = getCenterAndDistance(
      ..._.map(anchors, ({touchPosition}) => touchPosition)
    );
    let newScale = scale;
    let newTranslateX = translateX;
    let newTranslateY = translateY;
    if (anchors.length >= 2) {
      newScale = touchDistance / pixelDistance;
    }

    if (anchors.length >= 1) {
      newTranslateX = touchCenter.x - newScale * pixelCenter.x;
      newTranslateY = touchCenter.y - newScale * pixelCenter.y;
    }

    return {
      scale: newScale,
      translateX: newTranslateX,
      translateY: newTranslateY,
    };
  }

  get grid() {
    return new GridObject(this.props.grid);
  }

  getClueText({clueNumber = '', direction = ''} = {}) {
    return this.props.clues[direction]?.[clueNumber] ?? '';
  }

  get mainClue() {
    return {clueNumber: this.getSelectedClueNumber(), direction: this.props.direction};
  }

  renderGridContent() {
    const {scale, translateX, translateY} = this.state.transform;
    const style = {
      transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
      transition: this.state.anchors.length === 0 ? '.1s transform ease-out' : '',
    };
    return (
      <div
        style={{
          display: 'flex',
          flex: 1,
          flexShrink: 1,
          flexBasis: 1,
        }}
        className="mobile-grid-controls--grid-content"
        ref={this.gridContentRef}
      >
        <div
          style={{display: 'flex', flexGrow: 1}}
          className="mobile-grid-controls--zoom-container"
          ref={this.zoomContainer}
        >
          <div className="flex--grow mobile-grid-controls--zoom-content" style={style}>
            {this.props.children}
          </div>
        </div>
      </div>
    );
  }

  renderClueBar() {
    return (
      <div className="flex mobile-grid-controls--clue-bar-container">
        <div ref={this.leftArrowRef} style={{display: 'flex'}}>
          <MdKeyboardArrowLeft className="mobile-grid-controls--intra-clue left" onClick={this.keepFocus} />
        </div>
        <div
          role="button"
          tabIndex={0}
          style={{
            display: 'flex',
            flexGrow: 1,
            alignItems: 'center',
          }}
          className="mobile-grid-controls--clue-bar"
          ref={this.clueBarRef}
          onClick={this.keepFocus}
          onKeyDown={this.keepFocus}
        >
          <div className="mobile-grid-controls--clue-bar--clues--container">
            <div className="mobile-grid-controls--clue-bar--main">
              <div className="mobile-grid-controls--clue-bar--number">
                <Clue text={getClueAbbreviation(this.mainClue)} />
              </div>
              <div className="flex flex--grow mobile-grid-controls--clue-bar--text">
                <Clue text={this.getClueText(this.mainClue)} />
              </div>
            </div>
          </div>
        </div>
        <div ref={this.rightArrowRef} style={{display: 'flex'}}>
          <MdKeyboardArrowRight className="mobile-grid-controls--intra-clue left" onClick={this.keepFocus} />
        </div>
      </div>
    );
  }

  focusKeyboard() {
    const cursorPosition = this.inputRef.current.value.length;
    this.inputRef.current.selectionStart = cursorPosition;
    this.inputRef.current.selectionEnd = cursorPosition;
    this.inputRef.current.focus();
  }

  keepFocus = () => {
    if (!this.wasUnfocused || this.wasUnfocused >= Date.now() - 500) {
      this.focusKeyboard();
    }
  };

  handleInputFocus = (e) => {
    this.resetInput(e.target);
    this.focusKeyboard();
    this.logDebug(`focus ${e.target.name}`);
    if (e.target.name === '1') {
      this.selectNextClue(true);
    } else if (e.target.name === '3') {
      this.selectNextClue(false);
    }
    this.wasUnfocused = null;
  };

  handleInputBlur = (e) => {
    this.resetInput(e.target);
    if (e.target.name === '2') {
      this.wasUnfocused = Date.now();
    }
  };

  /**
   * Puts a hidden input box back in its initial state: a value of "$" with the cursor at the end. Only safe
   * when the keyboard has nothing to remember about the box's old contents (on focus/blur, or once it is
   * empty); see handleInputChange.
   */
  resetInput(textArea) {
    if (!textArea) return;
    textArea.value = '$';
    this.lastInputValues.set(textArea, '$');
    // On some devices, the cursor gets stuck at position 0, even after the input box resets its value to "$".
    // To counter that, wait until after the render and then set it to the end. Use a direct reference to the
    // input in the timeout closure; the event is not reliable, nor is this.inputRef.
    setTimeout(() => {
      textArea.selectionStart = textArea.value.length;
      textArea.selectionEnd = textArea.value.length;
    });
  }

  /**
   * There are hidden input boxes on the page, this handler listens for changes and then relays the inferred
   * user input to the crossword grid. The input box starts as "$" with the cursor at the end, and we infer
   * what the user did by diffing the new value against the previous one: "$" -> "$a" typed "a",
   * "$" -> "" was a backspace.
   *
   * Android keyboards (Gboard, FUTO, SwiftKey, ...) keep their own copy of the text before the cursor: they
   * compose a word across keystrokes, and backspace at the end of a word reopens it for editing. Any time we
   * rewrite the value while the box is focused, that copy goes stale, and the keyboard writes its stale word
   * back on the next key (the whole word typed again, sometimes around a displaced "$"). So the value is
   * never rewritten while focused: it grows as the user types, every event is diffed against the previous
   * value, and the box is only reset on focus/blur or once it is empty.
   */
  handleInputChange = (e) => {
    const textArea = e.target;
    const raw = textArea.value;
    // An IME that rewrites the whole value can push the "$" out of first place or drop it; move it back to the
    // front so the previous text isn't read as deleted and the displaced "$" isn't typed. A "$" the user typed
    // comes after the sentinel and is kept (theme puzzles use it). An empty value is a backspace over the "$".
    const input = raw === '' || raw.startsWith('$') ? raw : `$${raw.replace('$', '')}`;
    const prev = this.lastInputValues.get(textArea) ?? '$';
    this.lastInputValues.set(textArea, input);
    this.logDebug(`[${prev}] -> [${raw}] ${e.nativeEvent?.inputType ?? ''}`);

    const [rawDeleted, rawInserted] = diffValues(prev, input);
    // Grid letters are diffed over only the characters that reach the grid, so composing and then removing
    // something the grid ignores (the apostrophe in "don't") doesn't backspace over a real letter.
    const [deleted, inserted] = diffValues(gridChars(prev), gridChars(input));

    const steps = [];
    if (rawDeleted === 0 && (rawInserted === ' ' || rawInserted === '@')) {
      // hack hack
      // for some reason, email input [on ios safari & chrome mobile inspector] doesn't fire onChange at all when pressing spacebar
      steps.push(() => this.handleAction('space'));
    } else if (rawDeleted === 0 && rawInserted === ',') {
      steps.push(() => this.handleAction('tab'));
    } else if (rawDeleted === 0 && rawInserted === '.') {
      steps.push(() => this.props.onPressPeriod && this.props.onPressPeriod());
    } else {
      for (let i = 0; i < deleted; i += 1) {
        steps.push(() => this.backspace());
      }
      // support gesture-based keyboards that allow inputting words at a time
      for (const char of inserted) {
        if (ACTION_CHARS.includes(char)) continue;
        steps.push(() =>
          this.typeLetter(char.toUpperCase(), char.toUpperCase() === char, {
            nextClueIfFilled: this.props.autoAdvanceCursor,
          })
        );
      }
    }

    this.enqueueSteps(steps);

    // An empty box has no sentinel left to backspace over. The keyboard has no word to reopen in it either,
    // so this is the one in-focus reset that can't leave it with a stale copy.
    if (raw === '') {
      this.resetInput(textArea);
    }
  };

  /**
   * Each step reads props.selected / props.grid, which only update after the parent re-renders, so steps are
   * spaced 30ms apart (the pacing typeLetter already uses for its own deferred write) instead of all acting on
   * the same cell. The queue is shared across input events so a later event (e.g. the space after a
   * gesture-typed word) can't run ahead of letters still pending.
   */
  enqueueSteps(steps) {
    const now = Date.now();
    let at = Math.max(now, this.nextStepAt);
    for (const step of steps) {
      const delay = at - now;
      if (delay > 0) {
        setTimeout(step, delay);
      } else {
        step();
      }
      at += 30;
    }
    this.nextStepAt = at;
  }

  handleKeyUp = (ev) => {
    this.logDebug(`keyup ${ev.key ?? ''} [${ev.target.value}]`);
  };

  // With ?debug in the URL, show the last few input events under the grid so a tester's screenshot captures
  // exactly what their keyboard sent.
  logDebug(message) {
    if (!this.props.enableDebug) return;
    this.debugLog = [...this.debugLog.slice(-7), message];
    this.setState({dbgstr: this.debugLog.join('\n')});
  }

  renderMobileInputs() {
    // Initial value only; the boxes are uncontrolled and reset via resetInput(), never while typing.
    const inputValue = '$';
    const inputStyle = {
      opacity: 0,
      width: 0,
      height: 0,
      pointerEvents: 'none',
      touchEvents: 'none',
      position: 'absolute',
    };
    // The attributes below suppress iOS / mobile keyboard chrome that eats
    // vertical space:
    // - autoComplete="off" disables browser autofill suggestions (the
    //   prior value "none" is invalid and was treated like the default).
    // - autoCorrect/spellCheck off prevent the predictive-text accessory bar.
    // - inputMode="text" gives an explicit hint so iOS doesn't fall back to
    //   email-style behavior (which surfaced the credit-card / contacts /
    //   location AutoFill bar above the keyboard).
    // - data-*-ignore + data-form-type opt out of 1Password / LastPass /
    //   Bitwarden popups (mirrors the desktop GridControls fix).
    // Previously these textareas had type="email", which is invalid on a
    // <textarea> but iOS WebKit picked it up and rendered the autofill bar.

    const USE_TEXT_AREA = true;
    if (USE_TEXT_AREA) {
      return (
        <>
          <textarea
            name="1"
            defaultValue={inputValue}
            style={inputStyle}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            data-1p-ignore
            data-lpignore="true"
            data-bw-ignore="true"
            data-form-type="other"
            onBlur={this.handleInputBlur}
            onFocus={this.handleInputFocus}
            onChange={this.handleInputChange}
            onKeyDown={handleVolumeKeyBlur}
          />
          <textarea
            name="2"
            ref={this.inputRef}
            defaultValue={inputValue}
            style={inputStyle}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            data-1p-ignore
            data-lpignore="true"
            data-bw-ignore="true"
            data-form-type="other"
            onBlur={this.handleInputBlur}
            onFocus={this.handleInputFocus}
            onChange={this.handleInputChange}
            onKeyDown={handleVolumeKeyBlur}
            onKeyUp={this.handleKeyUp}
          />
          <textarea
            name="3"
            defaultValue={inputValue}
            style={inputStyle}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            data-1p-ignore
            data-lpignore="true"
            data-bw-ignore="true"
            data-form-type="other"
            onBlur={this.handleInputBlur}
            onFocus={this.handleInputFocus}
            onChange={this.handleInputChange}
            onKeyDown={handleVolumeKeyBlur}
          />
        </>
      );
    }
    return (
      <>
        <input
          name="1"
          defaultValue={inputValue}
          type="text"
          style={inputStyle}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          data-1p-ignore
          data-lpignore="true"
          data-bw-ignore="true"
          data-form-type="other"
          onBlur={this.handleInputBlur}
          onFocus={this.handleInputFocus}
          onChange={this.handleInputChange}
        />
        <input
          name="2"
          ref={this.inputRef}
          defaultValue={inputValue}
          type="text"
          style={inputStyle}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          data-1p-ignore
          data-lpignore="true"
          data-bw-ignore="true"
          data-form-type="other"
          onBlur={this.handleInputBlur}
          onFocus={this.handleInputFocus}
          onChange={this.handleInputChange}
          onKeyUp={this.handleKeyUp}
        />
        <input
          name="3"
          defaultValue={inputValue}
          type="text"
          style={inputStyle}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          data-1p-ignore
          data-lpignore="true"
          data-bw-ignore="true"
          data-form-type="other"
          onBlur={this.handleInputBlur}
          onFocus={this.handleInputFocus}
          onChange={this.handleInputChange}
        />
      </>
    );
  }

  render() {
    return (
      <div ref={this.gridControlsRef} className="mobile-grid-controls">
        {this.renderClueBar()}
        {this.renderGridContent()}
        {this.renderMobileInputs()}
        {this.props.enableDebug && (
          <pre style={{whiteSpace: 'pre-wrap', fontSize: 11}}>{this.state.dbgstr || 'No message'}</pre>
        )}
        <RunOnce effect={this.boundCenterGridX} />
      </div>
    );
  }
}

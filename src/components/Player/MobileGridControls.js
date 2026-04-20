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

export default class MobileGridControls extends GridControls {
  constructor() {
    super();
    this.state = {
      anchors: [],
      transform: {scale: 1, translateX: 0, translateY: 0},
      dbgstr: undefined,
    };
    this.prvInput = '';
    this.inputRef = React.createRef();
    this.zoomContainer = React.createRef();
    this.gridControlsRef = React.createRef();
    this.wasUnfocused = Date.now() - 1000;
    this.lastTouchMove = Date.now();
    this.boundCenterGridX = () => this.centerGridX();
    this._fitOnScreenTimer = null;
    this._touchStartTransform = null;
  }

  componentDidMount() {
    super.componentDidMount();
    // Listen to visualViewport resize events to handle keyboard show/hide on mobile.
    // window.resize doesn't reliably fire on iOS Safari when the virtual keyboard
    // appears/disappears, but visualViewport.resize does.
    if (window.visualViewport) {
      this._handleViewportResize = () => {
        // Use fitOnScreen(false) — just enforce boundaries without forcing
        // the selected cell into view. The keyboard appears from the bottom,
        // so the cell was already visible; aggressive panning just creates
        // unnecessary whitespace.
        this.fitOnScreen();
      };
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
    // doesn't change the transform, so we skip fitOnScreen to avoid the general
    // Y clamp fighting with the cell-specific clamp (which caused bouncing).
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
    if (prevProps.selected.r !== this.props.selected.r || prevProps.selected.c !== this.props.selected.c) {
      clearTimeout(this._fitOnScreenTimer);
      this._fitOnScreenTimer = setTimeout(() => this.fitOnScreen(true), 200);
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
    // Only apply general Y clamping for non-cell-selection calls (e.g. pinch-zoom).
    // For cell selection, the fitCurrentClue block handles panning only when needed,
    // avoiding unwanted grid movement when switching between visible cells.
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

      // Only adjust horizontal panning if the cell is actually off-screen
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
    this.focusKeyboard();
    this.setState({dbgstr: `INPUT FOCUS ${e.target.name}`});
    if (e.target.name === '1') {
      this.selectNextClue(true);
    } else if (e.target.name === '3') {
      this.selectNextClue(false);
    }
    this.wasUnfocused = null;
  };

  handleInputBlur = (e) => {
    if (e.target.name === '2') {
      this.wasUnfocused = Date.now();
    }
  };

  /**
   * There are hidden input boxes on the page, this handler listens for changes and then relays the inferred
   * user input to the crossword grid. The input box has a well-defined initial state that we always reset to:
   * It has a value of "$", and the cursor is always at the end.
   *
   * By comparing with this initial state, we can infer what the user did, i.e. if the new value is "$a" they
   * input the letter "a", if the new value is "", then they did a backspace.
   */
  handleInputChange = (e) => {
    const textArea = e.target;
    let input = textArea.value;
    this.setState({dbgstr: `INPUT IS [${input}]`});

    if (input === '') {
      this.backspace();

      // On some devices, the cursor gets stuck at position 0, even after the input box resets its value to "$".
      // To counter that, wait until after the render and then set it to the end. Use a direct reference to the
      // input in the timeout closure; the event is not reliable, nor is this.inputRef.
      setTimeout(() => {
        textArea.selectionStart = textArea.value.length;
      });
      return;
    }

    // get rid of the $ at the beginning
    input = input.substring(1);
    if (input === ' ' || input === '@') {
      // hack hack
      // for some reason, email input [on ios safari & chrome mobile inspector] doesn't fire onChange at all when pressing spacebar
      this.handleAction('space');
    } else if (input === ',') {
      this.handleAction('tab');
    } else if (input === '.') {
      this.props.onPressPeriod && this.props.onPressPeriod();
    } else {
      // support gesture-based keyboards that allow inputting words at a time
      let delay = 0;
      for (const char of input) {
        if (validLetter(char.toUpperCase())) {
          this.setState({dbgstr: `TYPE letter ${char.toUpperCase()}`});
          if (delay) {
            setTimeout(() => {
              this.typeLetter(char.toUpperCase(), char.toUpperCase() === char, {
                nextClueIfFilled: this.props.autoAdvanceCursor,
              });
            }, delay);
          } else {
            this.typeLetter(char.toUpperCase(), char.toUpperCase() === char, {
              nextClueIfFilled: this.props.autoAdvanceCursor,
            });
          }
          delay += 20;
        }
      }
    }
  };

  handleKeyUp = (ev) => {
    this.setState({dbgstr: `[${ev.target.value}]`});
  };

  renderMobileInputs() {
    // This resets the input to contain just "$" on every render.
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
            value={inputValue}
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
          <textarea
            name="2"
            ref={this.inputRef}
            value={inputValue}
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
          <textarea
            name="3"
            value={inputValue}
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
    return (
      <>
        <input
          name="1"
          value={inputValue}
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
          value={inputValue}
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
          value={inputValue}
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
        {this.props.enableDebug && (this.state.dbgstr || 'No message')}
        <RunOnce effect={this.boundCenterGridX} />
      </div>
    );
  }
}

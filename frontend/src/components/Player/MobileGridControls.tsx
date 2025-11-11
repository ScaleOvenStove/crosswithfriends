import './css/mobileGridControls.css';

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {Box} from '@mui/material';
import {MdKeyboardArrowLeft, MdKeyboardArrowRight} from 'react-icons/md';
import _ from 'lodash';
import Clue from './ClueText';
import GridObject from '@crosswithfriends/shared/lib/wrappers/GridWrapper';
import {useGridControls, UseGridControlsProps, GridControlsActions} from './useGridControls';

const RunOnce = ({effect}) => {
  useEffect(() => {
    effect();
  }, []);
  return null;
};

interface MobileGridControlsProps extends UseGridControlsProps {
  size: number;
  enablePan?: boolean;
  onSetCursorLock?: (locked: boolean) => void;
  onChangeDirection?: () => void;
  enableDebug?: boolean;
  children?: React.ReactNode;
  actions?: Partial<GridControlsActions>;
}

export interface MobileGridControlsRef {
  focusKeyboard?: () => void;
}

const MobileGridControls = forwardRef<MobileGridControlsRef, MobileGridControlsProps>((props, ref) => {
  const [anchors, setAnchors] = useState<any[]>([]);
  const [transform, setTransform] = useState({scale: 1, translateX: 0, translateY: 0, lastFitOnScreen: 0});
  const [dbgstr, setDbgstr] = useState<string | undefined>(undefined);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const zoomContainer = useRef<HTMLDivElement>(null);
  const wasUnfocused = useRef<number>(Date.now() - 1000);
  const lastTouchMove = useRef<number>(Date.now());
  const lastTouchStart = useRef<number>(0);
  const touchingClueBarStart = useRef<any>(null);

  const gridControls = useGridControls(props, props.actions);
  const {
    grid: gridInstance,
    getSelectedClueNumber,
    flipDirection,
    selectNextClue,
    backspace,
    typeLetter,
    validLetter,
    handleAction,
  } = gridControls;

  const grid = useMemo(() => new GridObject(props.grid), [props.grid]);

  const fitOnScreen = useCallback(
    (fitCurrentClue?: boolean) => {
      if (!fitCurrentClue && transform.lastFitOnScreen > Date.now() - 100) return;

      if (!zoomContainer.current) return;
      const rect = zoomContainer.current.getBoundingClientRect();
      let {scale, translateX, translateY} = transform;
      const {selected, size} = props;

      // default scale already fits screen width; no need to zoom out further
      scale = Math.max(1, scale);

      // this shouldn't go larger than half a tile (scaled) for now; the min X/Y
      // calculations don't work when the difference between the usable size and
      // grid size are positive, but smaller than PADDING
      const PADDING = (size / 2) * scale; // px

      const usableWidth = visualViewport.width;
      const gridWidth = grid.cols * size * scale;
      const minX = Math.min(0, usableWidth - gridWidth - PADDING);
      const maxX = PADDING;
      translateX = Math.min(Math.max(translateX, minX), maxX);

      const usableHeight = visualViewport.height - rect.y;
      const gridHeight = grid.rows * size * scale;
      const minY = Math.min(0, usableHeight - gridHeight - PADDING);
      const maxY = PADDING;
      translateY = Math.min(Math.max(translateY, minY), maxY);

      if (fitCurrentClue) {
        const posX = selected.c * size;
        const posY = selected.r * size;
        const paddingX = (rect.width - grid.cols * size) / 2;
        const paddingY = (rect.height - grid.rows * size) / 2;
        const tX = (posX + paddingX) * scale;
        const tY = (posY + paddingY) * scale;
        translateX = _.clamp(translateX, -tX, rect.width - tX - size * scale);
        translateY = _.clamp(translateY, -tY, rect.height - tY - size * scale);
      }

      setTransform({
        scale,
        translateX,
        translateY,
        lastFitOnScreen: Date.now(),
      });
    },
    [transform, props, grid]
  );

  useEffect(() => {
    if (anchors.length === 0) {
      fitOnScreen();
    }
  }, [transform.scale, transform.translateX, transform.translateY, anchors.length, fitOnScreen]);

  useEffect(() => {
    fitOnScreen(true);
  }, [props.selected.r, props.selected.c, fitOnScreen]);

  const centerGridX = useCallback(() => {
    const usableWidth = visualViewport.width;
    // this.props.size can't be trusted; Player.updateSize will soon recalculate
    // it using this formula
    const size = Math.floor(usableWidth / grid.cols);
    const gridWidth = grid.cols * size;
    const translateX = (usableWidth - gridWidth) / 2;
    const translateY = translateX;
    setTransform((prev) => ({...prev, scale: prev.scale, translateX, translateY}));
  }, [grid]);

  const handleClueBarTouchEnd = useCallback(
    (e: TouchEvent) => {
      const countAsTapBuffer = 6; // px
      const touchTravelDist = Math.abs(e.touches[0]?.pageY - touchingClueBarStart.current?.pageY || 0);
      touchingClueBarStart.current = null;
      if (touchTravelDist <= countAsTapBuffer) {
        flipDirection();
        keepFocus();
      }
    },
    [flipDirection]
  );

  const handleClueBarTouchStart = useCallback((e: TouchEvent) => {
    touchingClueBarStart.current = e.touches[0];
  }, []);

  const getTransform = useCallback(
    (
      anchors: any[],
      {scale, translateX, translateY}: {scale: number; translateX: number; translateY: number}
    ) => {
      if (!props.enablePan) {
        return;
      }

      const getCenterAndDistance = (point1: any, point2: any) => {
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
      if (anchors.length >= 2) {
        newScale = touchDistance / pixelDistance;
      }

      let newTranslateX = translateX;
      let newTranslateY = translateY;
      if (anchors.length >= 1) {
        newTranslateX = touchCenter.x - newScale * pixelCenter.x;
        newTranslateY = touchCenter.y - newScale * pixelCenter.y;
      }

      return {
        scale: newScale,
        translateX: newTranslateX,
        translateY: newTranslateY,
      };
    },
    [props.enablePan]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      e.preventDefault(); // annoying -- https://www.chromestatus.com/features/5093566007214080
      e.stopPropagation();

      if (!zoomContainer.current) return;
      const rect = zoomContainer.current.getBoundingClientRect();
      const previousAnchors = e.touches.length >= anchors.length ? anchors : [];
      const newAnchors = _.map(e.touches, ({pageX, pageY}, i) => {
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
      const nTransform = getTransform(newAnchors, transform);
      if (nTransform) {
        lastTouchMove.current = Date.now();
      }

      setAnchors(newAnchors);
      if (nTransform) {
        setTransform((prev) => ({...prev, ...nTransform}));
      }
    },
    [anchors, transform, getTransform]
  );

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length === 2) {
        props.onSetCursorLock?.(true);
      }
      lastTouchStart.current = Date.now();
      handleTouchMove(e);
    },
    [props.onSetCursorLock, handleTouchMove]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length === 0 && anchors.length === 1 && lastTouchStart.current > Date.now() - 100) {
        props.onSetCursorLock?.(false);
        let el = e.target as HTMLElement; // a descendant of grid for sure
        let rc;
        for (let i = 0; el && i < 20; i += 1) {
          if (el.className.includes('grid--cell')) {
            rc = el.getAttribute('data-rc');
            break;
          }
          el = el.parentElement as HTMLElement;
        }
        if (rc) {
          const [r, c] = rc.split(' ').map((x) => Number(x));
          if (props.selected.r === r && props.selected.c === c) {
            props.onChangeDirection?.();
          } else {
            props.onSetSelected({r, c});
          }
        }
        focusKeyboard();
      }
      e.preventDefault();
      handleTouchMove(e);
    },
    [anchors.length, props, handleTouchMove, focusKeyboard]
  );

  const handleRightArrowTouchEnd = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();
      handleAction('tab');
      keepFocus();
    },
    [handleAction]
  );

  const handleLeftArrowTouchEnd = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();
      handleAction('tab', true);
      keepFocus();
    },
    [handleAction]
  );

  const getClueAbbreviation = useCallback(
    ({clueNumber = '', direction = ''}: {clueNumber?: string | number; direction?: string} = {}) => {
      return `${clueNumber}${direction.substring(0, 1).toUpperCase()}`;
    },
    []
  );

  const getClueText = useCallback(
    ({clueNumber = '', direction = ''}: {clueNumber?: string | number; direction?: string} = {}) => {
      return props.clues[direction]?.[clueNumber] ?? '';
    },
    [props.clues]
  );

  const mainClue = useMemo(() => {
    return {clueNumber: getSelectedClueNumber(), direction: props.direction};
  }, [getSelectedClueNumber, props.direction]);

  const focusKeyboard = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.selectionStart = inputRef.current.selectionEnd = inputRef.current.value.length;
      inputRef.current.focus();
    }
  }, []);

  useImperativeHandle(ref, () => ({
    focusKeyboard,
  }));

  const keepFocus = useCallback(() => {
    if (!wasUnfocused.current || wasUnfocused.current >= Date.now() - 500) {
      focusKeyboard();
    }
  }, [focusKeyboard]);

  const handleInputFocus = useCallback(
    (e: React.FocusEvent<HTMLTextAreaElement>) => {
      focusKeyboard();
      setDbgstr(`INPUT FOCUS ${e.target.name}`);
      if (e.target.name === '1') {
        selectNextClue(true);
      } else if (e.target.name === '3') {
        selectNextClue(false);
      }
      wasUnfocused.current = 0;
    },
    [focusKeyboard, selectNextClue]
  );

  const handleInputBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (e.target.name === '2') {
      wasUnfocused.current = Date.now();
    }
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const textArea = e.target;
      let input = textArea.value;
      setDbgstr(`INPUT IS [${input}]`);

      if (input === '') {
        backspace();

        // On some devices, the cursor gets stuck at position 0, even after the input box resets its value to "$".
        // To counter that, wait until after the render and then set it to the end. Use a direct reference to the
        // input in the timeout closure; the event is not reliable, nor is this.inputRef.
        setTimeout(() => (textArea.selectionStart = textArea.value.length));
        return;
      }

      // get rid of the $ at the beginning
      input = input.substring(1);
      if (input === ' ' || input === '@') {
        // hack hack
        // for some reason, email input [on ios safari & chrome mobile inspector] doesn't fire onChange at all when pressing spacebar
        handleAction('space');
      } else if (input === ',') {
        handleAction('tab');
      } else if (input === '.') {
        props.onPressPeriod?.();
      } else {
        // support gesture-based keyboards that allow inputting words at a time
        let delay = 0;
        for (const char of input) {
          if (validLetter(char.toUpperCase())) {
            setDbgstr(`TYPE letter ${char.toUpperCase()}`);
            if (delay) {
              setTimeout(() => {
                typeLetter(char.toUpperCase(), char.toUpperCase() === char, {nextClueIfFilled: true});
              }, delay);
            } else {
              typeLetter(char.toUpperCase(), char.toUpperCase() === char, {nextClueIfFilled: true});
            }
            delay += 20;
          }
        }
      }
    },
    [backspace, handleAction, props.onPressPeriod, validLetter, typeLetter]
  );

  const handleKeyUp = useCallback((ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
    setDbgstr(`[${ev.target.value}]`);
  }, []);

  const gridContentRef = useCallback(
    (e: HTMLDivElement | null) => {
      if (!e) return;
      e.addEventListener('touchstart', handleTouchStart as any, {passive: false});
      e.addEventListener('touchmove', handleTouchMove as any, {passive: false});
      e.addEventListener('touchend', handleTouchEnd as any, {passive: false});
    },
    [handleTouchStart, handleTouchMove, handleTouchEnd]
  );

  const renderGridContent = useCallback(() => {
    const {scale, translateX, translateY} = transform;
    const style = {
      transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
      transition: anchors.length === 0 ? '.1s transform ease-out' : '',
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
        ref={gridContentRef}
      >
        <div
          style={{display: 'flex', flexGrow: 1}}
          className="mobile-grid-controls--zoom-container"
          ref={zoomContainer}
        >
          <Box sx={{flex: 1}} className="mobile-grid-controls--zoom-content" style={style}>
            {props.children}
          </Box>
        </div>
      </div>
    );
  }, [transform, anchors.length, gridContentRef, props.children]);

  const leftArrowRef = useCallback(
    (e: HTMLDivElement | null) => {
      if (e) {
        e.addEventListener('touchend', handleLeftArrowTouchEnd as any, {passive: false});
      }
    },
    [handleLeftArrowTouchEnd]
  );

  const clueBarRef = useCallback(
    (e: HTMLDivElement | null) => {
      if (!e) return;
      e.addEventListener('touchstart', handleClueBarTouchStart as any, {passive: false});
      e.addEventListener('touchend', handleClueBarTouchEnd as any, {passive: false});
    },
    [handleClueBarTouchStart, handleClueBarTouchEnd]
  );

  const rightArrowRef = useCallback(
    (e: HTMLDivElement | null) => {
      if (e) {
        e.addEventListener('touchend', handleRightArrowTouchEnd as any, {passive: false});
      }
    },
    [handleRightArrowTouchEnd]
  );

  const renderClueBar = useCallback(() => {
    return (
      <Box className="mobile-grid-controls--clue-bar-container" sx={{display: 'flex'}}>
        <div ref={leftArrowRef} style={{display: 'flex'}}>
          <MdKeyboardArrowLeft className="mobile-grid-controls--intra-clue left" onClick={keepFocus} />
        </div>
        <div
          style={{
            display: 'flex',
            flexGrow: 1,
            alignItems: 'center',
          }}
          className="mobile-grid-controls--clue-bar"
          ref={clueBarRef}
          onClick={keepFocus}
        >
          <div className="mobile-grid-controls--clue-bar--clues--container">
            <div className="mobile-grid-controls--clue-bar--main">
              <div className="mobile-grid-controls--clue-bar--number">
                <Clue text={getClueAbbreviation(mainClue)} />
              </div>
              <Box className="mobile-grid-controls--clue-bar--text" sx={{flex: 1, display: 'flex'}}>
                <Clue text={getClueText(mainClue)} />
              </Box>
            </div>
          </div>
        </div>
        <div ref={rightArrowRef} style={{display: 'flex'}}>
          <MdKeyboardArrowRight className="mobile-grid-controls--intra-clue left" onClick={keepFocus} />
        </div>
      </Box>
    );
  }, [leftArrowRef, clueBarRef, rightArrowRef, keepFocus, getClueAbbreviation, mainClue, getClueText]);

  const renderMobileInputs = useCallback(() => {
    const inputProps = {
      value: '$', // This resets the input to contain just "$" on every render.
      type: 'email' as const,
      style: {
        opacity: 0,
        width: 0,
        height: 0,
        pointerEvents: 'none' as const,
        touchEvents: 'none' as const,
        position: 'absolute' as const,
      },
      autoComplete: 'none' as const,
      autoCapitalize: 'none' as const,
      onBlur: handleInputBlur,
      onFocus: handleInputFocus,
      onChange: handleInputChange,
    };
    const USE_TEXT_AREA = true;
    if (USE_TEXT_AREA) {
      return (
        <>
          <textarea name="1" {...inputProps} />
          <textarea name="2" ref={inputRef} {...inputProps} onKeyUp={handleKeyUp} />
          <textarea name="3" {...inputProps} />
        </>
      );
    }
    return (
      <>
        <input name="1" {...inputProps} />
        <input name="2" ref={inputRef as any} {...inputProps} onKeyUp={handleKeyUp as any} />
        <input name="3" {...inputProps} />
      </>
    );
  }, [handleInputBlur, handleInputFocus, handleInputChange, handleKeyUp]);

  return (
    <div className="mobile-grid-controls">
      {renderClueBar()}
      {renderGridContent()}
      {renderMobileInputs()}
      {/* {this.renderMobileKeyboard()} */}
      {props.enableDebug && (dbgstr || 'No message')}
      <RunOnce effect={centerGridX} />
    </div>
  );
});

MobileGridControls.displayName = 'MobileGridControls';

export default MobileGridControls;

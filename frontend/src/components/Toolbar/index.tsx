import './css/index.css';
import React, {useRef, useEffect, useCallback} from 'react';
import {MdBorderAll, MdChatBubble, MdList, MdSlowMotionVideo} from 'react-icons/md';
import {AiOutlineMenuFold, AiOutlineMenuUnfold} from 'react-icons/ai';
import {RiPaintFill, RiPaintLine} from 'react-icons/ri';
import {Box, Stack} from '@mui/material';
import {Link} from 'react-router-dom';
import swal from '@sweetalert/with-react';
import Clock from './Clock';
import ActionMenu from './ActionMenu';
import Popup from './Popup';
import {isMobile} from '@crosswithfriends/shared/lib/jsUtils';

const pencilColorKey = 'pencil-color';

interface Props {
  mobile?: boolean;
  startTime?: number;
  stopTime?: number;
  pausedTime?: number;
  onStartClock?: () => void;
  onPauseClock?: () => void;
  solved?: boolean;
  replayMode?: boolean;
  expandMenu?: boolean;
  v2?: boolean;
  isPaused?: boolean;
  onRefocus?: () => void;
  onTogglePencil?: () => void;
  onToggleAutocheck?: () => void;
  onToggleListView?: () => void;
  onToggleChat?: () => void;
  onToggleExpandMenu?: () => void;
  onCheck?: (scope: string) => void;
  onReveal?: (scope: string) => void;
  onReset?: (scope: string, force?: boolean) => void;
  onResetClock?: () => void;
  onKeybind?: (mode: string) => void;
  vimMode?: boolean;
  onToggleVimMode?: () => void;
  onToggleColorAttributionMode?: () => void;
  colorAttributionMode?: boolean;
  listMode?: boolean;
  pencilMode?: boolean;
  autocheckMode?: boolean;
  pid?: number;
  gid?: string;
}

const Toolbar: React.FC<Props> = (props) => {
  const pencilColorPickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--pencil-color',
      localStorage.getItem(pencilColorKey) || '#888888'
    );
  }, []);

  const handleBlur = useCallback((): void => {
    if (props.onRefocus) {
      props.onRefocus();
    }
  }, [props.onRefocus]);

  const handleMouseDown = useCallback((e: React.MouseEvent): void => {
    e.preventDefault();
  }, []);

  const handlePencilClick = useCallback(
    (e: React.MouseEvent): void => {
      e.preventDefault();
      if (props.onTogglePencil) {
        props.onTogglePencil();
      }
    },
    [props.onTogglePencil]
  );

  const handlePencilColorPickerClick = useCallback((e: React.MouseEvent): void => {
    e.stopPropagation();
    let hexColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--pencil-color')
      .trim()
      .substring(1);
    if (hexColor.length === 3) {
      hexColor = hexColor
        .split('')
        .map(function (hex) {
          return hex + hex;
        })
        .join('');
    }
    if (pencilColorPickerRef.current) {
      pencilColorPickerRef.current.value = '#' + hexColor;
      pencilColorPickerRef.current.click();
    }
  }, []);

  const handlePencilColorPickerChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const color = e.target.value;
    document.documentElement.style.setProperty('--pencil-color', color);
    localStorage.setItem(pencilColorKey, color);
  }, []);

  const handleAutocheckClick = useCallback(
    (e: React.MouseEvent): void => {
      e.preventDefault();
      if (props.onToggleAutocheck) {
        props.onToggleAutocheck();
      }
    },
    [props.onToggleAutocheck]
  );

  const handleToggleListView = useCallback(
    (e: React.MouseEvent): void => {
      e.preventDefault();
      if (props.onToggleListView) {
        props.onToggleListView();
      }
    },
    [props.onToggleListView]
  );

  const handleToggleChat = useCallback(
    (e: React.MouseEvent): void => {
      e.preventDefault();
      if (props.onToggleChat) {
        props.onToggleChat();
      }
    },
    [props.onToggleChat]
  );

  const handleToggleExpandMenu = useCallback(
    (e: React.MouseEvent): void => {
      e.preventDefault();
      if (props.onToggleExpandMenu) {
        props.onToggleExpandMenu();
      }
    },
    [props.onToggleExpandMenu]
  );

  const check = useCallback(
    (scopeString: string): void => {
      if (props.onCheck) {
        props.onCheck(scopeString);
      }
    },
    [props.onCheck]
  );

  const reveal = useCallback(
    (scopeString: string): void => {
      swal({
        title: `Are you sure you want to show the ${scopeString}?`,
        text: `All players will be able to see the ${scopeString}'s answer.`,
        icon: 'warning',
        buttons: true,
        dangerMode: true,
      }).then((shouldReveal: boolean) => {
        if (shouldReveal && props.onReveal) {
          props.onReveal(scopeString);
        }
      });
    },
    [props.onReveal]
  );

  const reset = useCallback(
    (scopeString: string, force: boolean = false): void => {
      if (props.onReset) {
        props.onReset(scopeString, force);
      }
    },
    [props.onReset]
  );

  const confirmResetPuzzle = useCallback((callback: () => void): void => {
    swal({
      title: `Are you sure you want to reset the entire puzzle?`,
      icon: 'warning',
      buttons: true,
      dangerMode: true,
    }).then((confirmed: boolean) => {
      if (confirmed) {
        callback();
      }
    });
  }, []);

  const resetPuzzleAndTimer = useCallback((): void => {
    confirmResetPuzzle(() => {
      reset('puzzle');
      if (props.onResetClock) {
        props.onResetClock();
      }
    });
  }, [confirmResetPuzzle, reset, props.onResetClock]);

  const handleVimModeClick = useCallback((): void => {
    if (props.onToggleVimMode) {
      props.onToggleVimMode();
    }
  }, [props.onToggleVimMode]);

  const renderClockControl = useCallback((): JSX.Element => {
    const {startTime, onStartClock, onPauseClock} = props;
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
  }, [props.startTime, props.onStartClock, props.onPauseClock, handleMouseDown]);

  const renderCheckMenu = useCallback((): JSX.Element => {
    return (
      <div className="toolbar--menu check">
        <ActionMenu
          label="Check"
          onBlur={handleBlur}
          actions={{
            Square: () => check('square'),
            Word: () => check('word'),
            Puzzle: () => check('puzzle'),
          }}
        />
      </div>
    );
  }, [handleBlur, check]);

  const renderRevealMenu = useCallback((): JSX.Element => {
    return (
      <div className="toolbar--menu reveal">
        <ActionMenu
          label="Reveal"
          onBlur={handleBlur}
          actions={{
            Square: () => reveal('square'),
            Word: () => reveal('word'),
            Puzzle: () => reveal('puzzle'),
          }}
        />
      </div>
    );
  }, [handleBlur, reveal]);

  const renderResetMenu = useCallback((): JSX.Element => {
    return (
      <ActionMenu
        label="Reset"
        onBlur={handleBlur}
        actions={{
          Square: () => reset('square'),
          Word: () => reset('word'),
          Puzzle: () => confirmResetPuzzle(() => reset('puzzle')),
          'Puzzle and Timer': resetPuzzleAndTimer,
        }}
      />
    );
  }, [handleBlur, reset, confirmResetPuzzle, resetPuzzleAndTimer]);

  const renderExtrasMenu = useCallback((): JSX.Element => {
    const {vimMode, onToggleColorAttributionMode, pid} = props;
    const vimModeLabel = vimMode ? 'Disable Vim Mode' : 'Enable Vim Mode';
    return (
      <ActionMenu
        label="Extras"
        onBlur={handleBlur}
        actions={{
          [vimModeLabel]: handleVimModeClick,
          'Color Attribution': onToggleColorAttributionMode || (() => {}),
          'List View': props.onToggleListView || (() => {}),
          Pencil: props.onTogglePencil || (() => {}),
          Autocheck: props.onToggleAutocheck || (() => {}),
          'Create new game link': () => window.open(`/beta/play/${pid}?new=1`, '_blank'),
        }}
      />
    );
  }, [props, handleBlur, handleVimModeClick]);

  const renderPlayAgainLink = useCallback((): JSX.Element => {
    const {pid, onResetClock} = props;
    return (
      <ActionMenu
        label="Play Again"
        onBlur={handleBlur}
        actions={{
          'Reset this game': () =>
            confirmResetPuzzle(() => {
              reset('puzzle', true);
              if (onResetClock) {
                onResetClock();
              }
            }),
          'Create new game link': () => window.open(`/beta/play/${pid}?new=1`, '_blank'),
        }}
      />
    );
  }, [props, handleBlur, confirmResetPuzzle, reset]);

  const renderReplayLink = useCallback((): JSX.Element => {
    const replayLink = `/beta/replay/${props.gid}`;
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
  }, [props.gid]);

  const renderColorAttributionToggle = useCallback((): JSX.Element => {
    const {colorAttributionMode, onToggleColorAttributionMode} = props;
    if (isMobile()) {
      return (
        <div
          className={`toolbar--color-attribution-toggle`}
          title="Color Attribution"
          onClick={onToggleColorAttributionMode}
        >
          {colorAttributionMode ? <RiPaintFill /> : <RiPaintLine />}
        </div>
      );
    }
    return (
      <div
        className={`toolbar--color-attribution-toggle${colorAttributionMode ? ' on' : ''}`}
        title="Color Attribution"
        onClick={onToggleColorAttributionMode}
      >
        <RiPaintFill />
      </div>
    );
  }, [props.colorAttributionMode, props.onToggleColorAttributionMode]);

  const renderListViewButton = useCallback((): JSX.Element => {
    const {listMode, mobile} = props;
    if (mobile) {
      if (listMode) {
        return (
          <MdBorderAll
            onClick={handleToggleListView}
            className={`toolbar--list-view${listMode ? ' on' : ''}`}
          />
        );
      }
      return (
        <MdList onClick={handleToggleListView} className={`toolbar--list-view${listMode ? ' on' : ''}`} />
      );
    }
    return (
      <div
        className={`toolbar--list-view${listMode ? ' on' : ''}`}
        onClick={handleToggleListView}
        onMouseDown={handleMouseDown}
        title="List View"
      >
        <i className="fa fa-list" />
      </div>
    );
  }, [props.listMode, props.mobile, handleToggleListView, handleMouseDown]);

  const renderChatButton = useCallback((): JSX.Element => {
    return <MdChatBubble onClick={handleToggleChat} className="toolbar--chat" />;
  }, [handleToggleChat]);

  const renderExpandMenuButton = useCallback((): JSX.Element => {
    const {expandMenu} = props;
    return expandMenu ? (
      <AiOutlineMenuFold onClick={handleToggleExpandMenu} className="toolbar--expand" />
    ) : (
      <AiOutlineMenuUnfold onClick={handleToggleExpandMenu} className="toolbar--expand" />
    );
  }, [props.expandMenu, handleToggleExpandMenu]);

  const renderPencil = useCallback((): JSX.Element => {
    const {pencilMode} = props;
    return (
      <div
        className={`toolbar--pencil${pencilMode ? ' on' : ''}`}
        onClick={handlePencilClick}
        onMouseDown={handleMouseDown}
        title="Shortcut: ."
      >
        <i className="fa fa-pencil" />
        {pencilMode && (
          <div className={'toolbar--pencil-color-picker-container'}>
            <div className={'toolbar--pencil-color-picker'} onClick={handlePencilColorPickerClick}></div>
            <input
              type="color"
              ref={pencilColorPickerRef}
              onClick={(e) => e.stopPropagation()}
              onChange={handlePencilColorPickerChange}
            ></input>
          </div>
        )}
      </div>
    );
  }, [
    props.pencilMode,
    handlePencilClick,
    handleMouseDown,
    handlePencilColorPickerClick,
    handlePencilColorPickerChange,
  ]);

  const renderAutocheck = useCallback((): JSX.Element => {
    const {autocheckMode} = props;
    return (
      <div
        className={`toolbar--autocheck${autocheckMode ? ' on' : ''}`}
        onClick={handleAutocheckClick}
        onMouseDown={handleMouseDown}
        title="Autocheck"
      >
        <i className="fa fa-check-square" />
      </div>
    );
  }, [props.autocheckMode, handleAutocheckClick, handleMouseDown]);

  const renderInfo = useCallback((): JSX.Element => {
    return (
      <div className="toolbar--info">
        <Popup icon="fa-info-circle" onBlur={handleBlur}>
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
                <td>
                  Fill in current cell and advance cursor to next unfilled cell in the same word, if any
                </td>
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
                  <code>Alt</code> + <code>S</code>, <code>W</code>, or <code>P</code>
                </td>
                <td>
                  Check <b>S</b>quare, <b>W</b>ord, or <b>P</b>uzzle
                </td>
              </tr>
              <tr>
                <td>
                  <code>Alt</code> + <code>Shift</code> + <code>S</code>, <code>W</code>, or <code>P</code>
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
                <td>Move cursor to first unfilled square of next or previous unfilled clue</td>
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
  }, [handleBlur]);

  const {
    mobile,
    startTime,
    stopTime,
    pausedTime,
    onStartClock,
    onPauseClock,
    solved,
    replayMode,
    expandMenu,
  } = props;

  if (mobile) {
    return (
      <Box className="toolbar--mobile" sx={{display: 'flex', alignItems: 'center'}}>
        <Box className="toolbar--mobile--top" sx={{flex: 1, display: 'flex', alignItems: 'center'}}>
          <Link to="/">CWF</Link>{' '}
          {!expandMenu ? (
            <>
              <Clock
                v2={props.v2}
                startTime={startTime}
                stopTime={stopTime}
                pausedTime={pausedTime}
                replayMode={replayMode}
                isPaused={props.isPaused || !startTime}
                onStart={onStartClock}
                onPause={onPauseClock}
              />
              {!solved && !replayMode && renderCheckMenu()}
              {!solved && !replayMode && renderRevealMenu()}
              {solved && !replayMode && renderReplayLink()}
            </>
          ) : (
            <>
              {renderColorAttributionToggle()}
              {renderListViewButton()}
              {renderAutocheck()}
              {renderChatButton()}
            </>
          )}
          {renderExpandMenuButton()}
        </Box>
      </Box>
    );
  }

  return (
    <div className="toolbar">
      <div className="toolbar--timer">
        <Clock
          v2={props.v2}
          replayMode={replayMode}
          startTime={startTime}
          stopTime={stopTime}
          pausedTime={pausedTime}
          isPaused={props.isPaused || !startTime}
          onStart={onStartClock}
          onPause={onPauseClock}
        />
      </div>
      {!solved && !replayMode && renderCheckMenu()}
      {!solved && !replayMode && renderRevealMenu()}
      {!solved && !replayMode && <div className="toolbar--menu reset">{renderResetMenu()}</div>}
      {solved && !replayMode && renderReplayLink()}
      {renderColorAttributionToggle()}
      {renderListViewButton()}
      {!replayMode && renderPencil()}
      {!solved && !replayMode && renderAutocheck()}
      {!replayMode && renderExtrasMenu()}
      {solved && !replayMode && renderPlayAgainLink()}
      {!replayMode && renderInfo()}
    </div>
  );
};

export default Toolbar;

import './css/index.css';
import React, {useRef, useEffect, useCallback} from 'react';
import {MdBorderAll, MdChatBubble, MdList, MdSlowMotionVideo} from 'react-icons/md';
import {AiOutlineMenuFold, AiOutlineMenuUnfold} from 'react-icons/ai';
import {RiPaintFill, RiPaintLine} from 'react-icons/ri';
import {
  Box,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Menu,
  MenuItem,
  IconButton,
  Tooltip,
} from '@mui/material';
import {Link} from 'react-router-dom';
import Clock from './Clock';
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
  const [revealDialogOpen, setRevealDialogOpen] = React.useState(false);
  const [revealScope, setRevealScope] = React.useState<string>('');
  const [resetDialogOpen, setResetDialogOpen] = React.useState(false);
  const [resetCallback, setResetCallback] = React.useState<(() => void) | null>(null);
  const [checkMenuAnchor, setCheckMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [revealMenuAnchor, setRevealMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [resetMenuAnchor, setResetMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [extrasMenuAnchor, setExtrasMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [playAgainMenuAnchor, setPlayAgainMenuAnchor] = React.useState<null | HTMLElement>(null);

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
      console.log('[Toolbar] check called with scope:', scopeString);
      console.log('[Toolbar] props.onCheck exists:', !!props.onCheck);
      if (props.onCheck) {
        console.log('[Toolbar] Calling props.onCheck with:', scopeString);
        props.onCheck(scopeString);
      } else {
        console.warn('[Toolbar] props.onCheck is not defined');
      }
    },
    [props.onCheck]
  );

  const reveal = useCallback((scopeString: string): void => {
    console.log('[Toolbar] reveal called with scope:', scopeString);
    setRevealScope(scopeString);
    setRevealDialogOpen(true);
  }, []);

  const handleRevealConfirm = useCallback(() => {
    console.log('[Toolbar] handleRevealConfirm called with scope:', revealScope);
    console.log('[Toolbar] props.onReveal exists:', !!props.onReveal);
    if (props.onReveal) {
      console.log('[Toolbar] Calling props.onReveal with:', revealScope);
      props.onReveal(revealScope);
    } else {
      console.warn('[Toolbar] props.onReveal is not defined');
    }
    setRevealDialogOpen(false);
  }, [props.onReveal, revealScope]);

  const handleRevealCancel = useCallback(() => {
    setRevealDialogOpen(false);
  }, []);

  const reset = useCallback(
    (scopeString: string, force: boolean = false): void => {
      console.log('[Toolbar] reset called with scope:', scopeString, 'force:', force);
      console.log('[Toolbar] props.onReset exists:', !!props.onReset);
      if (props.onReset) {
        console.log('[Toolbar] Calling props.onReset with:', scopeString, force);
        props.onReset(scopeString, force);
      } else {
        console.warn('[Toolbar] props.onReset is not defined');
      }
    },
    [props.onReset]
  );

  const confirmResetPuzzle = useCallback((callback: () => void): void => {
    setResetCallback(() => callback);
    setResetDialogOpen(true);
  }, []);

  const handleResetConfirm = useCallback(() => {
    if (resetCallback) {
      resetCallback();
    }
    setResetDialogOpen(false);
    setResetCallback(null);
  }, [resetCallback]);

  const handleResetCancel = useCallback(() => {
    setResetDialogOpen(false);
    setResetCallback(null);
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

  const handleCheckMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setCheckMenuAnchor(event.currentTarget);
  }, []);

  const handleCheckMenuClose = useCallback(() => {
    setCheckMenuAnchor(null);
    handleBlur();
  }, [handleBlur]);

  const handleCheckAction = useCallback(
    (scope: string) => {
      console.log('[Toolbar] handleCheckAction called with scope:', scope);
      check(scope);
    },
    [check]
  );

  const renderCheckMenu = useCallback((): JSX.Element => {
    const checkMenuOpen = Boolean(checkMenuAnchor);

    return (
      <>
        <Tooltip title="Check answers">
          <Button
            variant="outlined"
            size="small"
            onClick={handleCheckMenuOpen}
            onMouseDown={handleMouseDown}
            sx={{minWidth: 'auto', px: 1.5}}
          >
            Check
          </Button>
        </Tooltip>
        <Menu
          anchorEl={checkMenuAnchor}
          open={checkMenuOpen}
          onClose={handleCheckMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
          MenuListProps={{
            onClick: handleCheckMenuClose,
          }}
        >
          <MenuItem onClick={() => handleCheckAction('square')}>Square</MenuItem>
          <MenuItem onClick={() => handleCheckAction('word')}>Word</MenuItem>
          <MenuItem onClick={() => handleCheckAction('puzzle')}>Puzzle</MenuItem>
        </Menu>
      </>
    );
  }, [checkMenuAnchor, handleCheckMenuOpen, handleCheckMenuClose, handleCheckAction, handleMouseDown]);

  const handleRevealMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setRevealMenuAnchor(event.currentTarget);
  }, []);

  const handleRevealMenuClose = useCallback(() => {
    setRevealMenuAnchor(null);
    handleBlur();
  }, [handleBlur]);

  const handleRevealAction = useCallback(
    (scope: string) => {
      reveal(scope);
    },
    [reveal]
  );

  const renderRevealMenu = useCallback((): JSX.Element => {
    const revealMenuOpen = Boolean(revealMenuAnchor);

    return (
      <>
        <Tooltip title="Reveal answers">
          <Button
            variant="outlined"
            size="small"
            onClick={handleRevealMenuOpen}
            onMouseDown={handleMouseDown}
            sx={{minWidth: 'auto', px: 1.5}}
          >
            Reveal
          </Button>
        </Tooltip>
        <Menu
          anchorEl={revealMenuAnchor}
          open={revealMenuOpen}
          onClose={handleRevealMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
          MenuListProps={{
            onClick: handleRevealMenuClose,
          }}
        >
          <MenuItem onClick={() => handleRevealAction('square')}>Square</MenuItem>
          <MenuItem onClick={() => handleRevealAction('word')}>Word</MenuItem>
          <MenuItem onClick={() => handleRevealAction('puzzle')}>Puzzle</MenuItem>
        </Menu>
      </>
    );
  }, [revealMenuAnchor, handleRevealMenuOpen, handleRevealMenuClose, handleRevealAction, handleMouseDown]);

  const handleResetMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setResetMenuAnchor(event.currentTarget);
  }, []);

  const handleResetMenuClose = useCallback(() => {
    setResetMenuAnchor(null);
    handleBlur();
  }, [handleBlur]);

  const handleResetAction = useCallback(
    (action: string) => {
      if (action === 'square') {
        reset('square');
      } else if (action === 'word') {
        reset('word');
      } else if (action === 'puzzle') {
        confirmResetPuzzle(() => reset('puzzle'));
      } else if (action === 'puzzle-and-timer') {
        resetPuzzleAndTimer();
      }
    },
    [reset, confirmResetPuzzle, resetPuzzleAndTimer]
  );

  const renderResetMenu = useCallback((): JSX.Element => {
    const resetMenuOpen = Boolean(resetMenuAnchor);

    return (
      <>
        <Tooltip title="Reset puzzle">
          <Button
            variant="outlined"
            size="small"
            onClick={handleResetMenuOpen}
            onMouseDown={handleMouseDown}
            sx={{minWidth: 'auto', px: 1.5}}
          >
            Reset
          </Button>
        </Tooltip>
        <Menu
          anchorEl={resetMenuAnchor}
          open={resetMenuOpen}
          onClose={handleResetMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
          MenuListProps={{
            onClick: handleResetMenuClose,
          }}
        >
          <MenuItem onClick={() => handleResetAction('square')}>Square</MenuItem>
          <MenuItem onClick={() => handleResetAction('word')}>Word</MenuItem>
          <MenuItem onClick={() => handleResetAction('puzzle')}>Puzzle</MenuItem>
          <MenuItem onClick={() => handleResetAction('puzzle-and-timer')}>Puzzle and Timer</MenuItem>
        </Menu>
      </>
    );
  }, [resetMenuAnchor, handleResetMenuOpen, handleResetMenuClose, handleResetAction, handleMouseDown]);

  const handleExtrasMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setExtrasMenuAnchor(event.currentTarget);
  }, []);

  const handleExtrasMenuClose = useCallback(() => {
    setExtrasMenuAnchor(null);
    handleBlur();
  }, [handleBlur]);

  const renderExtrasMenu = useCallback((): JSX.Element => {
    const {vimMode, onToggleColorAttributionMode, pid} = props;
    const vimModeLabel = vimMode ? 'Disable Vim Mode' : 'Enable Vim Mode';
    const extrasMenuOpen = Boolean(extrasMenuAnchor);

    return (
      <>
        <Tooltip title="Extras">
          <Button
            variant="outlined"
            size="small"
            onClick={handleExtrasMenuOpen}
            onMouseDown={handleMouseDown}
            sx={{minWidth: 'auto', px: 1.5}}
          >
            Extras
          </Button>
        </Tooltip>
        <Menu
          anchorEl={extrasMenuAnchor}
          open={extrasMenuOpen}
          onClose={handleExtrasMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
          MenuListProps={{
            onClick: handleExtrasMenuClose,
          }}
        >
          <MenuItem
            onClick={() => {
              handleVimModeClick();
              handleExtrasMenuClose();
            }}
          >
            {vimModeLabel}
          </MenuItem>
          <MenuItem
            onClick={() => {
              onToggleColorAttributionMode?.();
              handleExtrasMenuClose();
            }}
          >
            Color Attribution
          </MenuItem>
          <MenuItem
            onClick={() => {
              props.onToggleListView?.();
              handleExtrasMenuClose();
            }}
          >
            List View
          </MenuItem>
          <MenuItem
            onClick={() => {
              props.onTogglePencil?.();
              handleExtrasMenuClose();
            }}
          >
            Pencil
          </MenuItem>
          <MenuItem
            onClick={() => {
              props.onToggleAutocheck?.();
              handleExtrasMenuClose();
            }}
          >
            Autocheck
          </MenuItem>
          <MenuItem
            onClick={() => {
              window.open(`/beta/play/${pid}?new=1`, '_blank');
              handleExtrasMenuClose();
            }}
          >
            Create new game link
          </MenuItem>
        </Menu>
      </>
    );
  }, [
    props,
    extrasMenuAnchor,
    handleExtrasMenuOpen,
    handleExtrasMenuClose,
    handleVimModeClick,
    handleMouseDown,
  ]);

  const handlePlayAgainMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setPlayAgainMenuAnchor(event.currentTarget);
  }, []);

  const handlePlayAgainMenuClose = useCallback(() => {
    setPlayAgainMenuAnchor(null);
    handleBlur();
  }, [handleBlur]);

  const renderPlayAgainLink = useCallback((): JSX.Element => {
    const {pid, onResetClock} = props;
    const playAgainMenuOpen = Boolean(playAgainMenuAnchor);

    return (
      <>
        <Tooltip title="Play again options">
          <Button
            variant="outlined"
            size="small"
            onClick={handlePlayAgainMenuOpen}
            onMouseDown={handleMouseDown}
            sx={{minWidth: 'auto', px: 1.5}}
          >
            Play Again
          </Button>
        </Tooltip>
        <Menu
          anchorEl={playAgainMenuAnchor}
          open={playAgainMenuOpen}
          onClose={handlePlayAgainMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
          MenuListProps={{
            onClick: handlePlayAgainMenuClose,
          }}
        >
          <MenuItem
            onClick={() => {
              confirmResetPuzzle(() => {
                reset('puzzle', true);
                if (onResetClock) {
                  onResetClock();
                }
              });
              handlePlayAgainMenuClose();
            }}
          >
            Reset this game
          </MenuItem>
          <MenuItem
            onClick={() => {
              window.open(`/beta/play/${pid}?new=1`, '_blank');
              handlePlayAgainMenuClose();
            }}
          >
            Create new game link
          </MenuItem>
        </Menu>
      </>
    );
  }, [
    props,
    playAgainMenuAnchor,
    handlePlayAgainMenuOpen,
    handlePlayAgainMenuClose,
    confirmResetPuzzle,
    reset,
    handleMouseDown,
  ]);

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
      <Tooltip title={autocheckMode ? 'Disable Autocheck' : 'Enable Autocheck'}>
        <IconButton
          size="small"
          onClick={handleAutocheckClick}
          onMouseDown={handleMouseDown}
          color={autocheckMode ? 'primary' : 'default'}
          sx={{
            border: '1px solid',
            borderColor: autocheckMode ? 'primary.main' : 'divider',
            backgroundColor: autocheckMode ? 'action.selected' : 'transparent',
          }}
        >
          <MdBorderAll />
        </IconButton>
      </Tooltip>
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
      {!solved && !replayMode && renderResetMenu()}
      {solved && !replayMode && renderReplayLink()}
      {renderColorAttributionToggle()}
      {renderListViewButton()}
      {!replayMode && renderPencil()}
      {!solved && !replayMode && renderAutocheck()}
      {!replayMode && renderExtrasMenu()}
      {solved && !replayMode && renderPlayAgainLink()}
      {!replayMode && renderInfo()}
      <Dialog
        open={revealDialogOpen}
        onClose={handleRevealCancel}
        aria-labelledby="reveal-dialog-title"
        aria-describedby="reveal-dialog-description"
      >
        <DialogTitle id="reveal-dialog-title">Confirm Reveal</DialogTitle>
        <DialogContent>
          <DialogContentText id="reveal-dialog-description">
            Are you sure you want to reveal the <strong>{revealScope}</strong>? All players will be able to
            see the {revealScope}'s answer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRevealCancel} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleRevealConfirm} color="warning" variant="contained" autoFocus>
            Reveal
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={resetDialogOpen}
        onClose={handleResetCancel}
        aria-labelledby="reset-dialog-title"
        aria-describedby="reset-dialog-description"
      >
        <DialogTitle id="reset-dialog-title">Confirm Reset</DialogTitle>
        <DialogContent>
          <DialogContentText id="reset-dialog-description">
            Are you sure you want to reset the entire puzzle? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleResetCancel} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleResetConfirm} color="error" variant="contained" autoFocus>
            Reset
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Toolbar;

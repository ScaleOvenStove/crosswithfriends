import React, {useState, useRef, useEffect, useMemo, useCallback} from 'react';
import {Box, Stack} from '@mui/material';
import _ from 'lodash';
import Confetti from './Confetti';

import * as powerups from '@crosswithfriends/shared/lib/powerups';
import Player from '../Player';
import Toolbar from '../Toolbar';
import {toArr} from '@crosswithfriends/shared/lib/jsUtils';
import {toHex, darken, GREENISH} from '@crosswithfriends/shared/lib/colors';

const vimModeKey = 'vim-mode';
const vimModeRegex = /^\d+(a|d)*$/;

interface GameProps {
  historyWrapper?: any;
  opponentHistoryWrapper?: any;
  ownPowerups?: any;
  opponentPowerups?: any;
  gameModel: any;
  id: string;
  myColor: string;
  onChange: (options?: {isEdit?: boolean}) => void;
  battleModel?: any;
  team?: number;
  onToggleChat: () => void;
  onUnfocus: () => void;
  mobile?: boolean;
  beta?: boolean;
  gid?: string;
  pickups?: any;
  unreads?: number;
}

// component for gameplay -- incl. grid/clues & toolbar
const Game: React.FC<GameProps> = (props) => {
  const [listMode, setListMode] = useState<boolean>(false);
  const [pencilMode, setPencilMode] = useState<boolean>(false);
  const [autocheckMode, setAutocheckMode] = useState<boolean>(false);
  const [vimMode, setVimMode] = useState<boolean>(false);
  const [vimInsert, setVimInsert] = useState<boolean>(false);
  const [vimCommand, setVimCommand] = useState<boolean>(false);
  const [colorAttributionMode, setColorAttributionMode] = useState<boolean>(false);
  const [expandMenu, setExpandMenu] = useState<boolean>(false);

  const playerRef = useRef<any>(null);
  const prevMyColorRef = useRef<string | undefined>(props.myColor);

  useEffect(() => {
    let vimModeValue = false;
    try {
      vimModeValue = JSON.parse(localStorage.getItem(vimModeKey) || 'false') || false;
    } catch (e) {
      console.error('Failed to parse local storage vim mode!');
    }
    setVimMode(vimModeValue);
  }, []);

  const handleUpdateColor = useCallback(
    (id: string, color: string) => {
      props.gameModel.updateColor(id, color);
    },
    [props.gameModel]
  );

  useEffect(() => {
    if (prevMyColorRef.current !== props.myColor) {
      handleUpdateColor(props.id, props.myColor);
      prevMyColorRef.current = props.myColor;
    }
  }, [props.myColor, props.id, handleUpdateColor]);

  const rawGame = useMemo(() => {
    return props.historyWrapper && props.historyWrapper.getSnapshot();
  }, [props.historyWrapper]);

  const rawOpponentGame = useMemo(() => {
    return props.opponentHistoryWrapper && props.opponentHistoryWrapper.getSnapshot();
  }, [props.opponentHistoryWrapper]);

  // TODO: this should be cached, sigh...
  const games = useMemo(() => {
    return powerups.apply(rawGame, rawOpponentGame, props.ownPowerups, props.opponentPowerups);
  }, [rawGame, rawOpponentGame, props.ownPowerups, props.opponentPowerups]);

  const game = useMemo(() => {
    return games.ownGame;
  }, [games]);

  const opponentGame = useMemo(() => {
    return games.opponentGame;
  }, [games]);

  const scope = useCallback((s: string) => {
    if (!playerRef.current) return [];
    if (s === 'square') {
      return playerRef.current.getSelectedSquares();
    }
    if (s === 'word') {
      return playerRef.current.getSelectedAndHighlightedSquares();
    }
    if (s === 'puzzle') {
      return playerRef.current.getAllSquares();
    }
    return [];
  }, []);

  const handleUpdateGrid = useCallback(
    (r: number, c: number, value: string) => {
      const {id, myColor} = props;
      props.gameModel.updateCell(r, c, id, myColor, pencilMode, value, autocheckMode);
      props.onChange({isEdit: true});
      if (props.battleModel) {
        props.battleModel.checkPickups(r, c, rawGame, props.team);
      }
    },
    [
      props.id,
      props.myColor,
      props.gameModel,
      props.onChange,
      props.battleModel,
      props.team,
      pencilMode,
      autocheckMode,
      rawGame,
    ]
  );

  const handleUpdateCursor = useCallback(
    ({r, c}: {r: number; c: number}) => {
      const {id} = props;
      if (game.solved && !_.find(game.cursors, (cursor: any) => cursor.id === id)) {
        return;
      }
      props.gameModel.updateCursor(r, c, id);
    },
    [props.id, props.gameModel, game]
  );

  const handleAddPing = useCallback(
    ({r, c}: {r: number; c: number}) => {
      const {id} = props;
      props.gameModel.addPing(r, c, id);
    },
    [props.id, props.gameModel]
  );

  const handleStartClock = useCallback(() => {
    props.gameModel.updateClock('start');
  }, [props.gameModel]);

  const handlePauseClock = useCallback(() => {
    props.gameModel.updateClock('pause');
  }, [props.gameModel]);

  const handleResetClock = useCallback(() => {
    props.gameModel.updateClock('reset');
  }, [props.gameModel]);

  const handleCheck = useCallback(
    (scopeString: string) => {
      const scope = scope(scopeString);
      props.gameModel.check(scope);
    },
    [props.gameModel, scope]
  );

  const handleReveal = useCallback(
    (scopeString: string) => {
      const scopeValue = scope(scopeString);
      props.gameModel.reveal(scopeValue);
      props.onChange();
    },
    [props.gameModel, props.onChange, scope]
  );

  const handleReset = useCallback(
    (scopeString: string, force: boolean = false) => {
      const scopeValue = scope(scopeString);
      props.gameModel.reset(scopeValue, force);
    },
    [props.gameModel, scope]
  );

  const handleKeybind = useCallback((mode: string) => {
    setVimMode(mode === 'vim');
  }, []);

  const handleToggleVimMode = useCallback(() => {
    setVimMode((prev) => {
      const newVimMode = !prev;
      localStorage.setItem(vimModeKey, JSON.stringify(newVimMode));
      return newVimMode;
    });
  }, []);

  const handleVimInsert = useCallback(() => {
    setVimInsert(true);
  }, []);

  const handleVimCommand = useCallback(() => {
    setVimCommand((prev) => !prev);
  }, []);

  const handleVimNormal = useCallback(() => {
    setVimInsert(false);
    setVimCommand(false);
  }, []);

  const handleTogglePencil = useCallback(() => {
    setPencilMode((prev) => !prev);
  }, []);

  const handleToggleAutocheck = useCallback(() => {
    setAutocheckMode((prev) => !prev);
  }, []);

  const handleToggleListView = useCallback(() => {
    setListMode((prev) => !prev);
  }, []);

  const handleToggleChat = useCallback(() => {
    props.onToggleChat();
  }, [props.onToggleChat]);

  const handleToggleExpandMenu = useCallback(() => {
    setExpandMenu((prev) => !prev);
  }, []);

  const focus = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.focus();
    }
  }, []);

  const handleRefocus = useCallback(() => {
    focus();
  }, [focus]);

  const handlePressPeriod = handleTogglePencil;

  const handleVimCommandPressEnter = useCallback(
    (command: string) => {
      if (vimModeRegex.test(command)) {
        let dir = 'across';
        const int = parseInt(command, 10);
        if (command.endsWith('d')) {
          dir = 'down';
        }
        if (playerRef.current) {
          playerRef.current.selectClue(dir, int);
        }
      }
      handleRefocus();
    },
    [handleRefocus]
  );

  const handlePressEnter = useCallback(() => {
    props.onUnfocus();
  }, [props.onUnfocus]);

  const handleSelectClue = useCallback((direction: string, number: number) => {
    if (playerRef.current) {
      playerRef.current.selectClue(direction, number);
    }
  }, []);

  // Memoize clues transformation to avoid side effects in render
  const clues = useMemo(() => {
    if (!game) return {across: [], down: []};
    const result = {
      ...game.clues,
    };
    // Only access window.location in useMemo, not during render
    if (
      typeof window !== 'undefined' &&
      (window.location.host === 'foracross.com' || window.location.host.includes('.foracross.com'))
    ) {
      const dirToHide = window.location.host.includes('down') ? 'across' : 'down';
      result[dirToHide] = _.assign([], result[dirToHide]).map((val) => val && '-');
    }
    return result;
  }, [game]);

  // Memoize screenWidth to avoid side effects in render
  const screenWidth = useMemo(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth - 1; // this is important for mobile to fit on screen
    }
    return 0;
  }, []);

  const renderPlayer = useCallback(() => {
    const {id, myColor, mobile, beta} = props;
    if (!game) {
      return <div>Loading...</div>;
    }

    const {grid, circles, shades, cursors, pings, users, solved, solution, themeColor, optimisticCounter} =
      game;
    const opponentGrid = opponentGame && opponentGame.grid;
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
    const width = Math.min((35 * 15 * cols) / rows, screenWidth - 20);
    const minSize = props.mobile ? 1 : 20;
    const size = Math.max(minSize, width / cols);
    return (
      <Player
        ref={playerRef}
        beta={beta}
        size={size}
        grid={grid}
        solution={solution}
        opponentGrid={opponentGrid}
        circles={circles}
        shades={shades}
        clues={{
          across: toArr(clues?.across || []),
          down: toArr(clues?.down || []),
        }}
        id={id}
        cursors={cursors}
        pings={pings}
        users={users}
        frozen={solved}
        myColor={myColor}
        updateGrid={handleUpdateGrid}
        updateCursor={handleUpdateCursor}
        addPing={handleAddPing}
        onPressEnter={handlePressEnter}
        onPressPeriod={handlePressPeriod}
        listMode={listMode}
        vimMode={vimMode}
        vimInsert={vimInsert}
        vimCommand={vimCommand}
        onVimInsert={handleVimInsert}
        onVimNormal={handleVimNormal}
        onVimCommand={handleVimCommand}
        onVimCommandPressEnter={handleVimCommandPressEnter}
        onVimCommandPressEscape={handleRefocus}
        colorAttributionMode={colorAttributionMode}
        mobile={mobile}
        pickups={props.pickups}
        optimisticCounter={optimisticCounter}
        onCheck={handleCheck}
        onReveal={handleReveal}
        {...themeStyles}
      />
    );
  }, [
    props.id,
    props.myColor,
    props.mobile,
    props.beta,
    props.pickups,
    game,
    opponentGame,
    clues,
    screenWidth,
    listMode,
    pencilMode,
    vimMode,
    vimInsert,
    vimCommand,
    colorAttributionMode,
    handleUpdateGrid,
    handleUpdateCursor,
    handleAddPing,
    handlePressEnter,
    handlePressPeriod,
    handleVimInsert,
    handleVimNormal,
    handleVimCommand,
    handleVimCommandPressEnter,
    handleRefocus,
    handleCheck,
    handleReveal,
  ]);

  const renderToolbar = useCallback(() => {
    if (!game) return null;
    const {clock, solved} = game;
    const {mobile, gid, unreads} = props;
    const {lastUpdated: startTime, totalTime: pausedTime, paused: isPaused} = clock;
    return (
      <Toolbar
        v2
        gid={gid}
        pid={game.pid}
        mobile={mobile}
        startTime={startTime}
        pausedTime={pausedTime}
        isPaused={isPaused}
        listMode={listMode}
        expandMenu={expandMenu}
        pencilMode={pencilMode}
        autocheckMode={autocheckMode}
        vimMode={vimMode}
        solved={solved}
        vimInsert={vimInsert}
        vimCommand={vimCommand}
        onStartClock={handleStartClock}
        onPauseClock={handlePauseClock}
        onResetClock={handleResetClock}
        onCheck={handleCheck}
        onReveal={handleReveal}
        onReset={handleReset}
        onKeybind={handleKeybind}
        onTogglePencil={handleTogglePencil}
        onToggleVimMode={handleToggleVimMode}
        onToggleAutocheck={handleToggleAutocheck}
        onToggleListView={handleToggleListView}
        onToggleChat={handleToggleChat}
        onToggleExpandMenu={handleToggleExpandMenu}
        colorAttributionMode={colorAttributionMode}
        onToggleColorAttributionMode={() => {
          setColorAttributionMode((prev) => !prev);
        }}
        onRefocus={handleRefocus}
        unreads={unreads}
      />
    );
  }, [
    game,
    mobile,
    gid,
    unreads,
    listMode,
    expandMenu,
    pencilMode,
    autocheckMode,
    vimMode,
    vimInsert,
    vimCommand,
    colorAttributionMode,
    handleStartClock,
    handlePauseClock,
    handleResetClock,
    handleCheck,
    handleReveal,
    handleReset,
    handleKeybind,
    handleTogglePencil,
    handleToggleVimMode,
    handleToggleAutocheck,
    handleToggleListView,
    handleToggleChat,
    handleToggleExpandMenu,
    handleRefocus,
  ]);

  const padding = props.mobile ? 0 : 20;
  return (
    <Stack direction="column" sx={{flex: 1}}>
      {renderToolbar()}
      <Box
        sx={{
          flex: 1,
          padding,
        }}
      >
        {renderPlayer()}
      </Box>
      {game && game.solved && <Confetti />}
    </Stack>
  );
};

export default Game;

import './css/composition.css';

import React, {useState, useRef, useEffect, useMemo, useCallback} from 'react';
import _ from 'lodash';
import {Helmet} from 'react-helmet';
import {Box, Stack} from '@mui/material';
import Nav from '../components/common/Nav';
import {useParams} from 'react-router-dom';

import actions from '../actions';
import Editor from '../components/Player/Editor';
import FileUploader from '../components/Upload/FileUploader';
import ComposeHistoryWrapper from '@crosswithfriends/shared/lib/wrappers/ComposeHistoryWrapper';
import EditableSpan from '../components/common/EditableSpan';
import redirect from '@crosswithfriends/shared/lib/redirect';
import {downloadBlob, isMobile} from '@crosswithfriends/shared/lib/jsUtils';
import {
  makeGridFromComposition,
  makeClues,
  convertCluesForComposition,
  convertGridForComposition,
} from '@crosswithfriends/shared/lib/gameUtils';
import format from '@crosswithfriends/shared/lib/format';
import * as xwordFiller from '../components/Compose/lib/xword-filler';
import {useUser} from '../hooks/useUser';
import {useComposition} from '../hooks/useComposition';

const Composition: React.FC = () => {
  const params = useParams<{cid: string}>();
  const [mobile] = useState<boolean>(isMobile());
  const [, forceUpdate] = useState({});

  const historyWrapperRef = useRef<ComposeHistoryWrapper | null>(null);
  const user = useUser();
  const editorRef = useRef<any>(null);
  const chatRef = useRef<any>(null);

  const cid = useMemo(() => {
    return Number(params.cid);
  }, [params.cid]);

  const path = useMemo(() => `/composition/${cid}`, [cid]);

  const compositionHook = useComposition({
    path,
    onCreateEvent: (event) => {
      if (historyWrapperRef.current) {
        historyWrapperRef.current.setCreateEvent(event);
        handleUpdate.current?.();
      }
    },
    onEvent: (event) => {
      if (historyWrapperRef.current) {
        historyWrapperRef.current.addEvent(event);
        handleUpdate.current?.();
      }
    },
  });

  const composition = useMemo(() => {
    if (!historyWrapperRef.current) return null;
    return historyWrapperRef.current.getSnapshot();
  }, [forceUpdate]);

  const handleUpdate = useRef<_.DebouncedFunc<() => void>>();
  if (!handleUpdate.current) {
    handleUpdate.current = _.debounce(
      () => {
        forceUpdate({});
      },
      0,
      {
        leading: true,
      }
    );
  }

  const handleChangeRef =
    useRef<_.DebouncedFunc<(options?: {isEdit?: boolean; isPublished?: boolean}) => void>>();
  if (!handleChangeRef.current) {
    handleChangeRef.current = _.debounce(
      ({isEdit = true, isPublished = false}: {isEdit?: boolean; isPublished?: boolean} = {}) => {
        if (!historyWrapperRef.current || !user.id) return;
        const comp = historyWrapperRef.current.getSnapshot();
        if (isEdit) {
          const {title, author} = comp.info;
          user.joinComposition(cid.toString(), {
            title,
            author,
            published: isPublished,
          });
        }
      }
    );
  }

  const handleUpdateGrid = useCallback(
    (r: number, c: number, value: string): void => {
      compositionHook.updateCellText(r, c, value);
    },
    [compositionHook]
  );

  const handleFlipColor = useCallback(
    (r: number, c: number): void => {
      if (!composition) return;
      const color = composition.grid[r][c].value === '.' ? 'white' : 'black';
      compositionHook.updateCellColor(r, c, color);
    },
    [composition, compositionHook]
  );

  const handleUpdateClue = useCallback(
    (r: number, c: number, dir: string, value: string): void => {
      compositionHook.updateClue(r, c, dir, value);
    },
    [compositionHook]
  );

  const handleUploadSuccess = useCallback(
    (puzzle: any, filename: string = ''): void => {
      const {info, grid, circles, clues} = puzzle;
      const convertedGrid = convertGridForComposition(grid);
      const gridObject = makeGridFromComposition(convertedGrid);
      const convertedClues = convertCluesForComposition(clues, gridObject);
      compositionHook.import(filename, {
        info,
        grid: convertedGrid,
        circles,
        clues: convertedClues,
      });
      handleChangeRef.current?.();
    },
    [compositionHook]
  );

  const handleUploadFail = useCallback((): void => {}, []);

  const handleChat = useCallback(
    (username: string, id: string, message: string): void => {
      compositionHook.chat(username, id, message);
      handleChangeRef.current?.();
    },
    [compositionHook]
  );

  const handleUpdateTitle = useCallback(
    (title: string): void => {
      compositionHook.updateTitle(title);
      handleChangeRef.current?.();
    },
    [compositionHook]
  );

  const handleUpdateAuthor = useCallback(
    (author: string): void => {
      compositionHook.updateAuthor(author);
      handleChangeRef.current?.();
    },
    [compositionHook]
  );

  const handleUnfocusHeader = useCallback((): void => {
    if (chatRef.current) {
      chatRef.current.focus();
    }
  }, []);

  const handleUnfocusEditor = useCallback((): void => {
    if (chatRef.current) {
      chatRef.current.focus();
    }
  }, []);

  const handleUnfocusChat = useCallback((): void => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, []);

  const handleExportClick = useCallback((): void => {
    if (!composition) return;
    const byteArray = format().fromComposition(composition).toPuz();
    downloadBlob(byteArray, 'download.puz');
  }, [composition]);

  const handleUpdateCursor = useCallback(
    (selected: {r: number; c: number}): void => {
      if (!user.id) return;
      const {r, c} = selected;
      compositionHook.updateCursor(r, c, user.id, user.color);
    },
    [user, compositionHook]
  );

  const handleAutofill = useCallback((): void => {
    if (!composition) return;
    console.log('c.grid', composition.grid);
    const grid = xwordFiller.fillGrid(composition.grid);
    console.log('grid', grid);
    compositionHook.setGrid(grid);
  }, [composition, compositionHook]);

  const handleChangeSize = useCallback(
    (newRows: number, newCols: number): void => {
      if (!composition) return;
      const oldGrid = composition.grid;
      const oldRows = oldGrid.length;
      const oldCols = oldGrid[0].length;
      const newGrid = _.range(newRows).map((i) =>
        _.range(newCols).map((j) => (i < oldRows && j < oldCols ? oldGrid[i][j] : {value: ''}))
      );
      compositionHook.setGrid(newGrid);
    },
    [composition, compositionHook]
  );

  const handleChangeRows = useCallback(
    (newRows: number): void => {
      if (!composition || newRows <= 0) return;
      handleChangeSize(newRows, composition.grid[0].length);
    },
    [composition, handleChangeSize]
  );

  const handleChangeColumns = useCallback(
    (newCols: number): void => {
      if (!composition || newCols <= 0) return;
      handleChangeSize(composition.grid.length, newCols);
    },
    [composition, handleChangeSize]
  );

  const handlePublish = useCallback((): void => {
    if (!composition) return;
    let {grid, clues, info} = composition;

    clues = makeClues(clues, makeGridFromComposition(grid).grid);
    grid = grid.map((row) => row.map(({value}: {value: string}) => value || '.'));

    const puzzle = {grid, clues, info};

    actions.createPuzzle(puzzle, (pid: number) => {
      console.log('Puzzle path: ', `/beta/play/${pid}`);
      redirect(`/beta/play/${pid}`);
    });
  }, [composition]);

  const handleClearPencil = useCallback((): void => {
    compositionHook.clearPencil();
  }, [compositionHook]);

  const getCellSize = useCallback((): number => {
    if (!composition || !composition.grid[0]) return 30;
    return (30 * 15) / composition.grid[0].length;
  }, [composition]);


  const title = useMemo((): string | undefined => {
    if (!compositionHook.ready || !composition) {
      return undefined;
    }
    const info = composition.info;
    return `Compose: ${info.title}`;
  }, [composition, compositionHook.ready]);

  const otherCursors = useMemo(() => {
    if (!composition || !user.id) return [];
    return _.filter(composition.cursors, ({id}: {id: string}) => id !== user.id);
  }, [composition, user.id]);

  if (!compositionHook.ready || !composition) {
    return (
      <Stack
        className="composition"
        direction="column"
        sx={{
          flex: 1,
          width: '100%',
          height: '100%',
        }}
      >
        <Helmet>
          <title>Compose</title>
        </Helmet>
        <Nav v2 hidden={mobile} />
      </Stack>
    );
  }

  const gridObject = makeGridFromComposition(composition.grid);
  const grid = gridObject.grid;
  const clues = makeClues(composition.clues, grid);
  const {title: compTitle, author} = composition.info;

  const style = {
    padding: 20,
  };

  return (
    <Stack
      className="composition"
      direction="column"
      sx={{
        flex: 1,
        width: '100%',
        height: '100%',
      }}
    >
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <Nav v2 hidden={mobile} />
      <Box sx={{...style, flex: 1, display: 'flex'}}>
        <Stack direction="column" sx={{flexShrink: 0}}>
          <div className="chat--header">
            <EditableSpan
              className="chat--header--title"
              key_="title"
              onChange={handleUpdateTitle}
              onBlur={handleUnfocusHeader}
              value={compTitle}
            />

            <EditableSpan
              className="chat--header--subtitle"
              key_="author"
              onChange={handleUpdateAuthor}
              onBlur={handleUnfocusHeader}
              value={author}
            />
          </div>
          <Editor
            ref={editorRef}
            size={getCellSize()}
            grid={grid}
            clues={clues}
            cursors={otherCursors}
            onUpdateGrid={handleUpdateGrid}
            onAutofill={handleAutofill}
            onClearPencil={handleClearPencil}
            onUpdateClue={handleUpdateClue}
            onUpdateCursor={handleUpdateCursor}
            onChange={handleChangeRef.current || (() => {})}
            onFlipColor={handleFlipColor}
            onPublish={handlePublish}
            onChangeRows={handleChangeRows}
            onChangeColumns={handleChangeColumns}
            myColor={user.color || '#000000'}
            onUnfocus={handleUnfocusEditor}
          />
        </Stack>
        <Stack direction="column">
          <FileUploader success={handleUploadSuccess} fail={handleUploadFail} v2 />
          <button onClick={handleExportClick}>Export to puz</button>
        </Stack>
      </Box>
    </Stack>
  );
};

export default Composition;

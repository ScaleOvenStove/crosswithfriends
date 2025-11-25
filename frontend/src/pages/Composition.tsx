import './css/composition.css';

import format from '@crosswithfriends/shared/lib/format';
import {
  makeGridFromComposition,
  makeClues,
  convertCluesForComposition,
  convertGridForComposition,
} from '@crosswithfriends/shared/lib/gameUtils';
import {downloadBlob, isMobile} from '@crosswithfriends/shared/lib/jsUtils';
import redirect from '@crosswithfriends/shared/lib/redirect';
import ComposeHistoryWrapper from '@crosswithfriends/shared/lib/wrappers/ComposeHistoryWrapper';
import {Box, Stack} from '@mui/material';
import React, {useState, useRef, useEffect, useMemo, useCallback} from 'react';
import {Helmet} from 'react-helmet';
import {useParams} from 'react-router-dom';

type DebouncedFunc<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): void;
  cancel: () => void;
};

const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 0,
  options?: {leading?: boolean}
): DebouncedFunc<T> => {
  let timeout: NodeJS.Timeout;
  let hasInvoked = false;
  const debounced = (...args: Parameters<T>) => {
    clearTimeout(timeout);
    if (options?.leading && !hasInvoked) {
      fn(...args);
      hasInvoked = true;
    }
    timeout = setTimeout(() => {
      if (!options?.leading || hasInvoked) {
        fn(...args);
      }
      hasInvoked = false;
    }, delay);
  };
  debounced.cancel = () => {
    clearTimeout(timeout);
    hasInvoked = false;
  };
  return debounced;
};

import actions from '../actions';
import EditableSpan from '../components/common/EditableSpan';
import Nav from '../components/common/Nav';
import * as xwordFiller from '../components/Compose/lib/xword-filler';
import Editor from '../components/Player/Editor';
import FileUploader from '../components/Upload/FileUploader';
import {useComposition} from '../hooks/useComposition';
import {useUser} from '../hooks/useUser';

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

  const [composition, setComposition] = useState<ReturnType<ComposeHistoryWrapper['getSnapshot']> | null>(
    null
  );

  const handleUpdate = useRef<DebouncedFunc<() => void>>();
  useEffect(() => {
    if (!handleUpdate.current) {
      handleUpdate.current = debounce(
        () => {
          forceUpdate({});
        },
        0,
        {
          leading: true,
        }
      );
    }
  }, []);

  const handleChangeRef =
    useRef<DebouncedFunc<(options?: {isEdit?: boolean; isPublished?: boolean}) => void>>();
  useEffect(() => {
    if (!handleChangeRef.current) {
      handleChangeRef.current = debounce(
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
  }, [cid, user]);

  useEffect(() => {
    if (historyWrapperRef.current) {
      setComposition(historyWrapperRef.current.getSnapshot());
    }
  }, [forceUpdate]);

  // Initialize composition when historyWrapper is ready
  useEffect(() => {
    if (historyWrapperRef.current && !composition) {
      setComposition(historyWrapperRef.current.getSnapshot());
    }
  }, [composition]);

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
    (
      puzzle: {info: unknown; grid: unknown; circles: unknown; clues: unknown},
      filename: string = ''
    ): void => {
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

  const _handleChat = useCallback(
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

  const _handleUnfocusChat = useCallback((): void => {
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
    const grid = xwordFiller.fillGrid(composition.grid);
    compositionHook.setGrid(grid);
  }, [composition, compositionHook]);

  const handleChangeSize = useCallback(
    (newRows: number, newCols: number): void => {
      if (!composition) return;
      const oldGrid = composition.grid;
      const oldRows = oldGrid.length;
      const oldCols = oldGrid[0].length;
      const newGrid = Array.from({length: newRows}, (_, i) =>
        Array.from({length: newCols}, (_, j) => (i < oldRows && j < oldCols ? oldGrid[i][j] : {value: ''}))
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
    return composition.cursors.filter(({id}: {id: string}) => id !== user.id);
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
      <Box sx={{...style, flex: 1, display: 'flex', minHeight: 0}}>
        <Stack direction="column" sx={{flex: 1, display: 'flex', minHeight: 0}}>
          <div className="chat--header">
            <EditableSpan
              className="chat--header--title"
              keyProp="title"
              onChange={handleUpdateTitle}
              onBlur={handleUnfocusHeader}
              value={compTitle}
            />

            <EditableSpan
              className="chat--header--subtitle"
              keyProp="author"
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
            onChange={(options) => handleChangeRef.current?.(options)}
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

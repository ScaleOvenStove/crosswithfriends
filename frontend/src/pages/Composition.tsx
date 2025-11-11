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
import {useCompositionStore, getUser} from '../store';
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
import User from '../store/user';

const Composition: React.FC = () => {
  const params = useParams<{cid: string}>();
  const [mobile] = useState<boolean>(isMobile());
  const [, forceUpdate] = useState({});

  const compositionStore = useCompositionStore();
  const historyWrapperRef = useRef<ComposeHistoryWrapper | null>(null);
  const userRef = useRef<User | null>(null);
  const editorRef = useRef<any>(null);
  const chatRef = useRef<any>(null);

  const cid = useMemo(() => {
    return Number(params.cid);
  }, [params.cid]);

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
        if (!historyWrapperRef.current || !userRef.current) return;
        const comp = historyWrapperRef.current.getSnapshot();
        if (isEdit) {
          const {title, author} = comp.info;
          userRef.current.joinComposition(cid, {
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
      const path = `/composition/${cid}`;
      compositionStore.updateCellText(path, r, c, value);
    },
    [cid, compositionStore]
  );

  const handleFlipColor = useCallback(
    (r: number, c: number): void => {
      if (!composition) return;
      const path = `/composition/${cid}`;
      const color = composition.grid[r][c].value === '.' ? 'white' : 'black';
      compositionStore.updateCellColor(path, r, c, color);
    },
    [composition, cid, compositionStore]
  );

  const handleUpdateClue = useCallback(
    (r: number, c: number, dir: string, value: string): void => {
      const path = `/composition/${cid}`;
      compositionStore.updateClue(path, r, c, dir, value);
    },
    [cid, compositionStore]
  );

  const handleUploadSuccess = useCallback(
    (puzzle: any, filename: string = ''): void => {
      const path = `/composition/${cid}`;
      const {info, grid, circles, clues} = puzzle;
      const convertedGrid = convertGridForComposition(grid);
      const gridObject = makeGridFromComposition(convertedGrid);
      const convertedClues = convertCluesForComposition(clues, gridObject);
      compositionStore.import(path, filename, {
        info,
        grid: convertedGrid,
        circles,
        clues: convertedClues,
      });
      handleChangeRef.current?.();
    },
    [cid, compositionStore]
  );

  const handleUploadFail = useCallback((): void => {}, []);

  const handleChat = useCallback(
    (username: string, id: string, message: string): void => {
      const path = `/composition/${cid}`;
      compositionStore.chat(path, username, id, message);
      handleChangeRef.current?.();
    },
    [cid, compositionStore]
  );

  const handleUpdateTitle = useCallback(
    (title: string): void => {
      const path = `/composition/${cid}`;
      compositionStore.updateTitle(path, title);
      handleChangeRef.current?.();
    },
    [cid, compositionStore]
  );

  const handleUpdateAuthor = useCallback(
    (author: string): void => {
      const path = `/composition/${cid}`;
      compositionStore.updateAuthor(path, author);
      handleChangeRef.current?.();
    },
    [cid, compositionStore]
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
      if (!userRef.current) return;
      const path = `/composition/${cid}`;
      const {r, c} = selected;
      const {id, color} = userRef.current;
      compositionStore.updateCursor(path, r, c, id, color);
    },
    [cid, compositionStore]
  );

  const handleAutofill = useCallback((): void => {
    if (!composition) return;
    const path = `/composition/${cid}`;
    console.log('c.grid', composition.grid);
    const grid = xwordFiller.fillGrid(composition.grid);
    console.log('grid', grid);
    compositionStore.setGrid(path, grid);
  }, [composition, cid, compositionStore]);

  const handleChangeSize = useCallback(
    (newRows: number, newCols: number): void => {
      if (!composition) return;
      const path = `/composition/${cid}`;
      const oldGrid = composition.grid;
      const oldRows = oldGrid.length;
      const oldCols = oldGrid[0].length;
      const newGrid = _.range(newRows).map((i) =>
        _.range(newCols).map((j) => (i < oldRows && j < oldCols ? oldGrid[i][j] : {value: ''}))
      );
      compositionStore.setGrid(path, newGrid);
    },
    [composition, cid, compositionStore]
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
    const path = `/composition/${cid}`;
    compositionStore.clearPencil(path);
  }, [cid, compositionStore]);

  const getCellSize = useCallback((): number => {
    if (!composition || !composition.grid[0]) return 30;
    return (30 * 15) / composition.grid[0].length;
  }, [composition]);

  useEffect(() => {
    const user = getUser();
    userRef.current = user;
    user.onAuth(() => {
      forceUpdate({});
    });

    const path = `/composition/${cid}`;
    const historyWrapper = new ComposeHistoryWrapper();
    historyWrapperRef.current = historyWrapper;

    const unsubscribeCreate = compositionStore.subscribe(path, 'createEvent', (event: any) => {
      if (historyWrapperRef.current) {
        historyWrapperRef.current.setCreateEvent(event);
        handleUpdate.current?.();
      }
    });
    const unsubscribeEvent = compositionStore.subscribe(path, 'event', (event: any) => {
      if (historyWrapperRef.current) {
        historyWrapperRef.current.addEvent(event);
        handleUpdate.current?.();
      }
    });
    compositionStore.attach(path);

    return () => {
      unsubscribeCreate();
      unsubscribeEvent();
      compositionStore.detach(path);
      if (userRef.current) {
        userRef.current.offAuth(() => {
          forceUpdate({});
        });
      }
    };
  }, [cid, compositionStore]);

  const title = useMemo((): string | undefined => {
    const path = `/composition/${cid}`;
    const compositionInstance = compositionStore.getComposition(path);
    if (!compositionInstance || !compositionInstance.attached || !composition) {
      return undefined;
    }
    const info = composition.info;
    return `Compose: ${info.title}`;
  }, [composition, forceUpdate, cid, compositionStore]);

  const otherCursors = useMemo(() => {
    if (!composition || !userRef.current) return [];
    return _.filter(composition.cursors, ({id}: {id: string}) => id !== userRef.current!.id);
  }, [composition]);

  const path = `/composition/${cid}`;
  const compositionInstance = compositionStore.getComposition(path);
  if (!compositionInstance || !compositionInstance.attached || !composition) {
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
            myColor={userRef.current?.color || '#000000'}
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

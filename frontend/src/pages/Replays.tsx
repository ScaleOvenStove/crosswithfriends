import './css/replays.css';

import {Helmet} from 'react-helmet';
import _ from 'lodash';
import React, {useState, useRef, useEffect, useMemo, useCallback} from 'react';
import {Box, Stack} from '@mui/material';
import {useParams} from 'react-router-dom';

import Timestamp from '../components/common/Timestamp';
import HistoryWrapper from '@crosswithfriends/shared/lib/wrappers/HistoryWrapper';
import Nav from '../components/common/Nav';
import {usePuzzle} from '../hooks/usePuzzle';
import {db} from '../store/firebase';
import {ref, get} from 'firebase/database';

interface TimeFormatterProps {
  millis?: number;
}

const TimeFormatter: React.FC<TimeFormatterProps> = ({millis}) =>
  millis ? (
    <span>
      {Math.floor(millis / 60000)}m{Math.floor(millis / 1000) % 60}s
    </span>
  ) : null;

interface GameWithTime {
  stopTime?: number;
  startTime?: number;
  pauseTime?: number;
}

function getTime(game: GameWithTime): number | undefined {
  if (game.stopTime && game.startTime) {
    let t = game.stopTime - game.startTime;
    if (game.pauseTime) t += game.pauseTime;
    return t;
  }
  return undefined;
}

interface GameWithChat {
  chat?: {
    messages?: Record<string, {sender?: string}>;
  };
  events?: Record<string, {type?: string; params?: {sender?: string}}>;
}

function getChatters(game: GameWithChat | null | undefined): string[] {
  if (!game) return [];
  if (game.chat) {
    const {messages} = game.chat;
    if (!messages) return [];
    const chatters: string[] = [];
    _.values(messages).forEach((msg) => {
      if (msg.sender) {
        chatters.push(msg.sender);
      }
    });
    return Array.from(new Set(chatters));
  }
  if (game.events) {
    const chatters: string[] = [];
    _.values(game.events).forEach((event) => {
      if (event.type === 'chat' && event.params?.sender) {
        chatters.push(event.params.sender);
      }
    });
    return Array.from(new Set(chatters));
  }
  return [];
}

interface GameInfo {
  gid: string;
  pid: number;
  title?: string;
  v2: boolean;
  startTime: number;
  solved?: boolean;
  time?: number;
  chatters: string[];
  active: boolean;
}

interface SoloPlayer {
  id: string;
  solved: boolean;
  time: number;
}

const Replays: React.FC = () => {
  const params = useParams<{pid?: string}>();
  const [games, setGames] = useState<Record<string, GameInfo>>({});
  const [soloPlayers, setSoloPlayers] = useState<SoloPlayer[]>([]);
  const [puzInfo, setPuzInfo] = useState<GameInfo | null>(null);
  const [limit, setLimit] = useState<number>(20);
  const [error, setError] = useState<Error | null>(null);

  const pid = useMemo(() => {
    if (!params.pid) {
      return null;
    }
    return Number(params.pid);
  }, [params.pid]);

  const puzzlePath = useMemo(() => {
    return pid ? `/puzzle/${pid}` : '';
  }, [pid]);

  const puzzle = usePuzzle({
    path: puzzlePath,
    pid: pid || 0,
    onReady: (data) => {
      if (data?.info) {
        setPuzInfo(data.info);
      }
    },
  });

  interface RawGameData {
    events?: Record<string, unknown>;
    pid?: number;
    solved?: boolean;
    startTime?: number;
    chat?: {
      messages?: Record<string, {sender?: string}>;
    };
    [key: string]: unknown;
  }

  const processGame = useCallback((rawGame: RawGameData, gid: string): GameInfo => {
    if (rawGame.events) {
      const events = _.values(rawGame.events);
      const historyWrapper = new HistoryWrapper(events);
      const game = historyWrapper.getSnapshot();
      const startTime = historyWrapper.createEvent.timestamp / 1000;
      return {
        gid,
        pid: game.pid,
        title: game.info.title,
        v2: true,
        startTime,
        solved: game.solved,
        time: game.clock.totalTime,
        chatters: getChatters(rawGame),
        active: !game.clock.paused,
      };
    }
    return {
      gid,
      pid: rawGame.pid,
      v2: false,
      solved: rawGame.solved,
      startTime: rawGame.startTime / 1000,
      time: getTime(rawGame),
      chatters: getChatters(rawGame),
      active: true,
    };
  }, []);

  const updatePuzzles = useCallback(() => {
    if (pid && puzzlePath) {
      puzzle.attach();
      puzzle.waitForReady().then(() => {
        if (puzzle.data?.info) {
          setPuzInfo(puzzle.data.info);
        }
        puzzle.listGames(limit).then((rawGames) => {
          if (!rawGames) return;
          const processedGames = _.map(_.keys(rawGames), (gid) => processGame(rawGames[gid], gid));
          setGames(_.keyBy(processedGames, 'gid'));
        });
      });
    } else {
      get(ref(db, '/counters/gid')).then((snapshot) => {
        const gid = Number(snapshot.val());
        Promise.all(
          _.range(gid - 1, gid - limit - 1, -1).map((g: number) =>
            get(ref(db, `/game/${g.toString()}`)).then((snapshot) => ({...snapshot.val(), gid: g}))
          )
        ).then((rawGames: Array<RawGameData & {gid: string}>) => {
          const processedGames = _.map(rawGames, (g) => processGame(g, g.gid));
          setGames(_.keyBy(processedGames, 'gid'));
        });
      });
    }
  }, [pid, limit, processGame, puzzle, puzzlePath]);

  useEffect(() => {
    updatePuzzles();
    return () => {
      if (puzzlePath) {
        puzzle.detach();
      }
    };
  }, [updatePuzzles, puzzle, puzzlePath]);

  const linkToGame = useCallback(
    (gid: string, {v2, active, solved}: {v2: boolean; active: boolean; solved?: boolean}): JSX.Element => {
      return (
        <a href={`${v2 ? '/beta' : ''}/game/${gid}`}>
          {solved ? 'done' : active ? 'still playing' : 'paused'}
        </a>
      );
    },
    []
  );

  const puzzleTitle = useMemo(() => {
    if (!puzzle.data?.info?.title) return '';
    return puzzle.data.info.title;
  }, [puzzle.data]);

  const list1Items = useMemo(() => {
    return _.values(games).map(
      ({pid: gamePid, gid, solved, startTime, time, chatters, v2, active, title}) => (
        <tr key={gid}>
          {pid ? null : (
            <td style={{textAlign: 'left'}}>
              <a href={`/replays/${gamePid}`}>{gamePid}</a>
            </td>
          )}
          {pid ? null : <td>{title}</td>}
          <td>
            <a href={`/replay/${gid}`}>
              Game #{gid}
              {v2 ? '(beta)' : ''}
            </a>
          </td>
          <td>
            <Timestamp time={startTime} />
          </td>
          <td>
            <TimeFormatter millis={time} />
          </td>
          <td>{linkToGame(gid, {v2, active, solved})}</td>
          <td style={{overflow: 'auto', maxWidth: 300}}>{chatters.join(', ')}</td>
        </tr>
      )
    );
  }, [games, pid, linkToGame]);

  const list2Items = useMemo(() => {
    return soloPlayers.map(({id, solved, time}) => (
      <tr key={id}>
        <td>
          <a href={`/replay/solo/${id}/${pid}`}>Play by player #{id}</a>
        </td>
        <td>Not implemented</td>
        <td>
          <TimeFormatter millis={time} />
        </td>
        <td>{solved ? 'done' : 'not done'}</td>
        <td>
          Solo by user
          {id}
        </td>
      </tr>
    ));
  }, [soloPlayers, pid]);

  return (
    <Stack direction="column" className="replays">
      <Nav v2 />
      <Helmet>
        <title>{pid ? `Replays ${pid}: ${puzzleTitle}` : `Last ${limit} games`}</title>
      </Helmet>
      <div
        style={{
          paddingLeft: 30,
          paddingTop: 20,
          paddingBottom: 20,
        }}
      >
        {puzInfo && !error && (
          <div className="header">
            <div className="header--title">{puzInfo.title}</div>
            <div className="header--subtitle">Replays / currently playing games</div>
          </div>
        )}
        <div
          style={{
            padding: 20,
          }}
        >
          {error ? (
            <div>Error loading replay</div>
          ) : (
            <table className="main-table">
              <tbody>
                <tr>
                  {pid ? null : <th>Pid</th>}
                  {pid ? null : <th>Title</th>}
                  <th>Game</th>
                  <th>Start time</th>
                  <th>Duration</th>
                  <th>Progress</th>
                  <th>Participants</th>
                </tr>
                {list1Items}
                {list2Items}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Box
        className="limit--container"
        sx={{flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center'}}
      >
        <span className="limit--text">
          Limit:
          {limit}
        </span>
        &nbsp;
        <button
          className="limit--button"
          onClick={() => {
            setLimit(limit + 10);
          }}
        >
          +
        </button>
        &nbsp;
        <button
          className="limit--button"
          onClick={() => {
            setLimit(limit + 50);
          }}
        >
          ++
        </button>
      </Box>
    </Stack>
  );
};

export default Replays;

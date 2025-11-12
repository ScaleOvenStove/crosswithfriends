import React, {useState, useEffect, useMemo, useCallback} from 'react';
import _ from 'lodash';
import Timestamp from '../components/common/Timestamp';
import {Link, useParams, useLocation} from 'react-router-dom';

import Nav from '../components/common/Nav';
import actions from '../actions';
import {useBattleStore} from '../store';
import redirect from '@crosswithfriends/shared/lib/redirect';
import {createGame} from '../api/create_game';
import {useUser} from '../hooks/useUser';

interface GameInfo {
  gid: string;
  pid: number;
  time?: number;
  v2?: boolean;
  solved?: boolean;
}

const Play: React.FC = () => {
  const params = useParams<{pid: string}>();
  const location = useLocation();
  const [userHistory, setUserHistory] = useState<Record<string, any> | null>(null);
  const [creating, setCreating] = useState<boolean>(false);

  const battleStore = useBattleStore();
  const user = useUser();

  const pid = useMemo(() => {
    return Number(params.pid);
  }, [params.pid]);

  const query = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const result: Record<string, string> = {};
    params.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }, [location.search]);

  const is_fencing = useMemo(() => {
    return !!query.fencing;
  }, [query.fencing]);

  const is_new = useMemo(() => {
    return !!query.new;
  }, [query.new]);

  const games = useMemo((): GameInfo[] | null => {
    if (!userHistory) {
      return null;
    }

    return _.keys(userHistory)
      .filter((gid) => userHistory[gid].pid === pid)
      .map((gid) => ({
        ...userHistory[gid],
        gid,
      }));
  }, [userHistory, pid]);

  const create = useCallback((): void => {
    if (!user.id) return;
    setCreating(true);
    actions.getNextGid(async (gid: string) => {
      await createGame({gid, pid});
      await user.joinGame(gid, {
        pid,
        solved: false,
        v2: true,
      });
      redirect(is_fencing ? `/fencing/${gid}` : `/beta/game/${gid}`);
    });
  }, [pid, is_fencing, user]);

  const createAndJoinBattle = useCallback((): void => {
    actions.getNextBid((bid: number) => {
      const path = `/battle/${bid}`;
      battleStore.initialize(path, pid, bid);
      const unsubscribe = battleStore.subscribe(path, 'ready', () => {
        unsubscribe();
        redirect(`/beta/battle/${bid}`);
      });
    });
  }, [pid, battleStore]);

  useEffect(() => {
    const unsubscribe = user.onAuth(() => {
      if (user.id) {
        user.listUserHistory().then((history) => {
          setUserHistory(history);
        });
      }
    });

    if (query.mode === 'battle') {
      createAndJoinBattle();
    }

    return () => {
      unsubscribe();
    };
  }, [query.mode, createAndJoinBattle, user]);

  useEffect(() => {
    if (query.mode === 'battle') {
      return;
    }

    const shouldAutocreate = !creating && (!games || (games && games.length === 0) || is_new);
    if (shouldAutocreate) {
      create();
      return;
    }
    const shouldAutojoin = games && games.length > 0 && !creating;
    if (shouldAutojoin) {
      const {gid} = games[0];
      const {v2} = games[0];
      const href = v2 ? (is_fencing ? `/fencing/${gid}` : `/beta/game/${gid}`) : `/game/${gid}`;

      if (games.length > 1) {
        setTimeout(() => {
          redirect(href, `Redirecting to game ${gid}`);
        }, 0);
      } else {
        redirect(href, null);
      }
    }
  }, [query.mode, creating, games, is_new, is_fencing, create]);

  if (creating) {
    return (
      <div>
        <Nav v2 />
        <div style={{padding: 20}}>Creating game...</div>
      </div>
    );
  }

  if (!games) {
    return (
      <div>
        <Nav v2 />
        <div style={{padding: 20}}>Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <Nav v2 />
      <div style={{padding: 20}}>
        Your Games
        <table>
          <tbody>
            {_.map(games, ({gid, time}) => (
              <tr key={gid}>
                <td>
                  <Timestamp time={time} />
                </td>
                <td>
                  <Link to={`/game/${gid}`}>Game {gid}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Play;

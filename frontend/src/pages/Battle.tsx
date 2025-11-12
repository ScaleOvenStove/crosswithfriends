import './css/battle.css';

import React, {useState, useEffect, useMemo, useCallback} from 'react';
import _ from 'lodash';
import {Helmet} from 'react-helmet';
import {Box, Stack} from '@mui/material';
// eslint-disable-next-line import/no-extraneous-dependencies
import classnames from 'classnames';
import {useBattle} from '../hooks/useBattle';
import redirect from '@crosswithfriends/shared/lib/redirect';
import {isMobile} from '@crosswithfriends/shared/lib/jsUtils';
import {useParams} from 'react-router-dom';

interface Player {
  name: string;
  team: number;
}

const Battle: React.FC = () => {
  const params = useParams<{bid: string}>();
  const [team, setTeam] = useState<number | undefined>(undefined);
  const [games, setGames] = useState<string[] | undefined>(undefined);
  const [startedAt, setStartedAt] = useState<number | undefined>(undefined);
  const [redirecting, setRedirecting] = useState<boolean>(false);
  const [name, setName] = useState<string | undefined>(undefined);
  const [players, setPlayers] = useState<Player[] | undefined>(undefined);

  const mobile = useMemo(() => isMobile(), []);

  const bid = useMemo(() => {
    return Number(params.bid);
  }, [params.bid]);

  const path = useMemo(() => `/battle/${bid}`, [bid]);

  const battle = useBattle({
    path,
    onGames: (gamesList: string[]) => {
      setGames(gamesList);
    },
    onStartedAt: (startedAtTime: number) => {
      setStartedAt(startedAtTime);
    },
    onPlayers: (playersRecord: unknown) => {
      setPlayers(_.values(playersRecord as Record<string, Player>));
    },
  });

  const handleTeamSelect = useCallback(
    (teamNum: number): void => {
      if (name) {
        battle.addPlayer(name, teamNum);
        setTeam(teamNum);
      }
    },
    [name, battle]
  );

  const handleChangeName = useCallback(
    (newName: string): void => {
      localStorage.setItem(`battle_${bid}`, newName);
      setName(newName);
    },
    [bid]
  );

  const handleUnload = useCallback((): void => {
    if (name && _.isNumber(team) && !redirecting) {
      battle.removePlayer(name, team);
    }
  }, [name, team, redirecting, battle]);

  useEffect(() => {
    battle.attach();
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      battle.detach();
    };
  }, [battle, handleUnload]);

  useEffect(() => {
    if (startedAt && team !== undefined && games && !redirecting) {
      const self = games[team];
      setRedirecting(true);
      redirect(`/beta/game/${self}`);
    }
  }, [startedAt, team, games, redirecting]);

  const renderPlayer = useCallback(
    (player: Player, idx: number): JSX.Element => (
      <Box className="battle--player" key={idx} sx={{display: 'flex'}}>
        {' '}
        {player.name}{' '}
      </Box>
    ),
    []
  );

  const renderTeam = useCallback(
    (teamPlayers: Player[], idx: number): JSX.Element => (
      <Box className="battle--team" key={idx} sx={{display: 'flex'}}>
        <Box className="battle--team-name" sx={{display: 'flex'}}>
          {' '}
          Team
          {Number(idx) + 1}
        </Box>
        {_.map(teamPlayers, renderPlayer)}
      </Box>
    ),
    [renderPlayer]
  );

  const renderTeams = useCallback((): JSX.Element => {
    if (!players) return <Box className="battle--teams" sx={{display: 'flex'}} />;
    const numTeams = Math.max(_.max(_.map(players, 'team')) || 0, 2);
    const teams = _.map(_.range(numTeams), (teamNum) => _.filter(players, {team: teamNum}));

    return (
      <Box className="battle--teams" sx={{display: 'flex'}}>
        {_.map(teams, renderTeam)}
      </Box>
    );
  }, [players, renderTeam]);

  const disabled = !name; // both undefined & '' are falsy
  const buttonClass = classnames('battle--button', {
    disabled,
  });

  return (
    <Stack
      className={classnames('battle', {mobile})}
      direction="column"
      sx={{
        flex: 1,
        width: '100%',
        height: '100%',
      }}
    >
      <Helmet>
        <title>Down For A Battle</title>
      </Helmet>
      <Box className="battle--main" sx={{flex: 1, display: 'flex'}}>
        <Stack direction="column" sx={{flexShrink: 0}}>
          {!_.isNumber(team) && (
            <Box className="battle--selector" sx={{display: 'flex'}}>
              <Box className="battle--buttons" sx={{display: 'flex'}}>
                <Box
                  className={buttonClass}
                  sx={{display: 'flex', justifyContent: 'center'}}
                  onClick={() => !disabled && handleTeamSelect(0)}
                >
                  Team 1
                </Box>
                <Box
                  className={buttonClass}
                  sx={{display: 'flex', justifyContent: 'center'}}
                  onClick={() => !disabled && handleTeamSelect(1)}
                >
                  Team 2
                </Box>
              </Box>
              <Box className="battle--name" sx={{display: 'flex'}}>
                <input
                  className="battle--input"
                  placeholder="Name..."
                  onChange={(event) => handleChangeName(event.target.value)}
                />
              </Box>
              {renderTeams()}
            </Box>
          )}
          {_.isNumber(team) && !startedAt && (
            <Box className="battle--selector" sx={{display: 'flex'}}>
              <Box className="battle--teams" sx={{display: 'flex'}}>
                (This starts the game for all players)
              </Box>
              <Box className="battle--buttons" sx={{display: 'flex'}}>
                <Box
                  className="battle--button"
                  sx={{display: 'flex', justifyContent: 'center'}}
                  onClick={() => battle.start()}
                >
                  Start
                </Box>
              </Box>
              {renderTeams()}
            </Box>
          )}
        </Stack>
      </Box>
    </Stack>
  );
};

export default Battle;

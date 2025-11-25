import type {GameState} from '@crosswithfriends/shared/fencingGameEvents/types/GameState';
import {Box, Stack} from '@mui/material';
import React, {useCallback} from 'react';

import EditableSpan from '../common/EditableSpan';
import './css/fencingScoreboard.css';
export const FencingScoreboard: React.FC<{
  gameState: GameState;
  currentUserId: string;
  joinTeam(teamId: number): void;
  spectate(): void;
  changeName(newName: string): void;
  changeTeamName(newName: string): void;
  isGameComplete: boolean;
}> = (props) => {
  // TODO buttons need to be icons / dropdown menu once team names are editable
  const handleSpectate = useCallback(() => {
    props.spectate();
  }, [props]);

  const handleJoinTeam = useCallback(
    (teamId: number) => {
      props.joinTeam(teamId);
    },
    [props]
  );

  const spectateButton = (
    <button onClick={handleSpectate} type="button">
      Leave Team
    </button>
  );

  // Determine if the game is complete and which team won
  // should be able to handle ties with any number of teams
  const winningTeams = props.isGameComplete
    ? (() => {
        const teams = Object.values(props.gameState.teams).filter(Boolean);
        const maxScore = teams.reduce((max, team) => Math.max(max, team?.score ?? 0), 0);
        return teams.filter((team) => team?.score === maxScore);
      })()
    : null;

  const teamData = Object.keys(props.gameState.teams)
    .map((teamId) => {
      const team = props.gameState.teams[teamId];
      if (!team) return null;
      return {
        team,
        users: Object.values(props.gameState.users).filter((user) => String(user.teamId) === teamId),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const currentUser = Object.values(props.gameState.users).find((user) => user.id === props.currentUserId);
  const rows: {
    nameEl: React.ReactNode;
    score?: number;
    guesses?: number;
    isCurrent?: boolean;
  }[] = teamData.flatMap(({team, users}) => [
    {
      nameEl: (
        <Stack
          direction="row"
          spacing={0.5}
          sx={{justifyContent: 'space-between', '& > *': {marginLeft: 0.5}}}
        >
          {currentUser?.teamId === team.id ? (
            <EditableSpan
              style={{
                fontWeight: 'bold',
                color: team.color,
              }}
              value={team.name}
              onChange={props.changeTeamName}
            />
          ) : (
            <span
              style={{
                fontWeight: 'bold',
                color: team.color,
              }}
            >
              {team.name}
            </span>
          )}
          {currentUser?.teamId === team.id && spectateButton}
          {currentUser?.teamId === 0 && (
            <button onClick={handleJoinTeam.bind(null, team.id)} type="button">
              Join Team
            </button>
          )}
          {props.isGameComplete && winningTeams?.some((winner) => winner?.id === team.id) && (
            <Box component="span" sx={{marginLeft: 1, color: '#4CAF50', fontWeight: 'bold'}}>
              {winningTeams.length > 1 ? '🤝 Tie!' : '🏆 Winner!'}
            </Box>
          )}
        </Stack>
      ),
      score: team.score,
      guesses: team.guesses,
    },
    ...users.map((user) => ({
      nameEl: (
        <Stack direction="row" spacing={0.5} sx={{marginLeft: 2.5, justifyContent: 'space-between'}}>
          {user.id === props.currentUserId ? (
            <EditableSpan value={user.displayName} onChange={props.changeName} />
          ) : (
            <span>{user.displayName}</span>
          )}
        </Stack>
      ),
      score: user.score,
      guesses: user.misses,
      isCurrent: user.id === props.currentUserId,
    })),
  ]);
  const spectators = Object.values(props.gameState.users).filter((user) => user.teamId === 0);
  const spectatorRows: {
    nameEl: React.ReactNode;
    score?: number;
    guesses?: number;
    isCurrent?: boolean;
  }[] =
    spectators.length === 0
      ? []
      : [
          {
            nameEl: (
              <span
                style={{
                  fontWeight: 'bold',
                }}
              >
                Spectators
              </span>
            ),
          },
          ...spectators.map((user) => ({
            nameEl: <span>{user.displayName}</span>,
            isCurrent: user.id === props.currentUserId,
          })),
        ];
  return (
    <Stack direction="column" sx={{'& td, th': {padding: 1}}}>
      <table>
        <tbody>
          <tr>
            <th>Player</th>
            <th>Score</th>
            <th>Guesses</th>
          </tr>
          {[...rows, ...spectatorRows].map(({nameEl, score, guesses, isCurrent}, i) => (
            <tr key={i} className={isCurrent ? 'fencing-scoreboard--current-user' : ''}>
              <td>{nameEl}</td>
              <td>{score}</td>
              <td>{guesses}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Stack>
  );
};

import {Box, Stack} from '@mui/material';
import _ from 'lodash';
import React from 'react';
import {GameState} from '@crosswithfriends/shared/fencingGameEvents/types/GameState';
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
  const spectateButton = (
    <button
      onClick={() => {
        props.spectate();
      }}
    >
      Leave Team
    </button>
  );

  // Determine if the game is complete and which team won
  // should be able to handle ties with any number of teams
  const winningTeams = props.isGameComplete
    ? (() => {
        const teams = _.values(props.gameState.teams).filter(Boolean);
        const maxScore = _.maxBy(teams, 'score')?.score;
        return teams.filter((team) => team?.score === maxScore);
      })()
    : null;

  const teamData = _.keys(props.gameState.teams).map((teamId) => ({
    team: props.gameState.teams[teamId]!,
    users: _.values(props.gameState.users).filter((user) => String(user.teamId) === teamId),
  }));
  const currentUser = _.values(props.gameState.users).find((user) => user.id === props.currentUserId);
  const rows: {
    nameEl: React.ReactNode;
    score?: number;
    guesses?: number;
    isCurrent?: boolean;
  }[] = _.flatMap(teamData, ({team, users}) => [
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
            <button
              onClick={() => {
                props.joinTeam(team.id);
              }}
            >
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
  const spectators = _.values(props.gameState.users).filter((user) => user.teamId === 0);
  const spectatorRows: {
    nameEl: React.ReactNode;
    score?: number;
    guesses?: number;
    isCurrent?: boolean;
  }[] = _.isEmpty(spectators)
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
          {_.map([...rows, ...spectatorRows], ({nameEl, score, guesses, isCurrent}, i) => (
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

/**
 * API client exports
 */

export * from './types';

// Export the generated API clients
export {
  healthApi,
  puzzlesApi,
  countersApi,
  gamesApi,
  statsApi,
  linkPreviewApi,
} from './apiClient';
export type {
  GetHealth200Response,
  CreatePuzzleRequest,
  CreatePuzzleRequestPuzzle,
  CreatePuzzleRequestPuzzleClues,
  CreatePuzzleRequestPuzzleDimensions,
  CreatePuzzle200Response,
  ListPuzzles400Response,
  GetNewGameId200Response,
  GetNewPuzzleId200Response,
  CreateGame200Response,
  CreateGameRequest,
  GetGameById200Response,
  SubmitStatsRequest,
  SubmitStats200Response,
  RecordPuzzleSolveRequest,
  GetOembed200Response,
} from './apiClient';

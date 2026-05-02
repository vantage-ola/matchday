export { Engine, listFormations, FORMATIONS } from '@engine/index.js';
export {
  type GameState,
  type Player,
  type GridPosition,
  type Team,
  type MoveResult,
  type FormationName,
  type Outcome,
  type GameStatus,
  ROWS,
  COLS,
  posEq,
  posToString,
  rowToNum,
  gridDistance,
  AP_COST,
} from '@engine/types.js';
export {
  getValidMoves,
  aggressiveStrategy,
  type MoveOption,
  type MatchEvent,
  type Strategy,
} from '@simulation/simulate.js';

export type GameMode = 'local' | 'ai';
export type GamePhase = 'setup' | 'playing' | 'fullTime';

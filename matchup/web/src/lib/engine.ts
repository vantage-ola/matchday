export {
  Engine,
  listFormations,
  FORMATIONS,
  previewPass,
  previewTackle,
  getPassTargets,
  type PassPreview,
  type TacklePreview,
  type PassTarget,
  type LineRisk,
} from '@engine/index.js';
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
  HALF_TIME_THRESHOLD,
} from '@engine/types.js';
export {
  getValidMoves,
  aggressiveStrategy,
  cautiousStrategy,
  tacticalStrategy,
  type MoveOption,
  type MatchEvent,
  type Strategy,
} from '@simulation/simulate.js';

export type GameMode = 'local' | 'ai';
export type GamePhase = 'menu' | 'setup' | 'playing' | 'fullTime' | 'tutorial';

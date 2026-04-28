export type Role = 'gk' | 'def' | 'mid' | 'fwd';
export type Team = 'home' | 'away';
export type MovePhase = 'attack';
export type MoveType = 'move' | 'pass' | 'shoot' | 'tackle';
export type Outcome = 'success' | 'intercepted' | 'blocked' | 'tackled' | 'goal' | 'miss';
export type TurnStatus = 'playing' | 'scored' | 'turnover';
export type FormationName = '4-3-3' | '4-4-2' | '3-5-2' | '5-3-2' | '4-2-3-1' | '3-4-3';

export interface GridPosition {
  col: number;
  row: string;
}

export interface Player {
  id: string;
  name: string;
  role: Role;
  team: Team;
  position: GridPosition;
  hasBall: boolean;
}

export interface GameState {
  players: Player[];
  ball: GridPosition;
  ballCarrierId: string | null;
  possession: Team;
  moveNumber: number;
  movePhase: MovePhase;
  phase: number;
  score: { home: number; away: number };
  timeRemaining: number;
  status: GameStatus;
  homeFormation: FormationName;
  awayFormation: FormationName;
}

export type GameStatus = 'playing' | 'halfTime' | 'fullTime' | 'abandoned';

export interface Move {
  playerId: string;
  from: GridPosition;
  to: GridPosition;
  type: MoveType;
}

export interface MoveResult {
  valid: boolean;
  move?: Move;
  outcome: Outcome;
  newState: GameState;
  scored?: boolean;
  possessionChange?: boolean;
}

export const ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'] as const;
export const COLS = 22;

// Move distance limits
export const MAX_DRIBBLE_DIST = 2;
export const MAX_PASS_DIST = 7;
export const MAX_RUN_DIST = 3;
export const MAX_TACKLE_DIST = 2;
export const MAX_SHOT_DIST = 3;

// Interception: how close a defender must be to the pass line
export const INTERCEPT_RADIUS = 1.2;

export function posEq(a: GridPosition, b: GridPosition): boolean {
  return a.col === b.col && a.row === b.row;
}

export function posToString(pos: GridPosition): string {
  return `${pos.row}${pos.col}`;
}

export function parsePos(str: string): GridPosition {
  const row = str[0];
  const col = parseInt(str.slice(1), 10);
  return { row, col };
}

export function rowToNum(row: string): number {
  return row.charCodeAt(0) - 'a'.charCodeAt(0);
}

export function gridDistance(a: GridPosition, b: GridPosition): number {
  return Math.max(
    Math.abs(a.col - b.col),
    Math.abs(rowToNum(a.row) - rowToNum(b.row))
  );
}

export const HOME_GOAL = { col: 1, minRow: 'e', maxRow: 'g' };
export const AWAY_GOAL = { col: 22, minRow: 'e', maxRow: 'g' };

export function isGoalPosition(pos: GridPosition, team: Team): boolean {
  const goal = team === 'home' ? AWAY_GOAL : HOME_GOAL;
  return (
    pos.col === goal.col &&
    pos.row >= goal.minRow &&
    pos.row <= goal.maxRow
  );
}

export function isInGoalArea(pos: GridPosition, team: Team): boolean {
  const goal = team === 'home' ? AWAY_GOAL : HOME_GOAL;
  const colDist = Math.abs(pos.col - goal.col);
  const rowDist = pos.row < goal.minRow
    ? rowToNum(goal.minRow) - rowToNum(pos.row)
    : pos.row > goal.maxRow
      ? rowToNum(pos.row) - rowToNum(goal.maxRow)
      : 0;
  return colDist <= MAX_SHOT_DIST && rowDist <= MAX_SHOT_DIST;
}
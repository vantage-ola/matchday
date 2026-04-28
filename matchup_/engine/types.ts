export type Role = 'gk' | 'def' | 'mid' | 'fwd';
export type Team = 'home' | 'away';
export type MovePhase = 'attack' | 'defense';
export type MoveType = 'move' | 'pass' | 'shoot';
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
  timeRemaining: number;  // seconds remaining
  status: GameStatus;
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

export const HOME_GOAL = { col: 1, minRow: 'e', maxRow: 'g' };
export const AWAY_GOAL = { col: 22, minRow: 'e', maxRow: 'g' };

export function isGoalPosition(pos: GridPosition, team: Team): boolean {
  const goal = team === 'home' ? HOME_GOAL : AWAY_GOAL;
  return (
    pos.col === goal.col &&
    pos.row >= goal.minRow &&
    pos.row <= goal.maxRow
  );
}

export function isInGoalArea(pos: GridPosition, team: Team): boolean {
  const targetCol = team === 'home' ? 22 : 1;
  const dist = Math.abs(pos.col - targetCol);
  return dist <= 3;
}
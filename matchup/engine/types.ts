export type Role = 'gk' | 'def' | 'mid' | 'fwd';
export type Team = 'home' | 'away';
export type MoveType = 'move' | 'pass' | 'shoot' | 'tackle';
export type Outcome = 'success' | 'intercepted' | 'blocked' | 'tackled' | 'tackleFailed' | 'goal' | 'miss';
export type FormationName = '4-3-3' | '4-4-2' | '3-5-2' | '5-3-2' | '4-2-3-1' | '3-4-3';

export interface GridPosition {
  col: number;
  row: string;
}

export interface PlayerStats {
  passes: number;
  passesCompleted: number;
  tackles: number;
  tacklesWon: number;
  shots: number;
  shotsOnTarget: number;
  goals: number;
  interceptions: number;
}

export function emptyPlayerStats(): PlayerStats {
  return {
    passes: 0,
    passesCompleted: 0,
    tackles: 0,
    tacklesWon: 0,
    shots: 0,
    shotsOnTarget: 0,
    goals: 0,
    interceptions: 0,
  };
}

export interface Player {
  id: string;
  name: string;
  role: Role;
  team: Team;
  position: GridPosition;
  hasBall: boolean;
  stats: PlayerStats;
}

export type MatchEventType =
  | 'move'
  | 'pass'
  | 'tackle'
  | 'tackleFailed'
  | 'interception'
  | 'goal'
  | 'miss'
  | 'blocked';

export interface MatchEvent {
  moveNumber: number;
  time: number;
  type: MatchEventType;
  team: Team;
  description: string;
  playerId?: string;
  from?: GridPosition;
  to?: GridPosition;
}

export interface GameState {
  matchId: string;
  seed: number;
  players: Player[];
  ball: GridPosition;
  ballCarrierId: string | null;
  possession: Team;
  score: { home: number; away: number };
  timeRemaining: number;
  matchLength: number;
  status: GameStatus;
  homeFormation: FormationName;
  awayFormation: FormationName;
  halfTimeTriggered: boolean;
  events: MatchEvent[];
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

// Movement: dribbles, runs, and tackles are all 1 cell. Passes/shots reach 10.
export const MAX_STEP_DIST = 1;
export const MAX_PASS_DIST = 10;

// Interception: how close a defender must be to the pass line
export const INTERCEPT_RADIUS = 1.2;

// Role-weighted tackle success: defenders press best, forwards worst.
export const TACKLE_SUCCESS_BY_ROLE: Record<Role, number> = {
  def: 0.70,
  mid: 0.50,
  fwd: 0.20,
  gk: 0.70,
};

export function tackleSuccessFor(role: Role): number {
  return TACKLE_SUCCESS_BY_ROLE[role];
}

export const DEFAULT_MATCH_LENGTH = 5400;
export const MOVE_TIME = 10;
export const HALF_TIME_THRESHOLD = 2700;

export function halfTimeThresholdFor(matchLength: number): number {
  return Math.floor(matchLength / 2);
}

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

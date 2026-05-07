import type { GameState, GridPosition, Player, Team } from './types.js';
import {
  posEq,
  rowToNum,
  gridDistance,
  MAX_STEP_DIST,
  MAX_PASS_DIST,
  INTERCEPT_RADIUS,
} from './types.js';
import { getPlayer, getBallCarrier, getPlayerAt, getTeamPlayers } from './formations.js';

// UI-only "close call" multiplier — defenders within this many radii of the
// pass line are flagged as risky even when the engine wouldn't intercept.
const RISK_RADIUS_MULTIPLIER = 1.5;

export type LineRisk = 'clear' | 'risk' | 'blocked';

export interface PassPreview {
  intercepted: boolean;
  interceptorId: string | null;
  lineRisk: LineRisk;
}

export interface TacklePreview {
  successProbability: number;
}

export interface PassTarget {
  playerId: string;
  to: GridPosition;
  lineRisk: LineRisk;
  interceptorId: string | null;
}

export interface MoveError {
  valid: false;
  error: string;
}

export type MoveValidation = MoveError | { valid: true };

export function getAttackDirection(team: Team): number {
  return team === 'home' ? 1 : -1;
}

/**
 * Determine the type of move a player is attempting.
 */
export function classifyMove(
  state: GameState,
  player: Player,
  to: GridPosition
): 'dribble' | 'pass' | 'shoot' | 'tackle' | 'run' | 'invalid' {
  const ballCarrier = getBallCarrier(state);
  const hasBall = ballCarrier?.id === player.id;
  const occupant = getPlayerAt(state, to);

  if (hasBall) {
    // Any move targeting the goal column is a shot attempt
    const targetGoalCol = player.team === 'home' ? 22 : 1;
    if (to.col === targetGoalCol) {
      // A shot must land in an empty goal cell or a defender's cell only counts as blocked-after-shot at apply-time;
      // for legality, treat occupied opposing cell on the goal column as still a shoot attempt.
      if (occupant && occupant.team === player.team && occupant.id !== player.id) return 'pass';
      return 'shoot';
    }

    // Ball carrier moving to a teammate's cell
    if (occupant && occupant.team === player.team && occupant.id !== player.id) return 'pass';
    // Ball carrier moving to an empty cell
    if (!occupant) return 'dribble';
    // Targeting an opponent's cell while holding the ball is not a legal action.
    return 'invalid';
  }

  // Without ball: moving onto opposing ball carrier = tackle
  if (occupant && occupant.team !== player.team && occupant.hasBall) return 'tackle';
  // Without ball: moving to empty cell = off-ball run
  if (!occupant) return 'run';
  return 'invalid';
}

/**
 * Core movement validation. Returns true if the player can legally
 * move to the target cell given the current game state.
 *
 * Chess-style ruleset:
 *  - dribble / run / tackle = exactly 1 cell, any direction
 *  - pass / shoot = up to 10 cells, any direction
 *  - no AP, no swarm rule, no backward restriction, no pursuit cap
 */
export function canMoveTo(
  state: GameState,
  player: Player,
  to: GridPosition
): boolean {
  // Bounds check
  if (to.col < 1 || to.col > 22) return false;
  if (to.row < 'a' || to.row > 'k') return false;

  // Same position check
  if (posEq(player.position, to)) return false;

  const moveType = classifyMove(state, player, to);
  if (moveType === 'invalid') return false;

  const dist = gridDistance(player.position, to);

  switch (moveType) {
    case 'dribble':  return dist === MAX_STEP_DIST;
    case 'run':      return dist === MAX_STEP_DIST;
    case 'tackle':   return dist === MAX_STEP_DIST;
    case 'pass':     return dist >= 1 && dist <= MAX_PASS_DIST;
    case 'shoot':    return dist >= 1 && dist <= MAX_PASS_DIST;
    default:         return false;
  }
}

export function validateMove(
  state: GameState,
  playerId: string,
  to: GridPosition
): MoveValidation {
  const player = getPlayer(state, playerId);
  if (!player) return { valid: false, error: 'Player not found' };

  if (posEq(player.position, to)) {
    return { valid: false, error: 'Cannot move to same position' };
  }

  if (to.col < 1 || to.col > 22 || to.row < 'a' || to.row > 'k') {
    return { valid: false, error: 'Out of bounds' };
  }

  const moveType = classifyMove(state, player, to);
  const ballCarrier = getBallCarrier(state);
  const hasBall = ballCarrier?.id === player.id;

  if (moveType === 'invalid') {
    if (hasBall) return { valid: false, error: 'Cannot move into an opponent' };
    return { valid: false, error: 'Cannot move to occupied cell' };
  }

  const dist = gridDistance(player.position, to);
  if (moveType === 'dribble' || moveType === 'run' || moveType === 'tackle') {
    if (dist !== MAX_STEP_DIST) {
      return { valid: false, error: `${moveType} must be exactly 1 cell (got ${dist})` };
    }
    return { valid: true };
  }

  // pass / shoot
  if (dist > MAX_PASS_DIST) {
    return { valid: false, error: `Too far: ${dist} cells (max ${MAX_PASS_DIST} for ${moveType})` };
  }

  return { valid: true };
}

/**
 * Check if a pass from `from` to `to` by `passingTeam` is intercepted
 * by any defender. Returns the intercepting defender's ID if so.
 *
 * Pure function — takes state explicitly, no side effects.
 */
export function checkInterception(
  state: GameState,
  from: GridPosition,
  to: GridPosition,
  passingTeam: Team
): { intercepted: boolean; interceptorId: string | null } {
  const defenders = getTeamPlayers(state, passingTeam === 'home' ? 'away' : 'home')
    .filter((d) => !d.hasBall);

  const passLenSq =
    Math.pow(to.col - from.col, 2) +
    Math.pow(rowToNum(to.row) - rowToNum(from.row), 2);

  if (passLenSq < 0.01) return { intercepted: false, interceptorId: null };

  for (const def of defenders) {
    const t = Math.max(
      0,
      Math.min(
        1,
        ((def.position.col - from.col) * (to.col - from.col) +
          (rowToNum(def.position.row) - rowToNum(from.row)) *
            (rowToNum(to.row) - rowToNum(from.row))) /
          passLenSq
      )
    );

    const projCol = from.col + t * (to.col - from.col);
    const projRow = rowToNum(from.row) + t * (rowToNum(to.row) - rowToNum(from.row));

    const dist = Math.sqrt(
      Math.pow(def.position.col - projCol, 2) +
        Math.pow(rowToNum(def.position.row) - projRow, 2)
    );

    if (dist < INTERCEPT_RADIUS) {
      return { intercepted: true, interceptorId: def.id };
    }
  }

  return { intercepted: false, interceptorId: null };
}

/**
 * Read-only preview for a pass from `from` to `to`. Wraps `checkInterception`
 * with a UI-friendly `lineRisk` heuristic so the readability layer can paint
 * green/yellow/red lanes without recomputing geometry.
 */
export function previewPass(
  state: GameState,
  from: GridPosition,
  to: GridPosition,
  passingTeam: Team
): PassPreview {
  const intercept = checkInterception(state, from, to, passingTeam);
  if (intercept.intercepted) {
    return {
      intercepted: true,
      interceptorId: intercept.interceptorId,
      lineRisk: 'blocked',
    };
  }

  const defenders = getTeamPlayers(state, passingTeam === 'home' ? 'away' : 'home')
    .filter((d) => !d.hasBall);

  const passLenSq =
    Math.pow(to.col - from.col, 2) +
    Math.pow(rowToNum(to.row) - rowToNum(from.row), 2);

  if (passLenSq < 0.01) {
    return { intercepted: false, interceptorId: null, lineRisk: 'clear' };
  }

  const riskRadius = INTERCEPT_RADIUS * RISK_RADIUS_MULTIPLIER;

  for (const def of defenders) {
    const t = Math.max(
      0,
      Math.min(
        1,
        ((def.position.col - from.col) * (to.col - from.col) +
          (rowToNum(def.position.row) - rowToNum(from.row)) *
            (rowToNum(to.row) - rowToNum(from.row))) /
          passLenSq
      )
    );
    const projCol = from.col + t * (to.col - from.col);
    const projRow = rowToNum(from.row) + t * (rowToNum(to.row) - rowToNum(from.row));
    const dist = Math.sqrt(
      Math.pow(def.position.col - projCol, 2) +
        Math.pow(rowToNum(def.position.row) - projRow, 2)
    );
    if (dist < riskRadius) {
      return { intercepted: false, interceptorId: null, lineRisk: 'risk' };
    }
  }

  return { intercepted: false, interceptorId: null, lineRisk: 'clear' };
}

/**
 * Read-only preview for a tackle attempt. The 0.80 success rate is a fixed
 * engine constant today; exposing it here lets the UI render a "80%" badge
 * without duplicating the literal, and gives future per-player attributes a
 * single point to flow through.
 */
export function previewTackle(
  _state: GameState,
  _attackerId: string
): TacklePreview {
  return { successProbability: 0.8 };
}

/**
 * Enumerate every legal pass target for the given player along with the
 * lane's risk level. Returns an empty array if the player isn't on the ball
 * or can't legally pass.
 */
export function getPassTargets(
  state: GameState,
  playerId: string
): PassTarget[] {
  const player = getPlayer(state, playerId);
  if (!player) return [];
  const carrier = getBallCarrier(state);
  if (!carrier || carrier.id !== player.id) return [];

  const targets: PassTarget[] = [];
  for (const teammate of getTeamPlayers(state, player.team)) {
    if (teammate.id === player.id) continue;
    if (classifyMove(state, player, teammate.position) !== 'pass') continue;
    if (!canMoveTo(state, player, teammate.position)) continue;
    const preview = previewPass(state, player.position, teammate.position, player.team);
    targets.push({
      playerId: teammate.id,
      to: teammate.position,
      lineRisk: preview.lineRisk,
      interceptorId: preview.interceptorId,
    });
  }
  return targets;
}

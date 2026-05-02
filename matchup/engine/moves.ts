import type { GameState, Player, GridPosition, Team } from './types.js';
import {
  isInGoalArea,
  posEq,
  rowToNum,
  gridDistance,
  MAX_DRIBBLE_DIST,
  MAX_PASS_DIST,
  MAX_RUN_DIST,
  MAX_PURSUIT_DIST,
  MAX_TACKLE_DIST,
  MAX_SHOT_DIST,
  INTERCEPT_RADIUS,
  AP_COST,
} from './types.js';
import { getPlayer, getBallCarrier, getPlayerAt, getTeamPlayers } from './formations.js';

export interface MoveError {
  valid: false;
  error: string;
}

export type MoveValidation = MoveError | { valid: true };

export function getAttackDirection(team: Team): number {
  return team === 'home' ? 1 : -1;
}

export function isForwardMove(from: GridPosition, to: GridPosition, team: Team): boolean {
  const dir = getAttackDirection(team);
  return dir * (to.col - from.col) > 0;
}

export function isBackwardMove(from: GridPosition, to: GridPosition, team: Team): boolean {
  const dir = getAttackDirection(team);
  return dir * (to.col - from.col) < 0;
}

export function isSidewaysMove(from: GridPosition, to: GridPosition): boolean {
  return from.col === to.col && from.row !== to.row;
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
    if (to.col === targetGoalCol) return 'shoot';

    // Ball carrier moving to a teammate's cell
    if (occupant && occupant.team === player.team && occupant.id !== player.id) return 'pass';
    // Ball carrier moving to an empty cell
    if (!occupant) return 'dribble';
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

  // ACTION POINT BUDGET CHECK
  const cost = AP_COST[moveType];
  if (state.actionPoints < cost) return false;

  // Ball carriers cannot dribble/shoot backward (passes to teammates allowed)
  const ballCarrier = getBallCarrier(state);
  const hasBall = ballCarrier?.id === player.id;
  if (hasBall) {
    if (isBackwardMove(player.position, to, player.team)) {
      const occupant = getPlayerAt(state, to);
      const isPassToTeammate = occupant && occupant.team === player.team && occupant.id !== player.id;
      if (!isPassToTeammate) return false;
    }
  }
  
  // OPEN RECEIVER CHECK: 2+ markers within 1 cell (Chebyshev) block the pass
  if (moveType === 'pass') {
    const target = getPlayerAt(state, to);
    if (target) {
      const oppTeam = player.team === 'home' ? 'away' : 'home';
      const markerCount = state.players.reduce((n, p) => {
        if (p.team !== oppTeam) return n;
        const close =
          Math.abs(p.position.col - target.position.col) <= 1 &&
          Math.abs(rowToNum(p.position.row) - rowToNum(target.position.row)) <= 1;
        return close ? n + 1 : n;
      }, 0);
      if (markerCount >= 2) return false;
    }
  }

  // Distance check per move type
  const dist = gridDistance(player.position, to);
  switch (moveType) {
    case 'dribble':  return dist <= MAX_DRIBBLE_DIST;
    case 'pass':     return dist <= MAX_PASS_DIST;
    case 'shoot':    return dist <= MAX_SHOT_DIST;
    case 'tackle':   return dist <= MAX_TACKLE_DIST;
    case 'run': {
      if (dist > MAX_RUN_DIST) return false;
      // Pursuit cap: off-ball runs that close on the ball-carrier are limited
      if (ballCarrier && ballCarrier.team !== player.team) {
        const before = gridDistance(player.position, ballCarrier.position);
        const after = gridDistance(to, ballCarrier.position);
        if (after < before && dist > MAX_PURSUIT_DIST) return false;
      }
      return true;
    }
    default:         return false;
  }
}

/**
 * Additional pass-specific validation beyond canMoveTo.
 * Passes cannot go backward.
 */
export function canPassTo(
  state: GameState,
  passer: Player,
  target: Player
): boolean {
  const ballCarrier = getBallCarrier(state);
  if (ballCarrier?.id !== passer.id) return false;
  if (isBackwardMove(passer.position, target.position, passer.team)) return false;
  return gridDistance(passer.position, target.position) <= MAX_PASS_DIST;
}

export function canShoot(state: GameState, shooter: Player): boolean {
  const ballCarrier = getBallCarrier(state);
  if (ballCarrier?.id !== shooter.id) return false;
  return isInGoalArea(shooter.position, shooter.team);
}

export function canTackle(state: GameState, tackler: Player): boolean {
  const ballCarrier = getBallCarrier(state);
  if (!ballCarrier) return false;
  if (ballCarrier.team === tackler.team) return false;
  return gridDistance(tackler.position, ballCarrier.position) <= MAX_TACKLE_DIST;
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

  if (!canMoveTo(state, player, to)) {
    const moveType = classifyMove(state, player, to);
    const ballCarrier = getBallCarrier(state);
    const hasBall = ballCarrier?.id === player.id;

    const cost = AP_COST[moveType];
    if (state.actionPoints < cost) {
      return { valid: false, error: `Not enough AP (need ${cost}, have ${state.actionPoints})` };
    }

    if (moveType === 'pass') {
      const target = getPlayerAt(state, to);
      if (target) {
        const oppTeam = player.team === 'home' ? 'away' : 'home';
        const markerCount = state.players.reduce((n, p) => {
          if (p.team !== oppTeam) return n;
          const close =
            Math.abs(p.position.col - target.position.col) <= 1 &&
            Math.abs(rowToNum(p.position.row) - rowToNum(target.position.row)) <= 1;
          return close ? n + 1 : n;
        }, 0);
        if (markerCount >= 2) return { valid: false, error: 'Receiver is marked (2+ defenders within 1 cell)' };
      }
    }

    if (moveType === 'pass' && isBackwardMove(player.position, to, player.team)) {
      return { valid: false, error: 'Cannot pass backward' };
    }
    if (moveType === 'invalid' && hasBall) {
      return { valid: false, error: 'Cannot dribble into an opponent' };
    }
    if (moveType === 'invalid') {
      return { valid: false, error: 'Cannot move to occupied cell' };
    }

    const dist = gridDistance(player.position, to);
    const maxDist =
      moveType === 'dribble' ? MAX_DRIBBLE_DIST :
      moveType === 'pass' ? MAX_PASS_DIST :
      moveType === 'shoot' ? MAX_SHOT_DIST :
      moveType === 'tackle' ? MAX_TACKLE_DIST :
      MAX_RUN_DIST;

    if (dist > maxDist) {
      return { valid: false, error: `Too far: ${dist} cells (max ${maxDist} for ${moveType})` };
    }

    if (moveType === 'run' && ballCarrier && ballCarrier.team !== player.team) {
      const before = gridDistance(player.position, ballCarrier.position);
      const after = gridDistance(to, ballCarrier.position);
      if (after < before && dist > MAX_PURSUIT_DIST) {
        return { valid: false, error: `Pursuit cap: closing on the ball is limited to ${MAX_PURSUIT_DIST} cell` };
      }
    }

    return { valid: false, error: 'Invalid move' };
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
    .filter((d) => !d.hasBall); // exclude GK who has ball after turnover etc.

  const passLenSq =
    Math.pow(to.col - from.col, 2) +
    Math.pow(rowToNum(to.row) - rowToNum(from.row), 2);

  if (passLenSq < 0.01) return { intercepted: false, interceptorId: null };

  for (const def of defenders) {
    // Project defender onto the pass line segment
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
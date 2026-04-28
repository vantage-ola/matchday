import type { GameState, Player, GridPosition, Team } from './types.js';
import { isInGoalArea, posEq } from './types.js';
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
  const colDiff = to.col - from.col;
  return dir * colDiff > 0;
}

export function isBackwardMove(from: GridPosition, to: GridPosition, team: Team): boolean {
  const dir = getAttackDirection(team);
  const colDiff = to.col - from.col;
  return dir * colDiff < 0;
}

export function isSidewaysMove(from: GridPosition, to: GridPosition): boolean {
  return from.col === to.col && from.row !== to.row;
}

export function canMoveTo(
  state: GameState,
  player: Player,
  to: GridPosition,
  checkOccupied = true
): boolean {
  if (to.col < 1 || to.col > 22) return false;
  if (to.row < 'a' || to.row > 'k') return false;

  if (checkOccupied) {
    const occupant = getPlayerAt(state, to);
    if (occupant && occupant.id !== player.id) return false;
  }

  const ballCarrier = getBallCarrier(state);
  const hasBall = ballCarrier?.id === player.id;

  if (hasBall) {
    if (isBackwardMove(player.position, to, player.team)) return false;
    return true;
  } else {
    if (ballCarrier && ballCarrier.team === player.team) {
      if (isBackwardMove(player.position, to, player.team)) {
        const ballCol = ballCarrier.position.col;
        const dir = getAttackDirection(player.team);
        if (dir * to.col < dir * ballCol) return false;
      }
    }
    return true;
  }
}

export function canPassTo(
  state: GameState,
  passer: Player,
  target: Player
): boolean {
  const ballCarrier = getBallCarrier(state);
  if (ballCarrier?.id !== passer.id) return false;
  if (isBackwardMove(passer.position, target.position, passer.team)) return false;
  return true;
}

export function canShoot(state: GameState, shooter: Player): boolean {
  const ballCarrier = getBallCarrier(state);
  if (ballCarrier?.id !== shooter.id) return false;
  return isInGoalArea(shooter.position, shooter.team);
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
    return { valid: false, error: 'Invalid move direction' };
  }

  return { valid: true };
}
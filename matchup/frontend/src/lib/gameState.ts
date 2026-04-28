import type { GameState, PlayerSide, AttackerAction, DefenderAction } from '../types';

export function isMyTurn(
  gameState: GameState,
  playerSide: PlayerSide
): boolean {
  if (gameState.turnStatus === 'waiting_both') return true;
  if (gameState.turnStatus === 'waiting_home') return playerSide === 'home';
  if (gameState.turnStatus === 'waiting_away') return playerSide === 'away';
  return false;
}

export function canShoot(gameState: GameState, playerSide: PlayerSide): boolean {
  const attackPosition = gameState.ball.position;
  const isAttacking = gameState.attackingSide === playerSide;
  if (!isAttacking) return false;
  return playerSide === 'home' ? attackPosition.col >= 12 : attackPosition.col <= 2;
}

export function getAttackingSide(gameState: GameState): PlayerSide {
  return gameState.attackingSide;
}

export function getBallPosition(
  gameState: GameState
): { col: number; row: number } {
  return gameState.ball.position;
}

export function getBallCarrier(gameState: GameState): string | null {
  return gameState.ball.carrierCapId;
}

export function getScore(
  gameState: GameState,
  playerSide: PlayerSide
): { mine: number; theirs: number } {
  if (playerSide === 'home') {
    return {
      mine: gameState.score.home,
      theirs: gameState.score.away,
    };
  }
  return {
    mine: gameState.score.away,
    theirs: gameState.score.home,
  };
}

export function getPhaseProgress(gameState: GameState): {
  current: number;
  total: number;
  turn: number;
  movesPerPhase: number;
} {
  return {
    current: gameState.phase,
    total: gameState.totalPhases,
    turn: gameState.turn,
    movesPerPhase: gameState.movesPerPhase,
  };
}

export function getStats(
  gameState: GameState,
  playerSide: PlayerSide
): {
  possession: number;
  tackles: number;
  shots: number;
  assists: number;
} {
  return playerSide === 'home' ? gameState.stats.home : gameState.stats.away;
}

export function getOpponentStats(
  gameState: GameState,
  playerSide: PlayerSide
): {
  possession: number;
  tackles: number;
  shots: number;
  assists: number;
} {
  return playerSide === 'home' ? gameState.stats.away : gameState.stats.home;
}

export function isPhaseComplete(gameState: GameState): boolean {
  return gameState.turn >= gameState.movesPerPhase;
}

export function isGameComplete(gameState: GameState): boolean {
  return gameState.phase > gameState.totalPhases;
}

export function getAvailableAttackerActions(
  gameState: GameState,
  playerSide: PlayerSide
): AttackerAction[] {
  const isAttacking = gameState.attackingSide === playerSide;
  if (!isAttacking) return [];
  
  const canShootNow = canShoot(gameState, playerSide);
  const actions: AttackerAction[] = ['pass', 'through_pass', 'cross', 'long_ball', 'run'];
  
  if (canShootNow) {
    actions.push('shoot');
  }
  
  return actions;
}

export function getAvailableDefenderActions(
  gameState: GameState,
  playerSide: PlayerSide
): DefenderAction[] {
  const isAttacking = gameState.attackingSide === playerSide;
  if (isAttacking) return [];
  
  return ['press', 'tackle', 'intercept', 'hold_shape', 'track_back'];
}
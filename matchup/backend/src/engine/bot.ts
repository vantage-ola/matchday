import type { Move, GameState, PlayerNumber } from '../types/index.js';
import { commitMove } from './matchup.js';
import { broadcastToSession } from '../ws/server.js';

export function getBotMove(state: GameState, botSide: PlayerNumber): Move {
  const isAttacking = state.attackingPlayer === botSide;
  const movesLeft = state.players[botSide].movesRemaining;

  if (isAttacking) {
    const inFinalThird = state.ball.position.col > 7;
    if (inFinalThird && movesLeft <= 2) {
      return 'shoot';
    }
    const rand = Math.random();
    if (rand > 0.7) return 'long_ball';
    if (rand > 0.4) return 'pass';
    if (rand > 0.2) return 'run';
    return 'sprint';
  } else {
    const rand = Math.random();
    if (rand > 0.6) return 'hold_shape';
    if (rand > 0.3) return 'tackle';
    return 'press';
  }
}

export async function scheduleBotMove(
  sessionId: string,
  botSide: PlayerNumber
): Promise<void> {
  // Randomised delay to feel human (1.5–3s)
  const delay = 1500 + Math.random() * 1500;
  await new Promise((resolve) => setTimeout(resolve, delay));

  // Re-fetch current game state to ensure we have the latest
  const { getGameState } = await import('../services/matchmaking.js');
  const currentState = await getGameState(sessionId);
  if (!currentState) return;

  // Don't commit if the game is over or already resolving
  if (currentState.phase > currentState.totalPhases) return;
  if (currentState.turnStatus === 'resolving') return;

  // Check if the bot still needs to make a move for this turn
  // If both players have committed, there's no need for another move
  const { getCommittedMove } = await import('../services/matchmaking.js');
  const p1Move = await getCommittedMove(sessionId, 'p1');
  const p2Move = await getCommittedMove(sessionId, 'p2');
  if (p1Move && p2Move) {
    // Both have committed, bot shouldn't make another move
    return;
  }

  const move = getBotMove(currentState, botSide);

  try {
    const result = await commitMove(sessionId, botSide, move);

    if (result.status === 'resolved') {
      // CRITICAL: Broadcast the resolution to all connected clients
      // The bot doesn't go through the WS handler, so we must broadcast here
      broadcastToSession(sessionId, 'TURN_RESOLVED', {
        gameState: result.gameState,
        resolution: result.resolution,
      });

      // If the game is still going, schedule the next bot move
      if (result.gameState.phase <= result.gameState.totalPhases) {
        scheduleBotMove(sessionId, botSide).catch((err) => {
          console.error('Failed to schedule next bot move:', err);
        });
      }
    }
  } catch (error) {
    // Ignore "already resolving" errors - they're expected in race conditions
    if (error instanceof Error && error.message.includes('already being resolved')) {
      return;
    }
    console.error('Bot move error:', error);
  }
}

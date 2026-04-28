import type { GameState, GameMove, GridPosition, CapSide, PlayerCap, AttackerMove, DefenderMove } from '../types/index.js';
import { commitMove } from './matchup.js';
import { broadcastToSession } from '../ws/server.js';
import { getBallCarrier, getFormationAtPosition } from './formations.js';

export function getBotMove(
  state: GameState,
  botSide: CapSide
): GameMove {
  const isAttacking = state.attackingSide === botSide;
  const formation = state.formations[botSide];

  if (isAttacking) {
    const ballCarrier = getBallCarrier(formation);
    if (!ballCarrier) {
      const fwd = formation.caps.find(c => c.role === 'fwd');
      return {
        side: 'attacker',
        fromCapId: fwd?.id ?? formation.caps[0]?.id ?? '',
        toPosition: { col: 8, row: 4 },
        action: 'pass',
      };
    }

    const targetFwd = formation.caps.find(c => 
      c.role === 'fwd' && c.id !== ballCarrier.id
    );

    if (targetFwd) {
      return {
        side: 'attacker',
        fromCapId: ballCarrier.id,
        toCapId: targetFwd.id,
        toPosition: targetFwd.position,
        action: 'pass',
      };
    }

    const attackDir = botSide === 'home' ? 1 : -1;
    const goalPos = botSide === 'home' ? { col: 14, row: 4 } : { col: 0, row: 4 };
    const distanceToGoal = Math.abs(ballCarrier.position.col - goalPos.col);

    if (distanceToGoal <= 4) {
      return {
        side: 'attacker',
        fromCapId: ballCarrier.id,
        toPosition: goalPos,
        action: 'shoot',
      };
    }

    const mid = formation.caps.find(c => c.role === 'mid');
    if (mid) {
      return {
        side: 'attacker',
        fromCapId: ballCarrier.id,
        toPosition: mid.position,
        action: 'pass',
      };
    }

    const newCol = Math.max(1, Math.min(13, ballCarrier.position.col + attackDir * 2));
    return {
      side: 'attacker',
      fromCapId: ballCarrier.id,
      toPosition: { col: newCol, row: ballCarrier.position.row },
      action: 'run',
    };
  } else {
    const ballPos = state.ball.position;
    const allCaps = formation.caps.filter(c => c.role !== 'gk');

    const closestToBall = allCaps.reduce<PlayerCap | null>((closest, cap) => {
      if (!closest) return cap;
      const distCurr = Math.abs(cap.position.col - ballPos.col) + Math.abs(cap.position.row - ballPos.row);
      const distClosest = Math.abs(closest.position.col - ballPos.col) + Math.abs(closest.position.row - ballPos.row);
      return distCurr < distClosest ? cap : closest;
    }, null);

    if (closestToBall) {
      const pressPos = { 
        col: Math.max(0, Math.min(14, closestToBall.position.col + (botSide === 'home' ? -1 : 1))), 
        row: closestToBall.position.row 
      };
      return {
        side: 'defender',
        fromCapId: closestToBall.id,
        toPosition: pressPos,
        action: 'press',
      };
    }

    const def = allCaps[0];
    if (def) {
      return {
        side: 'defender',
        fromCapId: def.id,
        toPosition: { col: def.position.col, row: def.position.row },
        action: 'hold_shape',
      };
    }

    return {
      side: 'defender',
      fromCapId: formation.caps[0]?.id ?? '',
      toPosition: { col: 8, row: 4 },
      action: 'hold_shape',
    };
  }
}

export async function scheduleBotMove(
  sessionId: string,
  botSide: CapSide
): Promise<void> {
  const delay = 1500 + Math.random() * 1500;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const { getGameState } = await import('../services/matchmaking.js');
  const currentState = await getGameState(sessionId);
  if (!currentState) return;

  if (currentState.phase > currentState.totalPhases) return;
  if (currentState.turnStatus === 'resolving') return;

  const { getCommittedMove } = await import('../services/matchmaking.js');
  const homeMove = await getCommittedMove(sessionId, 'home');
  const awayMove = await getCommittedMove(sessionId, 'away');
  if (homeMove && awayMove) {
    return;
  }

  const move = getBotMove(currentState, botSide);

  try {
    const result = await commitMove(sessionId, botSide, move);

    if (result.status === 'resolved') {
      broadcastToSession(sessionId, 'TURN_RESOLVED', {
        gameState: result.gameState,
        resolution: result.resolution,
      });

      if (result.gameState.phase <= result.gameState.totalPhases) {
        scheduleBotMove(sessionId, botSide).catch((err) => {
          console.error('Failed to schedule next bot move:', err);
        });
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('already being resolved')) {
      return;
    }
    console.error('Bot move error:', error);
  }
}
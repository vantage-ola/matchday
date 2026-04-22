import type { GameState, Move, PlayerNumber, PlayerSide } from '../types/index.js';
import { resolveTurn } from './resolution.js';
import { calculateMatchupScore, calculatePayout } from './settlement.js';
import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';
import { getGameState, updateGameState, getCommittedMove, setCommittedMove, clearCommittedMoves } from '../services/matchmaking.js';
import { broadcastToSession } from '../ws/server.js';

const PHASES = 6;
const MOVES_PER_PHASE = 5;

export function initSession(
  player1Id: string,
  player2Id: string,
  fixtureId: string,
  sessionId: string
): GameState {
  return {
    sessionId,
    phase: 1,
    totalPhases: PHASES,
    turn: 1,
    movesPerPhase: MOVES_PER_PHASE,
    attackingPlayer: 'p1',
    ball: { position: { col: 5, row: 5 }, carrier: 'p1' },
    players: {
      p1: {
        movesRemaining: MOVES_PER_PHASE,
        movesUsed: [],
        position: { col: 5, row: 5 },
        possession: true,
      },
      p2: {
        movesRemaining: MOVES_PER_PHASE,
        movesUsed: [],
        position: { col: 5, row: 4 },
        possession: false,
      },
    },
    turnStatus: 'waiting_both',
    score: { p1: 0, p2: 0 },
    stats: {
      p1: { possession: 0, tackles: 0, shots: 0, assists: 0 },
      p2: { possession: 0, tackles: 0, shots: 0, assists: 0 },
    },
    events: [],
    lastResolution: null,
  };
}

export async function commitMove(
  sessionId: string,
  player: PlayerNumber,
  move: Move
): Promise<{ status: 'waiting_opponent' | 'resolved'; gameState: GameState; resolution?: any }> {
  const state = await getGameState(sessionId);
  if (!state) {
    throw new Error('Game state not found');
  }

  // Prevent race condition: don't allow concurrent resolutions
  if (state.turnStatus === 'resolving') {
    throw new Error('Turn is already being resolved');
  }

  // Check if game is already complete
  if (state.phase > state.totalPhases) {
    throw new Error('Game is already complete');
  }

  await setCommittedMove(sessionId, player, move);

  const p1Move = await getCommittedMove(sessionId, 'p1');
  const p2Move = await getCommittedMove(sessionId, 'p2');

  if (p1Move && p2Move) {
    // Mark as resolving to prevent other commits from resolving simultaneously
    state.turnStatus = 'resolving';
    await updateGameState(sessionId, state);

    const attackerMove = state.attackingPlayer === 'p1' ? p1Move as Move : p2Move as Move;
    const defenderMove = state.attackingPlayer === 'p1' ? p2Move as Move : p1Move as Move;

    const resolution = await resolveTurn(sessionId, attackerMove, defenderMove, state);

    await clearCommittedMoves(sessionId);

    // State was already saved by resolveTurn/checkPhaseTransition/endPhase

    return { status: 'resolved', gameState: state, resolution };
  }

  // Only one player committed — update turn status
  const newStatus = player === 'p1' ? 'waiting_p2' : 'waiting_p1';
  state.turnStatus = newStatus;
  await updateGameState(sessionId, state);

  return { status: 'waiting_opponent', gameState: state };
}

export async function endPhase(sessionId: string, state: GameState): Promise<void> {
  state.phase++;

  if (state.phase > state.totalPhases) {
    await endMatchup(sessionId, state);
    return;
  }

  // Swap attacker for new phase
  state.attackingPlayer = state.attackingPlayer === 'p1' ? 'p2' : 'p1';
  state.ball.carrier = state.attackingPlayer;

  // Reset for new phase
  state.players.p1.movesRemaining = state.movesPerPhase;
  state.players.p2.movesRemaining = state.movesPerPhase;
  state.players.p1.movesUsed = [];
  state.players.p2.movesUsed = [];
  state.turn = 1;
  state.turnStatus = 'waiting_both';

  // Reset positions for new phase
  state.ball.position = { col: 5, row: 5 };
  state.players.p1.position = { col: 5, row: 5 };
  state.players.p2.position = { col: 5, row: 4 };

  await updateGameState(sessionId, state);

  // Broadcast phase transition to all connected clients
  broadcastToSession(sessionId, 'PHASE_TRANSITION', {
    newPhase: state.phase,
    attackingPlayer: state.attackingPlayer,
    state: state,
  });
}

export async function endMatchup(sessionId: string, state: GameState): Promise<void> {
  // Update session status in DB
  await prisma.matchupSession.update({
    where: { id: sessionId },
    data: {
      status: 'completed',
      ended_at: new Date(),
    },
  });

  // Calculate total possession as percentages
  const totalPossession = state.stats.p1.possession + state.stats.p2.possession;
  const p1PossPct = totalPossession > 0 ? Math.round((state.stats.p1.possession / totalPossession) * 100) : 50;
  const p2PossPct = totalPossession > 0 ? 100 - p1PossPct : 50;

  // Save matchup result
  await prisma.matchupResult.create({
    data: {
      session_id: sessionId,
      player1_goals: state.score.p1,
      player2_goals: state.score.p2,
      player1_possession: p1PossPct,
      player2_possession: p2PossPct,
      player1_tackles: state.stats.p1.tackles,
      player2_tackles: state.stats.p2.tackles,
      player1_shots: state.stats.p1.shots,
      player2_shots: state.stats.p2.shots,
      player1_assists: state.stats.p1.assists,
      player2_assists: state.stats.p2.assists,
      player_events: JSON.stringify(state.events),
    },
  });

  // Create settlement
  const session = await prisma.matchupSession.findUnique({
    where: { id: sessionId },
  });

  if (session) {
    const matchupScores = calculateMatchupScore(state.score.p1, state.score.p2);

    const settlementData = calculatePayout(
      {
        id: session.id,
        lobbyId: session.lobby_id,
        fixtureId: session.fixture_id,
        player1Id: session.player1_id,
        player2Id: session.player2_id,
        player1Side: session.player1_side as PlayerSide,
        player2Side: session.player2_side as PlayerSide,
        stakePerPlayer: session.stake_per_player,
        pot: session.pot,
        gameMode: session.game_mode as 'matchup_only' | 'real_match',
        status: 'completed',
        startedAt: session.started_at,
        endedAt: session.ended_at,
        createdAt: session.created_at,
      },
      {
        player1MatchupScore: matchupScores.p1,
        player2MatchupScore: matchupScores.p2,
      }
    );

    await prisma.settlement.create({
      data: {
        session_id: sessionId,
        player1_matchup_score: settlementData.player1MatchupScore,
        player2_matchup_score: settlementData.player2MatchupScore,
        player1_accuracy_score: settlementData.player1AccuracyScore,
        player2_accuracy_score: settlementData.player2AccuracyScore,
        player1_combined_score: settlementData.player1CombinedScore,
        player2_combined_score: settlementData.player2CombinedScore,
        player1_payout: settlementData.player1Payout,
        player2_payout: settlementData.player2Payout,
        status: 'complete',
        settled_at: new Date(),
      },
    });

    // Credit payouts to player wallets + create transaction records
    const fixture = await prisma.fixture.findUnique({ where: { id: session.fixture_id } });
    const matchLabel = fixture ? `${fixture.home_team} vs ${fixture.away_team}` : 'Matchup';
    const p1Won = state.score.p1 > state.score.p2;
    const p2Won = state.score.p2 > state.score.p1;
    const isDraw = state.score.p1 === state.score.p2;

    if (session.player1_id && (settlementData.player1Payout ?? 0) > 0) {
      const resultLabel = p1Won ? 'Won' : isDraw ? 'Draw' : 'Lost';
      await prisma.$transaction([
        prisma.user.update({
          where: { id: session.player1_id },
          data: { wallet_balance: { increment: settlementData.player1Payout ?? 0 } },
        }),
        prisma.transaction.create({
          data: {
            user_id: session.player1_id,
            type: 'credit',
            amount: settlementData.player1Payout ?? 0,
            description: `${resultLabel}: ${matchLabel}`,
            session_id: sessionId,
          },
        }),
      ]);
    }
    if (session.player2_id && (settlementData.player2Payout ?? 0) > 0) {
      const resultLabel = p2Won ? 'Won' : isDraw ? 'Draw' : 'Lost';
      await prisma.$transaction([
        prisma.user.update({
          where: { id: session.player2_id },
          data: { wallet_balance: { increment: settlementData.player2Payout ?? 0 } },
        }),
        prisma.transaction.create({
          data: {
            user_id: session.player2_id,
            type: 'credit',
            amount: settlementData.player2Payout ?? 0,
            description: `${resultLabel}: ${matchLabel}`,
            session_id: sessionId,
          },
        }),
      ]);
    }

    // Update session to settled
    await prisma.matchupSession.update({
      where: { id: sessionId },
      data: { status: 'settled' },
    });
  }

  // Broadcast game complete to all connected clients
  broadcastToSession(sessionId, 'MATCHUP_COMPLETE', {
    finalState: state,
    result: {
      p1Goals: state.score.p1,
      p2Goals: state.score.p2,
      p1Possession: p1PossPct,
      p2Possession: p2PossPct,
    },
  });

  // Clean up Redis state
  await redis.del(`matchup:${sessionId}:state`);
  await clearCommittedMoves(sessionId);
}

export function generateScoreline(
  state: GameState,
  playerSide: PlayerSide,
  session: { player1Side: PlayerSide }
): { home: number; away: number } {
  const homePlayer = session.player1Side === 'home' ? 'p1' : 'p2';

  return {
    home: homePlayer === 'p1' ? state.score.p1 : state.score.p2,
    away: homePlayer === 'p1' ? state.score.p2 : state.score.p1,
  };
}
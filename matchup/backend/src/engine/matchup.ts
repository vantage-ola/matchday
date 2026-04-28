import type { GameState, GameMove, CapSide, PlayerSide, SpatialResolution, AttackerMove, DefenderMove } from '../types/index.js';
import type { MatchLineupPlayer } from '../services/football-api.js';
import { createFormationFromLineup, getBallCarrier } from './formations.js';
import { resolveTurn } from './resolution.js';
import { calculateMatchupScore, calculatePayout } from './settlement.js';
import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';
import { getGameState, updateGameState, getCommittedMove, setCommittedMove, clearCommittedMoves } from '../services/matchmaking.js';
import { broadcastToSession } from '../ws/server.js';

const PHASES = 6;
const MOVES_PER_PHASE = 5;

const VALID_ATTACKER_ACTIONS = ['pass', 'through_pass', 'cross', 'long_ball', 'shoot', 'run'];
const VALID_DEFENDER_ACTIONS = ['press', 'tackle', 'intercept', 'hold_shape', 'track_back'];

function distanceBetween(a: { col: number; row: number }, b: { col: number; row: number }): number {
  const dx = b.col - a.col;
  const dy = b.row - a.row;
  return Math.sqrt(dx * dx + dy * dy);
}

function isInShootingRange(position: { col: number; row: number }, side: CapSide): boolean {
  // Distance to the goal this side is attacking
  const goalDistance = side === 'home' ? (14 - position.col) : position.col;
  return goalDistance <= 4;
}

function validateMove(move: GameMove, state: GameState): string | null {
  const attackerSide = state.attackingSide;
  const defenderSide = attackerSide === 'home' ? 'away' : 'home';
  
  if (move.side === 'attacker') {
    const attMove = move as AttackerMove;
    const ballCarrier = getBallCarrier(state.formations[attackerSide]);
    
    if (ballCarrier && attMove.fromCapId !== ballCarrier.id) {
      return 'Only the ball carrier can initiate an attack';
    }
    
    if (!VALID_ATTACKER_ACTIONS.includes(attMove.action)) {
      return 'Invalid attacker action';
    }
    
    if (attMove.action === 'shoot' && !isInShootingRange(ballCarrier?.position || state.ball.position, attackerSide)) {
      return 'Too far from goal to shoot';
    }
    
    if (attMove.toPosition.col < 0 || attMove.toPosition.col > 14 || attMove.toPosition.row < 0 || attMove.toPosition.row > 8) {
      return 'Target position is outside the pitch';
    }
  }
  
  if (move.side === 'defender') {
    const defMove = move as DefenderMove;
    const defenderCap = state.formations[defenderSide].caps.find(c => c.id === defMove.fromCapId);
    
    if (!defenderCap) {
      return 'Invalid defender cap';
    }
    
    if (!VALID_DEFENDER_ACTIONS.includes(defMove.action)) {
      return 'Invalid defender action';
    }
    
    if (defMove.action === 'tackle' && defMove.targetCapId) {
      const targetCap = state.formations[attackerSide].caps.find(c => c.id === defMove.targetCapId);
      if (targetCap && distanceBetween(defenderCap.position, targetCap.position) > 2) {
        return 'Too far to tackle the target';
      }
    }
  }
  
  return null;
}

export async function initSession(
  player1Id: string,
  player2Id: string,
  fixtureId: string,
  sessionId: string
): Promise<GameState> {
  const fixture = await prisma.fixture.findUnique({
    where: { id: fixtureId },
  });

  let homeLineup: MatchLineupPlayer[] = [];
  let awayLineup: MatchLineupPlayer[] = [];

  if (fixture?.external_id) {
    try {
      const { fetchMatchLineup } = await import('../services/football-api.js');
      const lineupData = await fetchMatchLineup(fixture.external_id);
      if (lineupData) {
        homeLineup = lineupData.home.lineup;
        awayLineup = lineupData.away.lineup;
      }
    } catch (e) {
      console.log('Could not fetch lineup, trying squad fallback:', e);
    }
  }

  // Fall back to squad data if lineup not available
  if (fixture && (homeLineup.length === 0 || awayLineup.length === 0)) {
    try {
      const { fetchSquadForFixture, selectStarting11 } = await import('../services/football-api.js');
      const squads = await fetchSquadForFixture(fixture.id);
      if (squads.home.length > 0 && homeLineup.length === 0) {
        homeLineup = selectStarting11(squads.home);
      }
      if (squads.away.length > 0 && awayLineup.length === 0) {
        awayLineup = selectStarting11(squads.away);
      }
    } catch (e) {
      console.log('Could not fetch squad, using fallback formation:', e);
    }
  }

  const homeFormation = createFormationFromLineup('home', homeLineup);
  const awayFormation = createFormationFromLineup('away', awayLineup);

  const homeBallCarrier = getBallCarrier(homeFormation);
  const ballCarrierCapId = homeBallCarrier?.id ?? homeFormation.caps.find(c => c.role === 'fwd')?.id ?? 'home_fwd_1';
  const ballPosition = homeBallCarrier?.position ?? { col: 7, row: 4 };

  return {
    sessionId,
    phase: 1,
    totalPhases: PHASES,
    turn: 1,
    movesPerPhase: MOVES_PER_PHASE,
    attackingSide: 'home',
    ball: { position: ballPosition, carrierCapId: ballCarrierCapId },
    formations: {
      home: homeFormation,
      away: awayFormation,
    },
    turnStatus: 'waiting_both',
    score: { home: 0, away: 0 },
    stats: {
      home: { possession: 0, tackles: 0, shots: 0, assists: 0 },
      away: { possession: 0, tackles: 0, shots: 0, assists: 0 },
    },
    events: [],
    lastResolution: null,
  };
}

export async function commitMove(
  sessionId: string,
  side: CapSide,
  move: GameMove
): Promise<{ status: 'waiting_opponent' | 'resolved'; gameState: GameState; resolution?: SpatialResolution }> {
  const state = await getGameState(sessionId);
  if (!state) {
    throw new Error('Game state not found');
  }

  if (state.turnStatus === 'resolving') {
    throw new Error('Turn is already being resolved');
  }

  if (state.phase > state.totalPhases) {
    throw new Error('Game is already complete');
  }

  const validationError = validateMove(move, state);
  if (validationError) {
    throw new Error(validationError);
  }

  const redisKey = side === 'home' ? 'home' : 'away';
  await setCommittedMove(sessionId, redisKey as 'home' | 'away', JSON.stringify(move));

  const homeMoveStr = await getCommittedMove(sessionId, 'home');
  const awayMoveStr = await getCommittedMove(sessionId, 'away');

  if (homeMoveStr && awayMoveStr) {
    state.turnStatus = 'resolving';
    await updateGameState(sessionId, state);

    const homeMove = JSON.parse(homeMoveStr) as GameMove;
    const awayMove = JSON.parse(awayMoveStr) as GameMove;

    const attackerMove = state.attackingSide === 'home' ? homeMove : awayMove;
    const defenderMove = state.attackingSide === 'home' ? awayMove : homeMove;
    const resolution = await resolveTurn(sessionId, attackerMove, defenderMove, state);

    await clearCommittedMoves(sessionId);

    return { status: 'resolved', gameState: state, resolution };
  }

  const newStatus = side === 'home' ? 'waiting_away' : 'waiting_home';
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

  state.attackingSide = state.attackingSide === 'home' ? 'away' : 'home';

  const newBallCarrier = getBallCarrier(state.formations[state.attackingSide]);
  state.ball.carrierCapId = newBallCarrier?.id ?? null;
  state.ball.position = newBallCarrier?.position ?? { col: 7, row: 4 };

  state.turn = 1;
  state.turnStatus = 'waiting_both';

  await updateGameState(sessionId, state);

  broadcastToSession(sessionId, 'PHASE_TRANSITION', {
    newPhase: state.phase,
    attackingSide: state.attackingSide,
    state: state,
  });
}

export async function endMatchup(sessionId: string, state: GameState): Promise<void> {
  await prisma.matchupSession.update({
    where: { id: sessionId },
    data: {
      status: 'completed',
      ended_at: new Date(),
    },
  });

  const session = await prisma.matchupSession.findUnique({
    where: { id: sessionId },
  });

  const p1Side = (session?.player1_side ?? 'home') as CapSide;
  const p2Side = (session?.player2_side ?? 'away') as CapSide;

  const totalPossession = state.stats.home.possession + state.stats.away.possession;
  const homePossPct = totalPossession > 0 ? Math.round((state.stats.home.possession / totalPossession) * 100) : 50;
  const awayPossPct = totalPossession > 0 ? 100 - homePossPct : 50;

  await prisma.matchupResult.create({
    data: {
      session_id: sessionId,
      player1_goals: state.score[p1Side],
      player2_goals: state.score[p2Side],
      player1_possession: p1Side === 'home' ? homePossPct : awayPossPct,
      player2_possession: p2Side === 'home' ? homePossPct : awayPossPct,
      player1_tackles: state.stats[p1Side].tackles,
      player2_tackles: state.stats[p2Side].tackles,
      player1_shots: state.stats[p1Side].shots,
      player2_shots: state.stats[p2Side].shots,
      player1_assists: state.stats[p1Side].assists,
      player2_assists: state.stats[p2Side].assists,
      player_events: JSON.stringify(state.events),
    },
  });

  if (session) {
    const matchupScores = calculateMatchupScore(state.score.home, state.score.away);

    const settlementData = calculatePayout(
      {
        id: session.id,
        lobbyId: session.lobby_id,
        fixtureId: session.fixture_id,
        player1Id: session.player1_id,
        player2Id: session.player2_id,
        player1Side: p1Side as PlayerSide,
        player2Side: p2Side as PlayerSide,
        stakePerPlayer: session.stake_per_player,
        pot: session.pot,
        gameMode: session.game_mode as 'matchup_only' | 'real_match',
        status: 'completed',
        startedAt: session.started_at,
        endedAt: session.ended_at,
        createdAt: session.created_at,
      },
      {
        player1MatchupScore: p1Side === 'home' ? matchupScores.home : matchupScores.away,
        player2MatchupScore: p2Side === 'home' ? matchupScores.home : matchupScores.away,
      }
    );

    const existingSettlement = await prisma.settlement.findUnique({
      where: { session_id: sessionId },
    });

    if (!existingSettlement) {
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
    }

    const fixture = await prisma.fixture.findUnique({ where: { id: session.fixture_id } });
    const matchLabel = fixture ? `${fixture.home_team} vs ${fixture.away_team}` : 'Matchup';
    const p1Goals = state.score[p1Side];
    const p2Goals = state.score[p2Side];
    const p1Won = p1Goals > p2Goals;
    const p2Won = p2Goals > p1Goals;
    const isDraw = p1Goals === p2Goals;

    const player1Payout = settlementData.player1Payout;
    const player2Payout = settlementData.player2Payout;
    const p1ResultLabel = p1Won ? 'Won' : isDraw ? 'Draw' : 'Lost';
    const p2ResultLabel = p2Won ? 'Won' : isDraw ? 'Draw' : 'Lost';

    if (session.player1_id && (player1Payout ?? 0) > 0) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: session.player1_id },
          data: { wallet_balance: { increment: player1Payout ?? 0 } },
        }),
        prisma.transaction.create({
          data: {
            user_id: session.player1_id,
            type: 'credit',
            amount: player1Payout ?? 0,
            description: `${p1ResultLabel}: ${matchLabel}`,
            session_id: sessionId,
          },
        }),
      ]);
    }
    if (session.player2_id && (player2Payout ?? 0) > 0) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: session.player2_id },
          data: { wallet_balance: { increment: player2Payout ?? 0 } },
        }),
        prisma.transaction.create({
          data: {
            user_id: session.player2_id,
            type: 'credit',
            amount: player2Payout ?? 0,
            description: `${p2ResultLabel}: ${matchLabel}`,
            session_id: sessionId,
          },
        }),
      ]);
    }

    await prisma.matchupSession.update({
      where: { id: sessionId },
      data: { status: 'settled' },
    });
  }

  broadcastToSession(sessionId, 'MATCHUP_COMPLETE', {
    finalState: state,
    result: {
      homeGoals: state.score.home,
      awayGoals: state.score.away,
      homePossession: homePossPct,
      awayPossession: awayPossPct,
    },
  });

  await redis.del(`matchup:${sessionId}:state`);
  await clearCommittedMoves(sessionId);
}

export function generateScoreline(
  state: GameState,
  playerSide: PlayerSide,
  session: { player1Side: PlayerSide }
): { home: number; away: number } {
  return {
    home: state.score.home,
    away: state.score.away,
  };
}
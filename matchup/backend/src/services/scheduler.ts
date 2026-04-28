import { prisma } from '../db/prisma.js';
import { fetchRealResult } from './football-api.js';
import { calculateMatchupScore, calculateAccuracyScore } from '../engine/settlement.js';

const LOBBY_OPEN_MINUTES_BEFORE = 30;
const LOBBY_CLOSE_MINUTES_BEFORE = 5;

export async function openLobbies(): Promise<void> {
  const now = new Date();
  const windowStart = now;
  const windowEnd = new Date(now.getTime() + LOBBY_OPEN_MINUTES_BEFORE * 60 * 1000);

  const fixturesToOpen = await prisma.fixture.findMany({
    where: {
      kickoff_at: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    include: {
      lobbies: {
        where: {
          status: 'open',
        },
      },
    },
  });

  for (const fixture of fixturesToOpen) {
    if (fixture.lobbies.length === 0) {
      await prisma.lobby.create({
        data: {
          fixture_id: fixture.id,
          opens_at: now,
          closes_at: fixture.kickoff_at,
          status: 'open',
        },
      });
      console.log(`Opened lobby for fixture ${fixture.id}`);
    }
  }
}

export async function closeLobbies(): Promise<void> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + LOBBY_CLOSE_MINUTES_BEFORE * 60 * 1000);

  const lobbiesToClose = await prisma.lobby.findMany({
    where: {
      status: 'open',
      closes_at: {
        lte: cutoff,
      },
    },
  });

  for (const lobby of lobbiesToClose) {
    await prisma.lobby.update({
      where: { id: lobby.id },
      data: { status: 'closed' },
    });
    console.log(`Closed lobby ${lobby.id}`);
  }
}

export async function fetchResults(): Promise<void> {
  const finishedFixtures = await prisma.fixture.findMany({
    where: {
      status: 'finished',
      real_home_goals: null,
    },
  });

  for (const fixture of finishedFixtures) {
    if (!fixture.external_id) continue;

    try {
      const result = await fetchRealResult(fixture.external_id);

      await prisma.fixture.update({
        where: { id: fixture.id },
        data: {
          real_home_goals: result.homeGoals,
          real_away_goals: result.awayGoals,
        },
      });
      console.log(`Updated result for fixture ${fixture.id}: ${result.homeGoals}-${result.awayGoals}`);
    } catch (error) {
      console.error(`Failed to fetch result for fixture ${fixture.id}:`, error);
    }
  }
}

export async function runSettlements(): Promise<void> {
  const completedSessions = await prisma.matchupSession.findMany({
    where: {
      status: 'completed',
    },
    include: {
      fixture: true,
      result: true,
    },
  });

  for (const session of completedSessions) {
    const existingSettlement = await prisma.settlement.findUnique({
      where: { session_id: session.id },
    });
    if (existingSettlement) continue;

    if (session.fixture.real_home_goals === null || session.fixture.real_away_goals === null) {
      continue;
    }

    const homeGoals = session.fixture.real_home_goals ?? 0;
    const awayGoals = session.fixture.real_away_goals ?? 0;
    const matchupScores = calculateMatchupScore(
      session.result?.player1_goals ?? 0,
      session.result?.player2_goals ?? 0
    );

    const homeSide = session.player1_side;
    const awaySide = session.player2_side;

    const player1MatchupScore = homeSide === 'home' ? matchupScores.home : matchupScores.away;
    const player2MatchupScore = awaySide === 'home' ? matchupScores.home : matchupScores.away;

    const actualResult = {
      home: homeGoals,
      away: awayGoals,
    };

    const predictedHome = homeSide === 'home'
      ? session.result?.player1_goals ?? 0
      : session.result?.player2_goals ?? 0;
    const predictedAway = awaySide === 'home'
      ? session.result?.player1_goals ?? 0
      : session.result?.player2_goals ?? 0;

    const predicted = {
      home: predictedHome,
      away: predictedAway,
    };

    const p1AccuracyScore = calculateAccuracyScore(predicted, actualResult, 0.5);
    const p2AccuracyScore = calculateAccuracyScore(predicted, actualResult, 0.5);

    const isRealMatchMode = session.game_mode === 'real_match';
    const p1Combined = isRealMatchMode 
      ? player1MatchupScore * 0.6 + p1AccuracyScore * 0.4 
      : player1MatchupScore;
    const p2Combined = isRealMatchMode 
      ? player2MatchupScore * 0.6 + p2AccuracyScore * 0.4 
      : player2MatchupScore;
    const totalCombined = p1Combined + p2Combined;
    const pot = session.pot * 0.9;
    const p1Payout = totalCombined > 0 ? Math.round((p1Combined / totalCombined) * pot) : 0;
    const p2Payout = totalCombined > 0 ? Math.round((p2Combined / totalCombined) * pot) : 0;

    await prisma.settlement.create({
      data: {
        session_id: session.id,
        player1_matchup_score: player1MatchupScore,
        player2_matchup_score: player2MatchupScore,
        player1_accuracy_score: isRealMatchMode ? p1AccuracyScore : 0,
        player2_accuracy_score: isRealMatchMode ? p2AccuracyScore : 0,
        player1_combined_score: Math.round(p1Combined),
        player2_combined_score: Math.round(p2Combined),
        player1_payout: p1Payout,
        player2_payout: p2Payout,
        status: 'complete',
        settled_at: new Date(),
      },
    });

    await prisma.matchupSession.update({
      where: { id: session.id },
      data: { status: 'settled' },
    });

    if (session.player1_id && p1Payout > 0) {
      await prisma.user.update({
        where: { id: session.player1_id },
        data: {
          wallet_balance: {
            increment: p1Payout,
          },
        },
      });
    }

    if (session.player2_id && p2Payout > 0) {
      await prisma.user.update({
        where: { id: session.player2_id },
        data: {
          wallet_balance: {
            increment: p2Payout,
          },
        },
      });
    }

    console.log(`Settled session ${session.id}: P1 gets ${p1Payout}, P2 gets ${p2Payout}`);
  }
}

export function startScheduler(): void {
  const run = async () => {
    try {
      console.log('Running scheduler...');
      await openLobbies();
      await closeLobbies();
      await fetchResults();
      await runSettlements();
      console.log('Scheduler run complete');
    } catch (err) {
      console.error('Scheduler error:', err);
    }
  };

  run();
  setInterval(run, 5 * 60 * 1000);
}

export function stopScheduler(): void {
  // Implementation for stopping scheduler if needed
}
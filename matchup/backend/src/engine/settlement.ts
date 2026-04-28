import type { MatchupSession, Settlement, PlayerSide } from '../types/index.js';

const LAYER1_WEIGHT = 0.6;
const LAYER2_WEIGHT = 0.4;
const PLATFORM_FEE = 0.1;

export function calculateMatchupScore(
  homeGoals: number,
  awayGoals: number
): { home: number; away: number } {
  const total = homeGoals + awayGoals;
  if (total === 0) {
    return { home: 50, away: 50 };
  }
  return {
    home: Math.round((homeGoals / total) * 100),
    away: Math.round((awayGoals / total) * 100),
  };
}

export function calculateAccuracyScore(
  predicted: { home: number; away: number },
  actual: { home: number; away: number },
  preMatchProbability: number
): number {
  let score = 0;

  const predictedWinner =
    predicted.home > predicted.away
      ? 'home'
      : predicted.away > predicted.home
        ? 'away'
        : 'draw';
  const actualWinner =
    actual.home > actual.away
      ? 'home'
      : actual.away > actual.home
        ? 'away'
        : 'draw';
  if (predictedWinner === actualWinner) {
    score += 40;
  }

  const predictedDiff = Math.abs(predicted.home - predicted.away);
  const actualDiff = Math.abs(actual.home - actual.away);
  if (predictedDiff === actualDiff) {
    score += 30;
  } else {
    score += Math.max(0, 20 - Math.abs(predictedDiff - actualDiff) * 5);
  }

  if (predicted.home === actual.home && predicted.away === actual.away) {
    score += 30;
  }

  const improbabilityFactor = Math.max(0, 1 - preMatchProbability * 5);
  const adjustedScore = score + (100 - score) * improbabilityFactor * 0.4;

  return Math.min(100, Math.round(adjustedScore));
}

export function calculatePayout(
  session: MatchupSession,
  settlement: Partial<Settlement>
): Settlement {
  const matchupScores = settlement as {
    player1MatchupScore: number;
    player2MatchupScore: number;
  };
  const p1Matchup = matchupScores.player1MatchupScore ?? 50;
  const p2Matchup = matchupScores.player2MatchupScore ?? 50;

  const accuracyScores = settlement as {
    player1AccuracyScore?: number;
    player2AccuracyScore?: number;
  };
  const p1Accuracy = accuracyScores.player1AccuracyScore ?? 50;
  const p2Accuracy = accuracyScores.player2AccuracyScore ?? 50;

  const isRealMatchMode = session.gameMode === 'real_match';
  const w1 = isRealMatchMode ? LAYER1_WEIGHT : 1.0;
  const w2 = isRealMatchMode ? LAYER2_WEIGHT : 0.0;

  const p1Combined = p1Matchup * w1 + p1Accuracy * w2;
  const p2Combined = p2Matchup * w1 + p2Accuracy * w2;
  const total = p1Combined + p2Combined;

  const pot = session.pot * (1 - PLATFORM_FEE);

  return {
    id: settlement.id ?? '',
    sessionId: session.id,
    player1MatchupScore: p1Matchup,
    player2MatchupScore: p2Matchup,
    player1AccuracyScore: isRealMatchMode ? p1Accuracy : null,
    player2AccuracyScore: isRealMatchMode ? p2Accuracy : null,
    player1CombinedScore: Math.round(p1Combined),
    player2CombinedScore: Math.round(p2Combined),
    player1Payout: Math.round((p1Combined / total) * pot),
    player2Payout: Math.round((p2Combined / total) * pot),
    status: 'pending',
    settledAt: null,
    createdAt: settlement.createdAt ?? new Date(),
  };
}
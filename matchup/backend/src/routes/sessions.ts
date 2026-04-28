import { Router, type Request, type Response } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { getGameState } from '../services/matchmaking.js';
import { parseTeamColors } from '../services/football-api.js';

const router = Router();

router.get('/user/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const sessions = await prisma.matchupSession.findMany({
      where: {
        OR: [
          { player1_id: userId },
          { player2_id: userId },
        ],
        status: { in: ['completed', 'settled'] },
      },
      orderBy: { created_at: 'desc' },
      take: 20,
      include: {
        fixture: true,
        result: true,
        settlement: true,
        player1: { select: { id: true, display_name: true, is_bot: true } },
        player2: { select: { id: true, display_name: true, is_bot: true } },
      },
    });

    const history = sessions.map((s) => {
      const isP1 = s.player1_id === userId;
      const opponent = isP1 ? s.player2 : s.player1;
      const yourGoals = isP1 ? s.result?.player1_goals : s.result?.player2_goals;
      const oppGoals = isP1 ? s.result?.player2_goals : s.result?.player1_goals;
      const yourPayout = isP1 ? s.settlement?.player1_payout : s.settlement?.player2_payout;
      const stake = s.stake_per_player;

      let resultTag: 'W' | 'L' | 'D' = 'D';
      if (yourGoals !== undefined && oppGoals !== undefined) {
        if (yourGoals > oppGoals) resultTag = 'W';
        else if (yourGoals < oppGoals) resultTag = 'L';
      }

      return {
        id: s.id,
        fixtureId: s.fixture_id,
        homeTeam: s.fixture.home_team,
        awayTeam: s.fixture.away_team,
        yourSide: isP1 ? s.player1_side : s.player2_side,
        opponent: opponent ? {
          displayName: opponent.display_name,
          isBot: opponent.is_bot,
        } : { displayName: 'Bot', isBot: true },
        yourGoals: yourGoals ?? 0,
        oppGoals: oppGoals ?? 0,
        resultTag,
        stake,
        payout: yourPayout ?? 0,
        netProfit: (yourPayout ?? 0) - stake,
        playedAt: s.created_at.toISOString(),
      };
    });

    res.json({ history });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch match history' });
  }
});

router.get('/:id', requireAuth, async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id: sessionId } = req.params;
    const userId = req.user!.userId;

    const session = await prisma.matchupSession.findUnique({
      where: { id: sessionId },
      include: {
        fixture: true,
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.player1_id !== userId && session.player2_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const gameState = await getGameState(sessionId);
    const isPlayer1 = session.player1_id === userId;
    const playerSide = isPlayer1 ? session.player1_side : session.player2_side;
    const homeColors = parseTeamColors(session.fixture.home_team);
    const awayColors = parseTeamColors(session.fixture.away_team);

    res.json({
      session: {
        id: session.id,
        fixtureId: session.fixture_id,
        player1Id: session.player1_id,
        player2Id: session.player2_id,
        player1Side: session.player1_side,
        player2Side: session.player2_side,
        stakePerPlayer: session.stake_per_player,
        pot: session.pot,
        gameMode: session.game_mode,
        status: session.status,
        startedAt: session.started_at?.toISOString(),
        endedAt: session.ended_at?.toISOString(),
        homeTeam: session.fixture.home_team,
        awayTeam: session.fixture.away_team,
        homeTeamLogo: session.fixture.home_team_logo,
        awayTeamLogo: session.fixture.away_team_logo,
        homeTeamAbbr: session.fixture.home_team.slice(0, 3).toUpperCase(),
        awayTeamAbbr: session.fixture.away_team.slice(0, 3).toUpperCase(),
        homeTeamColors: homeColors,
        awayTeamColors: awayColors,
        league: session.fixture.league,
      },
      gameState,
      playerSide,
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

router.get('/:id/result', requireAuth, async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id: sessionId } = req.params;
    const userId = req.user!.userId;

    const session = await prisma.matchupSession.findUnique({
      where: { id: sessionId },
      include: {
        result: true,
        settlement: true,
        fixture: true,
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.player1_id !== userId && session.player2_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!session.result) {
      return res.status(404).json({ error: 'Result not available' });
    }

    const isPlayer1 = session.player1_id === userId;

    res.json({
      result: {
        player1Goals: session.result.player1_goals,
        player2Goals: session.result.player2_goals,
        player1Possession: session.result.player1_possession,
        player2Possession: session.result.player2_possession,
        player1Tackles: session.result.player1_tackles,
        player2Tackles: session.result.player2_tackles,
        player1Shots: session.result.player1_shots,
        player2Shots: session.result.player2_shots,
        player1Assists: session.result.player1_assists,
        player2Assists: session.result.player2_assists,
        playerEvents: session.result.player_events,
      },
      settlement: session.settlement ? {
        player1MatchupScore: Number(session.settlement.player1_matchup_score),
        player2MatchupScore: Number(session.settlement.player2_matchup_score),
        player1CombinedScore: Number(session.settlement.player1_combined_score),
        player2CombinedScore: Number(session.settlement.player2_combined_score),
        player1Payout: session.settlement.player1_payout,
        player2Payout: session.settlement.player2_payout,
        status: session.settlement.status,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching result:', error);
    res.status(500).json({ error: 'Failed to fetch result' });
  }
});

export default router;
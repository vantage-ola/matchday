import { Router, type Request, type Response } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/:sessionId', requireAuth, async (req: Request<{ sessionId: string }>, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user!.userId;

    const session = await prisma.matchupSession.findUnique({
      where: { id: sessionId },
      include: {
        fixture: true,
        result: true,
        settlement: true,
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.player1_id !== userId && session.player2_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const isPlayer1 = session.player1_id === userId;
    const playerSide = isPlayer1 ? session.player1_side : session.player2_side;
    const opponentSide = isPlayer1 ? session.player2_side : session.player1_side;

    const homeTeam = session.fixture.home_team;
    const awayTeam = session.fixture.away_team;

    let playerGoals = 0;
    let opponentGoals = 0;
    let playerScore = 0;
    let opponentScore = 0;

    if (session.result) {
      if (isPlayer1) {
        playerGoals = session.result.player1_goals;
        opponentGoals = session.result.player2_goals;
      } else {
        playerGoals = session.result.player2_goals;
        opponentGoals = session.result.player1_goals;
      }
    }

    if (session.settlement) {
      if (isPlayer1) {
        playerScore = Number(session.settlement.player1_combined_score ?? 0);
        opponentScore = Number(session.settlement.player2_combined_score ?? 0);
      } else {
        playerScore = Number(session.settlement.player2_combined_score ?? 0);
        opponentScore = Number(session.settlement.player1_combined_score ?? 0);
      }
    }

    const homeGoals = playerSide === 'home' ? playerGoals : opponentGoals;
    const awayGoals = playerSide === 'away' ? playerGoals : opponentGoals;

    res.json({
      settlement: {
        sessionId: session.id,
        status: session.settlement?.status ?? 'pending',
        homeTeam,
        awayTeam,
        homeGoals,
        awayGoals,
        playerSide,
        playerScore,
        opponentScore,
        payout: isPlayer1 
          ? session.settlement?.player1_payout ?? 0 
          : session.settlement?.player2_payout ?? 0,
        settledAt: session.settlement?.settled_at?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error('Error fetching settlement:', error);
    res.status(500).json({ error: 'Failed to fetch settlement' });
  }
});

export default router;
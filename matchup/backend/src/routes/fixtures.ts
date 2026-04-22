import { Router, type Request, type Response } from 'express';
import { prisma } from '../db/prisma.js';
import { joinQueue, getQueueStatus, createBotSession } from '../services/matchmaking.js';
import { requireAuth } from '../middleware/auth.js';
import { fetchUpcomingMatches, parseTeamColors } from '../services/football-api.js';

const router = Router();

interface JoinBody {
  side: 'home' | 'away';
  stake: number;
  gameMode: 'matchup_only' | 'real_match';
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const fixtures = await prisma.fixture.findMany({
      where: {
        kickoff_at: {
          gte: new Date(),
        },
      },
      orderBy: {
        kickoff_at: 'asc',
      },
      take: 20,
    });

    res.json({
      fixtures: fixtures.map((f) => ({
        id: f.id,
        homeTeam: f.home_team,
        awayTeam: f.away_team,
        homeTeamLogo: f.home_team_logo,
        awayTeamLogo: f.away_team_logo,
        homeTeamAbbr: f.home_team.slice(0, 3).toUpperCase(),
        awayTeamAbbr: f.away_team.slice(0, 3).toUpperCase(),
        homeTeamColors: parseTeamColors(f.home_team),
        awayTeamColors: parseTeamColors(f.away_team),
        league: f.league,
        kickoffAt: f.kickoff_at.toISOString(),
        status: f.status,
        homeScore: f.real_home_goals,
        awayScore: f.real_away_goals,
        venue: f.league,
      })),
    });
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    res.status(500).json({ error: 'Failed to fetch fixtures' });
  }
});

router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;

    const fixture = await prisma.fixture.findUnique({
      where: { id },
    });

    if (!fixture) {
      return res.status(404).json({ error: 'Fixture not found' });
    }

    res.json({
      fixture: {
        id: fixture.id,
        homeTeam: fixture.home_team,
        awayTeam: fixture.away_team,
        homeTeamLogo: fixture.home_team_logo,
        awayTeamLogo: fixture.away_team_logo,
        homeTeamAbbr: fixture.home_team.slice(0, 3).toUpperCase(),
        awayTeamAbbr: fixture.away_team.slice(0, 3).toUpperCase(),
        homeTeamColors: parseTeamColors(fixture.home_team),
        awayTeamColors: parseTeamColors(fixture.away_team),
        league: fixture.league,
        kickoffAt: fixture.kickoff_at.toISOString(),
        status: fixture.status,
        homeScore: fixture.real_home_goals,
        awayScore: fixture.real_away_goals,
        venue: fixture.league,
      },
    });
  } catch (error) {
    console.error('Error fetching fixture:', error);
    res.status(500).json({ error: 'Failed to fetch fixture' });
  }
});

router.get('/:id/lobby', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;

    const fixture = await prisma.fixture.findUnique({
      where: { id },
    });

    if (!fixture) {
      return res.status(404).json({ error: 'Fixture not found' });
    }

    const queueStatus = await getQueueStatus(id);

    res.json({
      status: fixture.status === 'scheduled' ? 'open' : 'closed',
      homeCount: queueStatus.homeCount,
      awayCount: queueStatus.awayCount,
    });
  } catch (error) {
    console.error('Error fetching lobby:', error);
    res.status(500).json({ error: 'Failed to fetch lobby' });
  }
});

router.post('/:id/join', requireAuth, async (req: Request<{ id: string }, {}, JoinBody>, res: Response) => {
  try {
    const { id: fixtureId } = req.params;
    const { side, stake, gameMode } = req.body;
    const userId = req.user!.userId;

    const fixture = await prisma.fixture.findUnique({
      where: { id: fixtureId },
    });

    if (!fixture) {
      return res.status(404).json({ error: 'Fixture not found' });
    }

    if (fixture.status !== 'scheduled') {
      return res.status(400).json({ error: 'Fixture lobby is closed' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.wallet_balance < stake) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const result = await joinQueue(userId, fixtureId, side, stake, gameMode);

    if (result.session) {
      const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId } });
      const matchLabel = fixture ? `${fixture.home_team} vs ${fixture.away_team}` : 'Matchup';

      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { wallet_balance: { decrement: stake } },
        }),
        prisma.transaction.create({
          data: {
            user_id: userId,
            type: 'debit',
            amount: stake,
            description: `Stake: ${matchLabel}`,
            session_id: result.session.id,
          },
        }),
      ]);

      const opponentId = result.session.player1Id === userId 
        ? result.session.player2Id 
        : result.session.player1Id;

      if (opponentId) {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: opponentId },
            data: { wallet_balance: { decrement: stake } },
          }),
          prisma.transaction.create({
            data: {
              user_id: opponentId,
              type: 'debit',
              amount: stake,
              description: `Stake: ${matchLabel}`,
              session_id: result.session.id,
            },
          }),
        ]);
      }

      res.json({
        sessionId: result.session.id,
        status: result.session.status,
      });
    } else {
      res.json({
        position: result.position,
        status: 'waiting',
      });
    }
  } catch (error) {
    console.error('Error joining fixture:', error);
    res.status(500).json({ error: 'Failed to join fixture' });
  }
});

// Bot session fallback — called when no opponent is found after timeout
router.post('/:id/bot', requireAuth, async (req: Request<{ id: string }, {}, JoinBody>, res: Response) => {
  try {
    const { id: fixtureId } = req.params;
    const { side, stake, gameMode } = req.body;
    const userId = req.user!.userId;

    const fixture = await prisma.fixture.findUnique({
      where: { id: fixtureId },
    });

    if (!fixture) {
      return res.status(404).json({ error: 'Fixture not found' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.wallet_balance < stake) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Deduct stake from player + create transaction
    const matchLabel = `${fixture.home_team} vs ${fixture.away_team}`;
    const session = await createBotSession(userId, fixtureId, side, stake, gameMode);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { wallet_balance: { decrement: stake } },
      }),
      prisma.transaction.create({
        data: {
          user_id: userId,
          type: 'debit',
          amount: stake,
          description: `Stake: ${matchLabel}`,
          session_id: session.id,
        },
      }),
    ]);

    res.json({
      sessionId: session.id,
      status: session.status,
    });
  } catch (error) {
    console.error('Error creating bot session:', error);
    res.status(500).json({ error: 'Failed to create bot match' });
  }
});

router.post('/seed', async (req: Request, res: Response) => {
  try {
    const competition = (req.query.competition as string) || 'PL';
    const fixtures = await fetchUpcomingMatches(competition, 7);

    let seeded = 0;

    for (const fixture of fixtures) {
      const existing = await prisma.fixture.findFirst({
        where: { external_id: fixture.externalId },
      });

      if (!existing) {
        await prisma.fixture.create({
          data: {
            id: fixture.id,
            external_id: fixture.externalId,
            home_team: fixture.homeTeam,
            away_team: fixture.awayTeam,
            home_team_logo: fixture.homeTeamLogo,
            away_team_logo: fixture.awayTeamLogo,
            league: fixture.league,
            kickoff_at: fixture.kickoffAt,
            status: fixture.status,
            real_home_goals: fixture.realHomeGoals,
            real_away_goals: fixture.realAwayGoals,
          },
        });
        seeded++;
      }
    }

    res.json({
      message: `Seeded ${seeded} fixtures from ${competition}`,
      total: fixtures.length,
    });
  } catch (error) {
    console.error('Error seeding fixtures:', error);
    res.status(500).json({ error: 'Failed to seed fixtures' });
  }
});

export default router;

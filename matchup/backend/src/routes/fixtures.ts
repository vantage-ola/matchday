import { Router, type Request, type Response } from 'express';

const router = Router();

interface JoinBody {
  side: 'home' | 'away';
  stake: number;
  gameMode: 'matchup_only' | 'real_match';
}

router.get('/', async (req: Request, res: Response) => {
  // TODO: Fetch upcoming fixtures (next 48h)
  // TODO: Return list of fixtures

  res.status(501).json({ error: 'Not implemented' });
});

router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;

  // TODO: Fetch fixture by ID
  // TODO: Return fixture details

  res.status(501).json({ error: 'Not implemented' });
});

router.get('/:id/lobby', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;

  // TODO: Fetch lobby for fixture
  // TODO: Return lobby status + player count per side

  res.status(501).json({ error: 'Not implemented' });
});

router.post('/:id/join', async (req: Request<{ id: string }, {}, JoinBody>, res: Response) => {
  const { id: fixtureId } = req.params;
  const { side, stake, gameMode } = req.body;

  // TODO: Validate fixture exists and lobby is open
  // TODO: Check user balance
  // TODO: Add user to matchmaking queue
  // TODO: Return queue position or created session

  res.status(501).json({ error: 'Not implemented' });
});

export default router;
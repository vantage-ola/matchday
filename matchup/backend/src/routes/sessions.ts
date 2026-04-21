import { Router, type Request, type Response } from 'express';

const router = Router();

interface CommitMoveBody {
  move: string;
}

router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;

  // TODO: Fetch session by ID
  // TODO: Fetch current game state from Redis
  // TODO: Return session + game state

  res.status(501).json({ error: 'Not implemented' });
});

router.post('/:id/move', async (req: Request<{ id: string }, {}, CommitMoveBody>, res: Response) => {
  const { id: sessionId } = req.params;
  const { move } = req.body;

  // TODO: Validate move is valid Move type
  // TODO: Check player is part of session
  // TODO: Commit move to Redis via engine.commitMove()
  // TODO: Emit WebSocket event

  res.status(501).json({ error: 'Not implemented' });
});

router.get('/:id/result', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;

  // TODO: Fetch matchup result
  // TODO: Return result (after session ends)

  res.status(501).json({ error: 'Not implemented' });
});

export default router;
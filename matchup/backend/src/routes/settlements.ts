import { Router, type Request, type Response } from 'express';

const router = Router();

router.get('/:sessionId', async (req: Request<{ sessionId: string }>, res: Response) => {
  const { sessionId } = req.params;

  // TODO: Fetch settlement by session ID
  // TODO: Return settlement details + payout breakdown

  res.status(501).json({ error: 'Not implemented' });
});

export default router;
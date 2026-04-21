import { Router, type Request, type Response } from 'express';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  // TODO: Extract user from JWT
  // TODO: Fetch wallet balance + transaction history

  res.status(501).json({ error: 'Not implemented' });
});

router.post('/claim-daily', async (req: Request, res: Response) => {
  // TODO: Check if user claimed today (24h cooldown)
  // TODO: Add daily amount to balance
  // TODO: Record transaction

  res.status(501).json({ error: 'Not implemented' });
});

export default router;
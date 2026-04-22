import { Router, type Request, type Response } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const DAILY_AMOUNT = 200;
const CLAIM_COOLDOWN_HOURS = 24;

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch real transactions from the ledger
    const transactions = await prisma.transaction.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 50,
      select: {
        id: true,
        type: true,
        amount: true,
        description: true,
        created_at: true,
      },
    });

    res.json({
      balance: user.wallet_balance,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        createdAt: tx.created_at.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

router.post('/claim-daily', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user already claimed today
    const lastClaim = await prisma.transaction.findFirst({
      where: {
        user_id: userId,
        description: 'Daily reward',
      },
      orderBy: { created_at: 'desc' },
    });

    if (lastClaim) {
      const hoursSince = (Date.now() - lastClaim.created_at.getTime()) / (1000 * 60 * 60);
      if (hoursSince < CLAIM_COOLDOWN_HOURS) {
        return res.status(400).json({
          error: 'Daily claim not available yet',
          hoursRemaining: Math.ceil(CLAIM_COOLDOWN_HOURS - hoursSince),
        });
      }
    }

    const newBalance = user.wallet_balance + DAILY_AMOUNT;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { wallet_balance: newBalance },
      }),
      prisma.transaction.create({
        data: {
          user_id: userId,
          type: 'credit',
          amount: DAILY_AMOUNT,
          description: 'Daily reward',
        },
      }),
    ]);

    res.json({
      balance: newBalance,
      claimedAmount: DAILY_AMOUNT,
    });
  } catch (error) {
    console.error('Error claiming daily:', error);
    res.status(500).json({ error: 'Failed to claim daily reward' });
  }
});

export default router;

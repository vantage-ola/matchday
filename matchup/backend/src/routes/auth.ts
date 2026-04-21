import { Router, type Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { requireAuth } from '../middleware/auth'

const router = Router()

const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string().min(6),
  displayName: z.string().min(1).max(50)
})

const loginSchema = z.object({
  username: z.string(),
  password: z.string()
})

function generateToken(user: { id: string; username: string }): string {
  return jwt.sign(
    { userId: user.id, username: user.username },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  )
}

router.post('/register', async (req, res: Response) => {
  const parseResult = registerSchema.safeParse(req.body)
  
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.issues[0]?.message ?? 'Validation failed' })
  }

  const { username, password, displayName } = parseResult.data

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      username,
      password_hash: passwordHash,
      display_name: displayName,
      wallet_balance: 1000
    }
  })

  const token = generateToken(user)

  res.status(201).json({
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      walletBalance: user.wallet_balance
    }
  })
})

router.post('/login', async (req, res: Response) => {
  const parseResult = loginSchema.safeParse(req.body)
  
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request body' })
  }

  const { username, password } = parseResult.data

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = generateToken(user)

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      walletBalance: user.wallet_balance
    }
  })
})

router.get('/me', requireAuth, async (req, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId }
  })

  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  res.json({
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    walletBalance: user.wallet_balance,
    createdAt: user.created_at
  })
})

export default router

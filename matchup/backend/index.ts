import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import authRoutes from './src/routes/auth'
import fixtureRoutes from './src/routes/fixtures'
import sessionRoutes from './src/routes/sessions'
import settlementRoutes from './src/routes/settlements'
import walletRoutes from './src/routes/wallet'
import { createWSServer } from './src/ws/server.js'
import { startScheduler } from './src/services/scheduler.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
}))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api/fixtures', fixtureRoutes)
app.use('/api/sessions', sessionRoutes)
app.use('/api/settlements', settlementRoutes)
app.use('/api/wallet', walletRoutes)

const server = createServer(app)

createWSServer(server)

startScheduler()

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

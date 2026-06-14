import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.routes'
import profileRoutes from './routes/profile.routes'
import walletRoutes from './routes/wallet.routes'
import sendMoneyRoutes from './routes/send-money.routes'
import { authenticateToken } from './middleware/auth'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}))
app.use(morgan('dev'))
app.use(express.json())

// Routes
app.use('/auth', authRoutes)
app.use('/profile', profileRoutes)
app.use('/wallet', walletRoutes)
app.use('/api/send-money', authenticateToken, sendMoneyRoutes)

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'NovaPay Authentication Service' })
})

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error occurred' })
})

app.listen(PORT, () => {
  console.log(`NovaPay auth server is running on port ${PORT}`)
})

import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import dotenv from 'dotenv'
import profileRoutes from './routes/profile.routes'
import sendMoneyRoutes from './routes/send-money.routes'
import notificationRoutes from './routes/notification.routes'
import paymentRequestRoutes from './routes/payment-request.routes'
import paymentMethodRoutes from './routes/payment-method.routes'
import paymentLinkRoutes from './routes/payment-link.routes'

import escrowRoutes from './routes/escrow.routes'
import recurringRoutes from './routes/recurring.routes'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    callback(null, true)
  },
  credentials: true
}))
app.use(morgan('dev'))
app.use(express.json())

// Routes
app.use('/profile', profileRoutes)
app.use('/api/send-money', sendMoneyRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/payment-requests', paymentRequestRoutes)
app.use('/api/payment-methods', paymentMethodRoutes)
app.use('/api/payment-links', paymentLinkRoutes)
app.use('/api/escrow', escrowRoutes)
app.use('/api/recurring', recurringRoutes)

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

import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { serverConfig } from './config/environment'
import authRoutes from './routes/auth.routes'
import profileRoutes from './routes/profile.routes'
import sendMoneyRoutes from './routes/send-money.routes'
import notificationRoutes from './routes/notification.routes'
import paymentRequestRoutes from './routes/payment-request.routes'
import paymentMethodRoutes from './routes/payment-method.routes'
import paymentLinkRoutes from './routes/payment-link.routes'
import escrowRoutes from './routes/escrow.routes'
import recurringRoutes from './routes/recurring.routes'
import remittanceRoutes from './routes/remittance.routes'
import beneficiaryRoutes from './routes/beneficiary.routes'
import complianceRoutes from './routes/compliance.routes'
import quoteRoutes from './routes/quote.routes'
import onrampRoutes from './routes/onramp.routes'
import offrampRoutes from './routes/offramp.routes'
import settlementRoutes from './routes/settlement.routes'
import webhookRoutes from './routes/webhook.routes'
import reconciliationRoutes from './routes/reconciliation.routes'
import observabilityRoutes from './routes/observability.routes'
import { ObservabilityController } from './controllers/observability.controller'
import { OperationalMonitoringService } from './services/observability/operational-monitoring.service'
import { securityHeaders } from './middleware/security-headers'
import { correlationIdMiddleware } from './middleware/correlation-id'
import {
  globalRateLimiter,
  authRateLimiter,
  financialRateLimiter,
  webhookRateLimiter,
} from './middleware/rate-limiter'
import { SecurityLogger } from './utils/security-logger'

const app = express()
const PORT = serverConfig.port

// 1. Security Headers & Correlation IDs
app.use(securityHeaders)
app.use(correlationIdMiddleware)

// 2. Strict CORS Whitelist (Zero wildcard reflection)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true)
      if (serverConfig.corsAllowedOrigins.includes(origin)) {
        return callback(null, true)
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS policy`))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'X-Idempotency-Key',
      'X-Correlation-ID',
      'X-Request-ID',
    ],
  })
)

// 3. Global Request Limiter & Parsing
app.use(globalRateLimiter)
app.use(morgan('dev'))
app.use(express.json({ limit: '250kb' })) // Strict body limit

// 4. Rate Limited & Authenticated API Routes
app.use('/api/auth', authRateLimiter, authRoutes)
app.use('/profile', profileRoutes)
app.use('/api/send-money', financialRateLimiter, sendMoneyRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/payment-requests', financialRateLimiter, paymentRequestRoutes)
app.use('/api/payment-methods', paymentMethodRoutes)
app.use('/api/payment-links', financialRateLimiter, paymentLinkRoutes)
app.use('/api/escrow', financialRateLimiter, escrowRoutes)
app.use('/api/recurring', financialRateLimiter, recurringRoutes)
app.use('/api/remittances', financialRateLimiter, remittanceRoutes)
app.use('/api/beneficiaries', beneficiaryRoutes)
app.use('/api/compliance', complianceRoutes)
app.use('/api/quotes', financialRateLimiter, quoteRoutes)
app.use('/api/onramp', financialRateLimiter, onrampRoutes)
app.use('/api/offramp', financialRateLimiter, offrampRoutes)
app.use('/api/settlement', financialRateLimiter, settlementRoutes)
app.use('/api/webhooks', webhookRateLimiter, webhookRoutes)
app.use('/api/reconciliation', reconciliationRoutes)
app.use('/api/observability', observabilityRoutes)

// Production Health & Probe Endpoints
app.get('/health', ObservabilityController.getHealth)
app.get('/health/live', ObservabilityController.getLiveness)
app.get('/health/ready', ObservabilityController.getReadiness)

// Root service info
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'NovaPay Backend Service',
    environment: serverConfig.env,
    midnightNetwork: serverConfig.midnight.network,
    midnightRpc: serverConfig.midnight.rpcUrl,
  })
})

// Sanitized Error handling middleware with operational telemetry recording
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const status = err?.status || 500
  OperationalMonitoringService.recordApiError(req.path, status, err, { correlationId: req.correlationId })
  SecurityLogger.error(err?.message || 'Unhandled server error', req.correlationId, {
    path: req.path,
    method: req.method,
  })
  res.status(status).json({
    error: err?.message?.includes('CORS') ? err.message : 'Internal server error occurred',
    code: err?.code || 'INTERNAL_SERVER_ERROR',
    correlationId: req.correlationId,
  })
})

app.listen(PORT, () => {
  console.log(`====================================================`)
  console.log(`🚀 NovaPay Backend Server running on port ${PORT}`)
  console.log(`🌍 Environment:      ${serverConfig.env.toUpperCase()}`)
  console.log(`📡 Midnight Network: ${serverConfig.midnight.network.toUpperCase()}`)
  console.log(`🔗 Midnight RPC:     ${serverConfig.midnight.rpcUrl}`)
  console.log(`====================================================`)
})

/**
 * Quote Controller
 * Handles HTTP requests for FX and transfer quote generation, locking, and execution.
 */

import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { QuoteService } from '../services/fx/quote.service'

export const createQuote = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const { sourceCurrency, destinationCurrency, sourceAmount, ttlSeconds } = req.body

    if (!sourceAmount) {
      return res.status(400).json({ error: 'Source amount is required.' })
    }

    const quote = await QuoteService.createQuote(req.userId, {
      sourceCurrency,
      destinationCurrency,
      sourceAmount,
      ttlSeconds,
    })

    return res.status(201).json(quote)
  } catch (err: any) {
    console.error('[QuoteController] Error creating quote:', err.message)
    return res.status(400).json({ error: err.message })
  }
}

export const getQuote = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const { id } = req.params
    const quote = await QuoteService.getQuote(req.userId, id)

    return res.status(200).json(quote)
  } catch (err: any) {
    const status = err.message.includes('Access denied') ? 403 : err.message.includes('not found') ? 404 : 400
    return res.status(status).json({ error: err.message })
  }
}

export const lockQuote = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const { id } = req.params
    const lockedQuote = await QuoteService.lockQuote(req.userId, id)

    return res.status(200).json(lockedQuote)
  } catch (err: any) {
    const status = err.message.includes('Access denied') ? 403 : err.message.includes('expired') ? 410 : 400
    return res.status(status).json({ error: err.message })
  }
}

export const executeQuote = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const { id } = req.params
    const executedQuote = await QuoteService.executeQuote(req.userId, id)

    return res.status(200).json(executedQuote)
  } catch (err: any) {
    const status = err.message.includes('Access denied') ? 403 : err.message.includes('Replay') ? 409 : err.message.includes('expired') ? 410 : 400
    return res.status(status).json({ error: err.message })
  }
}

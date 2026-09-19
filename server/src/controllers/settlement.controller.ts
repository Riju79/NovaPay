import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SettlementOrchestratorService } from '../services/settlement/settlement-orchestrator.service';

/**
 * Controller for End-to-End Midnight Preview Settlement (Phase 12)
 */
export class SettlementController {
  /**
   * POST /api/settlement/execute
   * Runs the authoritative 25-step settlement pipeline.
   */
  public static async executeSettlement(req: AuthRequest, res: Response): Promise<Response> {
    const {
      senderWallet,
      recipientWallet,
      senderFiatAmount,
      senderFiatCurrency = 'USD',
      destinationFiatCurrency = 'EUR',
      recipientInfo,
      signature,
      payoutMethod = 'PUSH_TO_CARD',
      purpose,
    } = req.body;

    const userId = req.userId || 'anonymous-settler';

    if (!senderWallet || !recipientWallet || !senderFiatAmount || !recipientInfo?.fullName) {
      return res.status(400).json({
        error: 'Missing required parameters: senderWallet, recipientWallet, senderFiatAmount, and recipientInfo are required.',
      });
    }

    try {
      const result = await SettlementOrchestratorService.executeEndToEndSettlement({
        userId,
        senderWallet,
        recipientWallet,
        senderFiatAmount: String(senderFiatAmount),
        senderFiatCurrency: String(senderFiatCurrency),
        destinationFiatCurrency: String(destinationFiatCurrency),
        recipientInfo,
        signature,
        payoutMethod: String(payoutMethod),
        purpose,
      });

      if (!result.success) {
        return res.status(422).json({
          success: false,
          error: result.error,
          errorCode: result.errorCode,
          failedStep: result.currentStep,
          pipeline: result,
        });
      }

      return res.status(200).json({
        success: true,
        pipeline: result,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/settlement/:id
   * Retrieves pipeline run status and step logs.
   */
  public static async getSettlement(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;

    const run = SettlementOrchestratorService.getPipelineRun(id);
    if (!run) {
      return res.status(404).json({ error: `Settlement execution '${id}' not found` });
    }

    return res.json({
      success: true,
      pipeline: run,
    });
  }

  /**
   * GET /api/settlement/reconciliation/:reconId
   * Retrieves reconciliation record.
   */
  public static async getReconciliation(req: Request, res: Response): Promise<Response> {
    const { reconId } = req.params;

    const recon = SettlementOrchestratorService.getReconciliation(reconId);
    if (!recon) {
      return res.status(404).json({ error: `Reconciliation record '${reconId}' not found` });
    }

    return res.json({
      success: true,
      reconciliation: recon,
    });
  }
}

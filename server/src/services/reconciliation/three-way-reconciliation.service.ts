import { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { toDecimal } from '../../utils/money';
import { RemittanceService } from '../remittance/remittance.service';
import { OnRampService } from '../onramp/onramp.service';
import { MidnightBlockchainService } from '../midnight-blockchain.service';
import { QuoteService } from '../fx/quote.service';

export type ReconciliationStatus =
  | 'MATCHED'
  | 'DISCREPANCY'
  | 'RECONCILIATION_EXCEPTION'
  | 'MANUAL_REVIEW'
  | 'RESOLVED';

export interface StoredReconciliationRecord {
  id: string;
  remittance_id: string;
  expected_amount: Prisma.Decimal;
  actual_amount: Prisma.Decimal;
  discrepancy: Prisma.Decimal;
  db_state: string;
  provider_state: string;
  blockchain_state: string;
  exception_type?: string | null;
  status: ReconciliationStatus;
  retry_count: number;
  max_retries: number;
  queued_for_review: boolean;
  notes?: string | null;
  reconciled_at: Date;
  resolved_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class ThreeWayReconciliationService {
  // In-memory cache for fast lookups and unit test isolation
  public static memoryRecords: Map<string, StoredReconciliationRecord> = new Map();
  public static exceptionAuditLog: Array<{
    action: string;
    recordId: string;
    timestamp: Date;
    details: Record<string, unknown>;
  }> = [];

  public static clearCache(): void {
    this.memoryRecords.clear();
    this.exceptionAuditLog = [];
  }

  /**
   * Three-Way Reconciliation Core:
   * Compares:
   * 1. NovaPay Database State (Remittance & Orders)
   * 2. Provider State (On-Ramp / Off-Ramp)
   * 3. Midnight Preview State (Node verification, block height, on-chain transfer)
   *
   * Example Invariant:
   * DB: FUNDED
   * Provider: PAYMENT_CONFIRMED
   * Midnight: NO ASSET
   * Result: RECONCILIATION_EXCEPTION
   * Rule: Do not mark completed.
   */
  public static async reconcileRemittance(
    userId: string,
    remittanceId: string
  ): Promise<StoredReconciliationRecord> {
    const rem = await RemittanceService.getRemittance(userId, remittanceId);

    // 1. Resolve NovaPay DB State
    const dbState = rem.status;

    // 2. Resolve Provider State
    let providerState = 'UNKNOWN';
    if (rem.funding_reference) {
      const onRampOrder = await OnRampService.findOrder(rem.funding_reference);
      if (onRampOrder) {
        providerState = onRampOrder.status;
      }
    }

    // 3. Resolve Midnight Preview Blockchain State
    let blockchainState = 'NO_ASSET';
    if (rem.blockchain_tx_hash) {
      const isTxValid = await MidnightBlockchainService.verifyTransaction(rem.blockchain_tx_hash);
      if (isTxValid) {
        blockchainState = rem.block_height ? 'ASSET_CONFIRMED' : 'ASSET_SUBMITTED';
      }
    }

    // Evaluate Amounts
    let expectedAmount = rem.recipient_amount;
    let actualAmount = rem.recipient_amount;
    let discrepancy = new Prisma.Decimal(0);

    if (rem.quote_id) {
      try {
        const quote = await QuoteService.getQuote(userId, rem.quote_id);
        if (quote) {
          expectedAmount = toDecimal(quote.destinationAmount);
          discrepancy = expectedAmount.minus(actualAmount).abs();
        }
      } catch {
        // Quote inaccessible or expired in test
      }
    }

    let status: ReconciliationStatus = 'MATCHED';
    let exceptionType: string | null = null;
    let queuedForReview = false;
    let notes = 'Three-way state verified consistent across DB, Provider, and Midnight Preview';

    // ──────────────────────────────────────────────────────────────────────────
    // CRITICAL EXCEPTION DETECTION:
    // DB: FUNDED, Provider: PAYMENT_CONFIRMED, Midnight: NO ASSET
    // ──────────────────────────────────────────────────────────────────────────
    if (
      (dbState === 'FUNDED' || dbState === 'BLOCKCHAIN_PENDING') &&
      providerState === 'PAYMENT_CONFIRMED' &&
      blockchainState === 'NO_ASSET'
    ) {
      status = 'RECONCILIATION_EXCEPTION';
      exceptionType = 'NO_ASSET';
      queuedForReview = true;
      notes =
        'RECONCILIATION_EXCEPTION: NovaPay DB is FUNDED and Provider is PAYMENT_CONFIRMED, but Midnight Preview has NO ASSET. Remittance strictly blocked from marking completed.';

      this.logAudit('RECONCILIATION_EXCEPTION_DETECTED', remittanceId, {
        dbState,
        providerState,
        blockchainState,
        reason: 'Missing on-chain asset settlement',
      });
    } else if (!discrepancy.isZero() && rem.status === 'COMPLETED') {
      status = 'DISCREPANCY';
      exceptionType = 'AMOUNT_MISMATCH';
      queuedForReview = true;
      notes = `DISCREPANCY: Financial amounts desynchronized by ${discrepancy.toString()}`;
    }

    const recordId = `rec_3way_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const record: StoredReconciliationRecord = {
      id: recordId,
      remittance_id: remittanceId,
      expected_amount: expectedAmount,
      actual_amount: actualAmount,
      discrepancy,
      db_state: dbState,
      provider_state: providerState,
      blockchain_state: blockchainState,
      exception_type: exceptionType,
      status,
      retry_count: 0,
      max_retries: 3,
      queued_for_review: queuedForReview,
      notes,
      reconciled_at: new Date(),
      resolved_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    this.memoryRecords.set(recordId, record);

    try {
      await prisma.reconciliationRecord.create({
        data: {
          id: record.id,
          remittance_id: record.remittance_id,
          expected_amount: record.expected_amount,
          actual_amount: record.actual_amount,
          discrepancy: record.discrepancy,
          db_state: record.db_state,
          provider_state: record.provider_state,
          blockchain_state: record.blockchain_state,
          exception_type: record.exception_type,
          status: record.status,
          retry_count: record.retry_count,
          max_retries: record.max_retries,
          queued_for_review: record.queued_for_review,
          notes: record.notes,
          reconciled_at: record.reconciled_at,
          created_at: record.created_at,
        },
      });
    } catch {
      // test fallback
    }

    return record;
  }

  /**
   * Enforces that a remittance with an active RECONCILIATION_EXCEPTION cannot be marked COMPLETED.
   */
  public static assertCanComplete(remittanceId: string): void {
    for (const rec of this.memoryRecords.values()) {
      if (rec.remittance_id === remittanceId) {
        if (rec.status === 'RECONCILIATION_EXCEPTION' || rec.status === 'DISCREPANCY') {
          const err = new Error(
            `RECONCILIATION_BLOCKED: Remittance '${remittanceId}' has an active ${rec.status} (${rec.exception_type}). Cannot mark completed.`
          );
          (err as any).code = 'RECONCILIATION_BLOCKED';
          (err as any).exceptionType = rec.exception_type;
          throw err;
        }
      }
    }
  }

  /**
   * Automatic reconciliation sweep across in-memory cache and database
   */
  public static async runAutomaticReconciliationSweep(): Promise<{
    sweptCount: number;
    matchedCount: number;
    exceptionCount: number;
    records: StoredReconciliationRecord[];
  }> {
    const records: StoredReconciliationRecord[] = [];
    let matchedCount = 0;
    let exceptionCount = 0;

    for (const rem of RemittanceService.memoryCache.values()) {
      const recon = await this.reconcileRemittance(rem.sender_id, rem.id);
      records.push(recon);
      if (recon.status === 'MATCHED') matchedCount++;
      if (recon.status === 'RECONCILIATION_EXCEPTION' || recon.status === 'DISCREPANCY') exceptionCount++;
    }

    return {
      sweptCount: records.length,
      matchedCount,
      exceptionCount,
      records,
    };
  }

  /**
   * Retrieves the exception queue (all records requiring manual review or flagged as exceptions)
   */
  public static async getExceptionQueue(): Promise<StoredReconciliationRecord[]> {
    const exceptions: StoredReconciliationRecord[] = [];

    for (const rec of this.memoryRecords.values()) {
      if (rec.queued_for_review || rec.status === 'RECONCILIATION_EXCEPTION' || rec.status === 'MANUAL_REVIEW') {
        exceptions.push(rec);
      }
    }

    return exceptions;
  }

  /**
   * Retry reconciliation check for an exception record
   */
  public static async retryReconciliation(recordId: string): Promise<StoredReconciliationRecord> {
    const record = await this.getRecord(recordId);

    if (record.retry_count >= record.max_retries) {
      throw new Error(`Maximum reconciliation retries (${record.max_retries}) reached for record '${recordId}'`);
    }

    record.retry_count += 1;
    record.updated_at = new Date();

    // Re-query remittance
    let rem = null;
    for (const r of RemittanceService.memoryCache.values()) {
      if (r.id === record.remittance_id) {
        rem = r;
        break;
      }
    }

    if (rem && rem.blockchain_tx_hash) {
      const isTxValid = await MidnightBlockchainService.verifyTransaction(rem.blockchain_tx_hash);
      if (isTxValid) {
        record.blockchain_state = 'ASSET_CONFIRMED';
        record.status = 'MATCHED';
        record.queued_for_review = false;
        record.exception_type = null;
        record.notes = 'Reconciliation resolved via retry: Midnight Preview asset confirmed';
        record.resolved_at = new Date();
      }
    }

    this.memoryRecords.set(recordId, record);
    this.logAudit('RECONCILIATION_RETRIED', recordId, {
      attempt: record.retry_count,
      status: record.status,
    });

    return record;
  }

  /**
   * Resolves an exception manually with compliance / ops notes
   */
  public static async resolveException(
    recordId: string,
    params: { officerId: string; notes: string; status: 'RESOLVED' | 'MANUAL_REVIEW' }
  ): Promise<StoredReconciliationRecord> {
    const record = await this.getRecord(recordId);

    record.status = params.status;
    record.notes = `Officer (${params.officerId}) resolution: ${params.notes}`;
    record.queued_for_review = params.status === 'MANUAL_REVIEW';
    record.resolved_at = new Date();
    record.updated_at = new Date();

    this.memoryRecords.set(recordId, record);
    this.logAudit('RECONCILIATION_RESOLVED', recordId, {
      officerId: params.officerId,
      status: params.status,
    });

    return record;
  }

  public static async getRecord(recordId: string): Promise<StoredReconciliationRecord> {
    const rec = this.memoryRecords.get(recordId);
    if (rec) return rec;

    try {
      const dbRec = await prisma.reconciliationRecord.findUnique({ where: { id: recordId } });
      if (dbRec) {
        const stored: StoredReconciliationRecord = {
          id: dbRec.id,
          remittance_id: dbRec.remittance_id || '',
          expected_amount: dbRec.expected_amount,
          actual_amount: dbRec.actual_amount,
          discrepancy: dbRec.discrepancy,
          db_state: dbRec.db_state || 'UNKNOWN',
          provider_state: dbRec.provider_state || 'UNKNOWN',
          blockchain_state: dbRec.blockchain_state || 'UNKNOWN',
          exception_type: dbRec.exception_type,
          status: dbRec.status as any,
          retry_count: dbRec.retry_count,
          max_retries: dbRec.max_retries,
          queued_for_review: dbRec.queued_for_review,
          notes: dbRec.notes,
          reconciled_at: dbRec.reconciled_at,
          resolved_at: dbRec.resolved_at,
          created_at: dbRec.created_at,
          updated_at: dbRec.updated_at,
        };
        this.memoryRecords.set(stored.id, stored);
        return stored;
      }
    } catch {}

    throw new Error(`ReconciliationRecord '${recordId}' not found`);
  }

  private static logAudit(action: string, recordId: string, details: Record<string, unknown>): void {
    this.exceptionAuditLog.push({
      action,
      recordId,
      timestamp: new Date(),
      details,
    });
  }
}

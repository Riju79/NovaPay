-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MERCHANT', 'COMPLIANCE_OFFICER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "KycTier" AS ENUM ('TIER_0_UNVERIFIED', 'TIER_1_BASIC', 'TIER_2_VERIFIED', 'TIER_3_ENHANCED');

-- CreateEnum
CREATE TYPE "WalletProvider" AS ENUM ('ONE_AM', 'LACE_MIDNIGHT', 'INTERNAL_VAULT', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "NetworkId" AS ENUM ('PREPROD', 'TESTNET', 'MAINNET');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('NOT_STARTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'REQUIRES_INFO');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('ISSUED', 'REVOKED', 'EXPIRED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RemittanceStatus" AS ENUM ('INITIATED', 'QUOTED', 'AML_SCREENING', 'PAYMENT_PENDING', 'PROCESSING', 'FUNDS_HELD', 'ON_CHAIN_SETTLING', 'SETTLED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BlockchainTransferStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FINALIZED', 'FAILED');

-- CreateEnum
CREATE TYPE "FiatPaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "OnRampStatus" AS ENUM ('PENDING_PAYMENT', 'PAYMENT_RECEIVED', 'MINTING_DUST', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OffRampStatus" AS ENUM ('PENDING_DEPOSIT', 'DEPOSIT_CONFIRMED', 'PAYOUT_INITIATED', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "OrderProvider" AS ENUM ('MONEYGRAM', 'WORLDPAY', 'FAIRWAY', 'INTERNAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "wallet_connected" BOOLEAN NOT NULL DEFAULT false,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "profile_picture" TEXT,
    "phone_number" TEXT,
    "country_code" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "kyc_tier" "KycTier" NOT NULL DEFAULT 'TIER_0_UNVERIFIED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "shielded_address" TEXT,
    "unshielded_address" TEXT,
    "provider" "WalletProvider" NOT NULL DEFAULT 'ONE_AM',
    "network" "NetworkId" NOT NULL DEFAULT 'PREPROD',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "last_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "did_identities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "did" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'prism',
    "controller_did" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "verification_method" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "did_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifiable_credentials" (
    "id" TEXT NOT NULL,
    "identity_id" TEXT NOT NULL,
    "credential_type" TEXT NOT NULL,
    "issuer_did" TEXT NOT NULL,
    "subject_did" TEXT NOT NULL,
    "issuance_date" TIMESTAMP(3) NOT NULL,
    "expiration_date" TIMESTAMP(3),
    "status" "CredentialStatus" NOT NULL DEFAULT 'ISSUED',
    "raw_jwt_vc" TEXT,
    "claims_json" TEXT NOT NULL,
    "revocation_nonce" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifiable_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_cases" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'FAIRWAY',
    "provider_case_id" TEXT,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'IN_REVIEW',
    "risk_score" DECIMAL(5,2),
    "screening_notes" TEXT,
    "aml_check_passed" BOOLEAN NOT NULL DEFAULT false,
    "pep_check_passed" BOOLEAN NOT NULL DEFAULT false,
    "sanctions_check_passed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_proofs" (
    "id" TEXT NOT NULL,
    "compliance_case_id" TEXT NOT NULL,
    "identity_id" TEXT,
    "proof_engine" TEXT NOT NULL DEFAULT 'TRIPLE_PLAY',
    "zk_proof_hash" TEXT NOT NULL,
    "verification_key_id" TEXT NOT NULL,
    "public_inputs" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VERIFIED',
    "verified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficiaries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "phone_number" TEXT,
    "wallet_address" TEXT,
    "country_code" TEXT NOT NULL,
    "payout_method" TEXT NOT NULL DEFAULT 'MIDNIGHT_WALLET',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "beneficiaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remittance_quotes" (
    "id" TEXT NOT NULL,
    "from_currency" TEXT NOT NULL,
    "to_currency" TEXT NOT NULL,
    "from_amount" DECIMAL(18,6) NOT NULL,
    "to_amount" DECIMAL(18,6) NOT NULL,
    "exchange_rate" DECIMAL(18,8) NOT NULL,
    "fee_amount" DECIMAL(18,6) NOT NULL,
    "rail" TEXT NOT NULL DEFAULT 'MIDNIGHT_PREPROD',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_accepted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remittance_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remittances" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "quote_id" TEXT,
    "sender_id" TEXT NOT NULL,
    "recipient_id" TEXT,
    "beneficiary_id" TEXT,
    "sender_amount" DECIMAL(18,6) NOT NULL,
    "sender_currency" TEXT NOT NULL,
    "recipient_amount" DECIMAL(18,6) NOT NULL,
    "recipient_currency" TEXT NOT NULL,
    "exchange_rate" DECIMAL(18,8) NOT NULL,
    "fee_total" DECIMAL(18,6) NOT NULL,
    "status" "RemittanceStatus" NOT NULL DEFAULT 'INITIATED',
    "purpose" TEXT NOT NULL,
    "settlement_rail" TEXT NOT NULL DEFAULT 'MIDNIGHT_PREPROD',
    "provider_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "remittances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'ONE_AM',
    "wallet_address" TEXT,
    "token_reference" TEXT,
    "network" TEXT NOT NULL DEFAULT 'PREPROD',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "on_ramp_orders" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "OrderProvider" NOT NULL DEFAULT 'WORLDPAY',
    "fiat_amount" DECIMAL(18,2) NOT NULL,
    "fiat_currency" TEXT NOT NULL,
    "crypto_amount" DECIMAL(18,6) NOT NULL,
    "crypto_asset" TEXT NOT NULL DEFAULT 'tDUST',
    "destination_wallet" TEXT NOT NULL,
    "status" "OnRampStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "provider_order_id" TEXT,
    "tx_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "on_ramp_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "off_ramp_orders" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "OrderProvider" NOT NULL DEFAULT 'MONEYGRAM',
    "crypto_amount" DECIMAL(18,6) NOT NULL,
    "crypto_asset" TEXT NOT NULL DEFAULT 'tDUST',
    "fiat_amount" DECIMAL(18,2) NOT NULL,
    "fiat_currency" TEXT NOT NULL,
    "source_wallet" TEXT NOT NULL,
    "payout_location_id" TEXT,
    "status" "OffRampStatus" NOT NULL DEFAULT 'PENDING_DEPOSIT',
    "provider_order_id" TEXT,
    "tx_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "off_ramp_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blockchain_transfers" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "remittance_id" TEXT,
    "sender_wallet_id" TEXT,
    "recipient_wallet_id" TEXT,
    "sender_wallet" TEXT NOT NULL,
    "recipient_wallet" TEXT NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "asset_id" TEXT NOT NULL DEFAULT 'tDUST',
    "tx_hash" TEXT,
    "block_height" BIGINT,
    "block_timestamp" TIMESTAMP(3),
    "network" "NetworkId" NOT NULL DEFAULT 'PREPROD',
    "contract_address" TEXT,
    "circuit_name" TEXT,
    "status" "BlockchainTransferStatus" NOT NULL DEFAULT 'PENDING',
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blockchain_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiat_payments" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "remittance_id" TEXT,
    "payment_method_id" TEXT,
    "provider" TEXT NOT NULL,
    "provider_payment_id" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "FiatPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fiat_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "base_currency" TEXT NOT NULL,
    "target_currency" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ORACLE',
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fees" (
    "id" TEXT NOT NULL,
    "remittance_id" TEXT,
    "fee_type" TEXT NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL,
    "charged_to" TEXT NOT NULL DEFAULT 'SENDER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "signature" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "error_message" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_records" (
    "id" TEXT NOT NULL,
    "remittance_id" TEXT,
    "blockchain_transfer_id" TEXT,
    "fiat_payment_id" TEXT,
    "expected_amount" DECIMAL(18,6) NOT NULL,
    "actual_amount" DECIMAL(18,6) NOT NULL,
    "discrepancy" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'MATCHED',
    "reconciled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT,
    "recipient_id" TEXT,
    "sender_wallet" TEXT NOT NULL,
    "recipient_wallet" TEXT NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "asset_type" TEXT NOT NULL DEFAULT 'tDUST',
    "purpose" TEXT NOT NULL,
    "tx_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "wallet_address" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_requests" (
    "id" TEXT NOT NULL,
    "requester_id" TEXT,
    "recipient_id" TEXT,
    "requester_wallet" TEXT NOT NULL,
    "recipient_wallet" TEXT NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "asset" TEXT NOT NULL DEFAULT 'tDUST',
    "purpose" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "transaction_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_links" (
    "id" TEXT NOT NULL,
    "creator_id" TEXT,
    "creator_wallet" TEXT NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "asset" TEXT NOT NULL DEFAULT 'tDUST',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payment_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_records" (
    "id" TEXT NOT NULL,
    "payer" TEXT NOT NULL,
    "payee" TEXT NOT NULL,
    "arbiter" TEXT NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 0,
    "tx_hash" TEXT,
    "deadline" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "escrow_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_records" (
    "id" TEXT NOT NULL,
    "payer" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "frequency_seconds" INTEGER NOT NULL,
    "next_payment_time" INTEGER NOT NULL,
    "end_time" INTEGER NOT NULL,
    "max_payments" INTEGER NOT NULL DEFAULT 0,
    "payment_count" INTEGER NOT NULL DEFAULT 0,
    "status" INTEGER NOT NULL DEFAULT 1,
    "tx_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "subscription_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_address_key" ON "users"("wallet_address");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_wallet_address_idx" ON "users"("wallet_address");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_address_key" ON "wallets"("address");

-- CreateIndex
CREATE INDEX "wallets_user_id_idx" ON "wallets"("user_id");

-- CreateIndex
CREATE INDEX "wallets_address_idx" ON "wallets"("address");

-- CreateIndex
CREATE INDEX "wallets_network_idx" ON "wallets"("network");

-- CreateIndex
CREATE UNIQUE INDEX "did_identities_did_key" ON "did_identities"("did");

-- CreateIndex
CREATE INDEX "did_identities_user_id_idx" ON "did_identities"("user_id");

-- CreateIndex
CREATE INDEX "did_identities_did_idx" ON "did_identities"("did");

-- CreateIndex
CREATE INDEX "verifiable_credentials_identity_id_idx" ON "verifiable_credentials"("identity_id");

-- CreateIndex
CREATE INDEX "verifiable_credentials_credential_type_idx" ON "verifiable_credentials"("credential_type");

-- CreateIndex
CREATE INDEX "verifiable_credentials_status_idx" ON "verifiable_credentials"("status");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_cases_idempotency_key_key" ON "compliance_cases"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_cases_provider_case_id_key" ON "compliance_cases"("provider_case_id");

-- CreateIndex
CREATE INDEX "compliance_cases_user_id_idx" ON "compliance_cases"("user_id");

-- CreateIndex
CREATE INDEX "compliance_cases_status_idx" ON "compliance_cases"("status");

-- CreateIndex
CREATE INDEX "compliance_cases_provider_case_id_idx" ON "compliance_cases"("provider_case_id");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_proofs_zk_proof_hash_key" ON "compliance_proofs"("zk_proof_hash");

-- CreateIndex
CREATE INDEX "compliance_proofs_compliance_case_id_idx" ON "compliance_proofs"("compliance_case_id");

-- CreateIndex
CREATE INDEX "compliance_proofs_identity_id_idx" ON "compliance_proofs"("identity_id");

-- CreateIndex
CREATE INDEX "beneficiaries_user_id_idx" ON "beneficiaries"("user_id");

-- CreateIndex
CREATE INDEX "beneficiaries_wallet_address_idx" ON "beneficiaries"("wallet_address");

-- CreateIndex
CREATE INDEX "remittance_quotes_from_currency_to_currency_idx" ON "remittance_quotes"("from_currency", "to_currency");

-- CreateIndex
CREATE INDEX "remittance_quotes_expires_at_idx" ON "remittance_quotes"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "remittances_idempotency_key_key" ON "remittances"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "remittances_quote_id_key" ON "remittances"("quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "remittances_provider_reference_key" ON "remittances"("provider_reference");

-- CreateIndex
CREATE INDEX "remittances_sender_id_idx" ON "remittances"("sender_id");

-- CreateIndex
CREATE INDEX "remittances_recipient_id_idx" ON "remittances"("recipient_id");

-- CreateIndex
CREATE INDEX "remittances_status_idx" ON "remittances"("status");

-- CreateIndex
CREATE INDEX "remittances_idempotency_key_idx" ON "remittances"("idempotency_key");

-- CreateIndex
CREATE INDEX "payment_methods_user_id_idx" ON "payment_methods"("user_id");

-- CreateIndex
CREATE INDEX "payment_methods_wallet_address_idx" ON "payment_methods"("wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "on_ramp_orders_idempotency_key_key" ON "on_ramp_orders"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "on_ramp_orders_provider_order_id_key" ON "on_ramp_orders"("provider_order_id");

-- CreateIndex
CREATE INDEX "on_ramp_orders_user_id_idx" ON "on_ramp_orders"("user_id");

-- CreateIndex
CREATE INDEX "on_ramp_orders_status_idx" ON "on_ramp_orders"("status");

-- CreateIndex
CREATE INDEX "on_ramp_orders_provider_order_id_idx" ON "on_ramp_orders"("provider_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "off_ramp_orders_idempotency_key_key" ON "off_ramp_orders"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "off_ramp_orders_provider_order_id_key" ON "off_ramp_orders"("provider_order_id");

-- CreateIndex
CREATE INDEX "off_ramp_orders_user_id_idx" ON "off_ramp_orders"("user_id");

-- CreateIndex
CREATE INDEX "off_ramp_orders_status_idx" ON "off_ramp_orders"("status");

-- CreateIndex
CREATE INDEX "off_ramp_orders_provider_order_id_idx" ON "off_ramp_orders"("provider_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_transfers_idempotency_key_key" ON "blockchain_transfers"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_transfers_tx_hash_key" ON "blockchain_transfers"("tx_hash");

-- CreateIndex
CREATE INDEX "blockchain_transfers_sender_wallet_idx" ON "blockchain_transfers"("sender_wallet");

-- CreateIndex
CREATE INDEX "blockchain_transfers_recipient_wallet_idx" ON "blockchain_transfers"("recipient_wallet");

-- CreateIndex
CREATE INDEX "blockchain_transfers_tx_hash_idx" ON "blockchain_transfers"("tx_hash");

-- CreateIndex
CREATE INDEX "blockchain_transfers_status_idx" ON "blockchain_transfers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "fiat_payments_idempotency_key_key" ON "fiat_payments"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "fiat_payments_provider_payment_id_key" ON "fiat_payments"("provider_payment_id");

-- CreateIndex
CREATE INDEX "fiat_payments_remittance_id_idx" ON "fiat_payments"("remittance_id");

-- CreateIndex
CREATE INDEX "fiat_payments_provider_payment_id_idx" ON "fiat_payments"("provider_payment_id");

-- CreateIndex
CREATE INDEX "fiat_payments_status_idx" ON "fiat_payments"("status");

-- CreateIndex
CREATE INDEX "exchange_rates_base_currency_target_currency_idx" ON "exchange_rates"("base_currency", "target_currency");

-- CreateIndex
CREATE INDEX "exchange_rates_valid_from_valid_until_idx" ON "exchange_rates"("valid_from", "valid_until");

-- CreateIndex
CREATE INDEX "fees_remittance_id_idx" ON "fees"("remittance_id");

-- CreateIndex
CREATE INDEX "fees_fee_type_idx" ON "fees"("fee_type");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_idempotency_key_key" ON "webhook_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "webhook_events_provider_event_type_idx" ON "webhook_events"("provider", "event_type");

-- CreateIndex
CREATE INDEX "webhook_events_idempotency_key_idx" ON "webhook_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "webhook_events_status_idx" ON "webhook_events"("status");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "reconciliation_records_remittance_id_idx" ON "reconciliation_records"("remittance_id");

-- CreateIndex
CREATE INDEX "reconciliation_records_status_idx" ON "reconciliation_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_tx_hash_key" ON "transactions"("tx_hash");

-- CreateIndex
CREATE INDEX "transactions_sender_wallet_idx" ON "transactions"("sender_wallet");

-- CreateIndex
CREATE INDEX "transactions_recipient_wallet_idx" ON "transactions"("recipient_wallet");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_tx_hash_idx" ON "transactions"("tx_hash");

-- CreateIndex
CREATE INDEX "notifications_wallet_address_idx" ON "notifications"("wallet_address");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_requests_transaction_hash_key" ON "payment_requests"("transaction_hash");

-- CreateIndex
CREATE INDEX "payment_requests_requester_wallet_idx" ON "payment_requests"("requester_wallet");

-- CreateIndex
CREATE INDEX "payment_requests_recipient_wallet_idx" ON "payment_requests"("recipient_wallet");

-- CreateIndex
CREATE INDEX "payment_requests_status_idx" ON "payment_requests"("status");

-- CreateIndex
CREATE INDEX "payment_links_creator_wallet_idx" ON "payment_links"("creator_wallet");

-- CreateIndex
CREATE INDEX "payment_links_status_idx" ON "payment_links"("status");

-- CreateIndex
CREATE INDEX "escrow_records_payer_idx" ON "escrow_records"("payer");

-- CreateIndex
CREATE INDEX "escrow_records_payee_idx" ON "escrow_records"("payee");

-- CreateIndex
CREATE INDEX "escrow_records_arbiter_idx" ON "escrow_records"("arbiter");

-- CreateIndex
CREATE INDEX "escrow_records_status_idx" ON "escrow_records"("status");

-- CreateIndex
CREATE INDEX "subscription_records_payer_idx" ON "subscription_records"("payer");

-- CreateIndex
CREATE INDEX "subscription_records_recipient_idx" ON "subscription_records"("recipient");

-- CreateIndex
CREATE INDEX "subscription_records_status_idx" ON "subscription_records"("status");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "did_identities" ADD CONSTRAINT "did_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifiable_credentials" ADD CONSTRAINT "verifiable_credentials_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "did_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_cases" ADD CONSTRAINT "compliance_cases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_proofs" ADD CONSTRAINT "compliance_proofs_compliance_case_id_fkey" FOREIGN KEY ("compliance_case_id") REFERENCES "compliance_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_proofs" ADD CONSTRAINT "compliance_proofs_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "did_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remittances" ADD CONSTRAINT "remittances_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "remittance_quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remittances" ADD CONSTRAINT "remittances_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remittances" ADD CONSTRAINT "remittances_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remittances" ADD CONSTRAINT "remittances_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "on_ramp_orders" ADD CONSTRAINT "on_ramp_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "off_ramp_orders" ADD CONSTRAINT "off_ramp_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blockchain_transfers" ADD CONSTRAINT "blockchain_transfers_remittance_id_fkey" FOREIGN KEY ("remittance_id") REFERENCES "remittances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blockchain_transfers" ADD CONSTRAINT "blockchain_transfers_sender_wallet_id_fkey" FOREIGN KEY ("sender_wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blockchain_transfers" ADD CONSTRAINT "blockchain_transfers_recipient_wallet_id_fkey" FOREIGN KEY ("recipient_wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiat_payments" ADD CONSTRAINT "fiat_payments_remittance_id_fkey" FOREIGN KEY ("remittance_id") REFERENCES "remittances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiat_payments" ADD CONSTRAINT "fiat_payments_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fees" ADD CONSTRAINT "fees_remittance_id_fkey" FOREIGN KEY ("remittance_id") REFERENCES "remittances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_records" ADD CONSTRAINT "reconciliation_records_remittance_id_fkey" FOREIGN KEY ("remittance_id") REFERENCES "remittances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_records" ADD CONSTRAINT "reconciliation_records_blockchain_transfer_id_fkey" FOREIGN KEY ("blockchain_transfer_id") REFERENCES "blockchain_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_records" ADD CONSTRAINT "reconciliation_records_fiat_payment_id_fkey" FOREIGN KEY ("fiat_payment_id") REFERENCES "fiat_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

# NovaPay 💸

NovaPay is a high-fidelity, decentralized cross-border remittance and payment portal. Powered by the **Midnight blockchain network**, NovaPay bypasses traditional intermediary banking overhead to settle international invoices, services, and business expenses with zero-knowledge privacy and near-zero transaction fees.

NovaPay leverages **Compact Smart Contracts** for trustless escrow agreements and pre-authorized recurring merchant billing.

---

## 🔗 Project Links & Resources

*   **Public GitHub Repository**: [https://github.com/Riju79/NovaPay](https://github.com/Riju79/NovaPay)
*   **Live Demo Link**: [https://novapay-remit.vercel.app](https://novapay-steel.vercel.app) *(Vercel Client)*
*   **Live Backend API**: [https://novapay-w4zv.onrender.com](https://novapay-w4zv.onrender.com) *(Render Host)*

---

## 📜 Midnight Compact Smart Contracts

NovaPay's core decentralized finance operations are backed by Compact zero-knowledge smart contracts deployed to the Midnight Preprod Network.

### 1. Trustless Escrow Contract (`escrow.compact`)
Allows payers to lock up tDUST funds in a secure zero-knowledge vault. The funds are only released to the recipient upon approval by the payer or an appointed arbiter. Paid funds can also be refunded back to the payer if canceled by the recipient or arbiter.
*   **Source Path**: [`contracts-midnight/escrow.compact`](file:///c:/novapay/contracts-midnight/escrow.compact)
*   **Deployment Address**: `mn_contract1_escrow_preprod_8f7a6c5b4e3d`

### 2. Pre-Authorized Recurring Billing Contract (`recurring_billing.compact`)
Allows payers to authorize a merchant (payee) to pull a fixed limit of tokens at periodic time intervals (e.g. 30-day billing cycle limit). The merchant triggers charges programmatically, and either party can cancel the plan at any time.
*   **Source Path**: [`contracts-midnight/recurring_billing.compact`](file:///c:/novapay/contracts-midnight/recurring_billing.compact)
*   **Deployment Address**: `mn_contract1_recurring_preprod_2a1b0c9d8e7f`

---

## 🚀 Key Features

*   **Midnight Wallet Integration**: Connect and authenticate securely using Lace Wallet (Midnight Edition) or iAM Wallet on Midnight Preprod.
*   **Auto-Account Provisioning**: Instant user profile and database registration on Midnight wallet connection.
*   **Live Balance Ledger**: Displays Midnight wallet Bech32m public addresses (`mn_preprod1...`) and native tDUST balance fetched live from Midnight Indexer.
*   **Shareable Payment Links**: Generate custom persistent invoice links (in tDUST) that payers can open to settle immediately without logging in.
*   **Peer-to-Peer Requests**: Create and send invoices from user to user, viewable in incoming/outgoing request feeds.
*   **Activity Audit Log & Notifications**: Real-time transaction logs coupled with system alerts and read/unread status updates.

---

## 📸 Platform Screenshots

### 1. Wallet Connected & Live Balance Display
The profile dashboard manages the authenticated user session and displays Midnight wallet node details, the linked Bech32m address, and the current active tDUST balance fetched directly from Midnight Indexer.

![Midnight Wallet Connected & Active Balance Display](/public/screenshots/wallet-connected.png)

### 2. Successful Transaction & Activity Alert Feed
The Activity Log dashboard provides real-time transaction tracking. It displays the history of sent and received remittances along with corresponding backend system alert notifications generated upon ledger confirmation.

![Successful Transaction & Activity Alert Feed](/public/screenshots/activity-log.png)

---

## 🛠️ Stack Overview
*   **Frontend**: Next.js 16 (App Router), Tailwind v4, TypeScript
*   **Blockchain Integration**: `@midnight-ntwrk/dapp-connector-api`, `@midnight-ntwrk/midnight-js-contracts` (Midnight Preprod)
*   **Smart Contracts**: Compact (`.compact`) ZK Circuits
*   **Backend Server**: Express + TypeScript + Prisma (SQLite)

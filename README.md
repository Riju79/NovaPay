<p align="center">
  <a href="https://preview.midnight.network"><img src="https://img.shields.io/badge/BUILT%20ON-MIDNIGHT%20NETWORK-6366f1?style=flat-square" alt="Built On"/></a>
  <a href="https://preview.midnight.network"><img src="https://img.shields.io/badge/NETWORK-PREVIEW%20TESTNET-10b981?style=flat-square" alt="Network"/></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/FRONTEND-NEXT.JS%2016-000000?style=flat-square&logo=nextdotjs" alt="Frontend"/></a>
  <br/>
  <a href="https://midnight.network"><img src="https://img.shields.io/badge/SMART%20CONTRACTS-COMPACT%20ZK%20CIRCUITS-8b5cf6?style=flat-square" alt="Smart Contracts"/></a>
  <a href="https://explorer.1am.xyz"><img src="https://img.shields.io/badge/WALLET-1AM%20WALLET-f59e0b?style=flat-square" alt="Wallet"/></a>
  <br/>
  <a href="https://github.com/Riju79/NovaPay"><img src="https://img.shields.io/badge/GITHUB-RIJU79%2FNOVAPAY-24292e?style=flat-square&logo=github" alt="GitHub"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/LICENSE-MIT-green?style=flat-square" alt="License"/></a>
</p>

```text
╔╗╔  ╔═╗  ╦  ╦  ╔═╗  ╔═╗  ╔═╗  ╦  ╦
║║║  ║ ║  ╚╗╔╝  ╠═╣  ╠═╝  ╠═╣  ╚╗╔╝
╝╚╝  ╚═╝   ╚╝   ╩ ╩  ╩    ╩ ╩   ╩  
```

<h3 align="center">💸 Decentralized Zero-Knowledge Remittance Protocol on Midnight Network</h3>

<p align="center">
  <b>Send P2P Remittances · Create Invoices · ZK Escrow Agreements · Pre-Authorized Recurring Billing · Everything On-Chain</b>
</p>

<p align="center">
  <a href="https://novapay-steel.vercel.app">🌐 Live App</a> ·
  <a href="#-what-is-novapay">📚 Documentation</a> ·
  <a href="https://github.com/Riju79/NovaPay">🐙 GitHub Repo</a> ·
  <a href="https://explorer.1am.xyz">🔍 1AM Explorer</a> ·
  <a href="https://novapay-w4zv.onrender.com">⚙️ Backend API</a>
</p>

---

## ✨ What Is NovaPay?

**NovaPay** is a high-fidelity, privacy-preserving decentralized finance platform designed for global cross-border remittances, P2P invoicing, conditional escrow agreements, and pre-authorized recurring merchant billing.

By leveraging the **Midnight Blockchain** and **Compact Zero-Knowledge (ZK) Circuits**, NovaPay eliminates traditional banking overhead, high cross-border wire fees, and transaction latency while keeping commercial payment metadata strictly confidential.

### The Problem
Traditional international payment rails (SWIFT, correspondent banking networks) are slow (3–5 business days), expensive (3%–7% transfer fees), and completely expose financial transaction histories to third-party tracking.

### The Solution
NovaPay combines **1AM Wallet authentication**, **Compact zero-knowledge smart contracts**, and **instant block finality** on Midnight Preview to deliver:
1. **Near-Zero Transaction Fees**: Transfer native `tDUST` tokens internationally without intermediary commissions.
2. **Zero-Knowledge Privacy**: Settle commercial transactions confidentially without exposing wallet balances or sensitive metadata on public ledgers.
3. **Trustless Escrow & Subscriptions**: Execute conditional payment releases and automated recurring billing using compiled Compact smart contracts.

---

## ⚡ Key Features

* 🔐 **1AM Wallet Integration**: Native authentication via the **1AM DApp Connector API** (`@midnight-ntwrk/dapp-connector-api`) with session persistence across page reloads.
* 💸 **Instant P2P Remittances**: Send native `tDUST` funds instantly with canonical 64-character (32-byte) Midnight ledger transaction hash verification.
* 📋 **Peer-to-Peer Invoicing (`/request-money`)**: Create, incoming/outgoing tab feeds, decline, or pay payment requests on-chain.
* 🔗 **Shareable Payment Links (`/pay/[id]`)**: Persistent invoice URLs for one-click invoice settlement.
* 🛡️ **Zero-Knowledge Escrow Agreements**: Lock funds in a Compact ZK vault (`mn_contract1_escrow...`) until released by the payer or an arbiter.
* 🔄 **Pre-Authorized Recurring Subscriptions**: Automated merchant billing contracts (`mn_contract1_recurring...`) enforcing periodic cycle spending limits.
* 🔎 **1AM Explorer Verification**: Direct deep-links (`https://explorer.1am.xyz/tx/<canonical_tx_hash>`) for transparent auditability.
* 🔔 **Activity Audit Feed**: Real-time transaction history and system notification updates.

---

## 🧠 Why Blockchain & Zero-Knowledge?

| Layer | On-Chain (Midnight Network) | Off-Chain (NovaPay Backend) |
| :--- | :--- | :--- |
| **State** | Token balances (`tDUST`), Compact contract states, transaction validation proofs | User profiles, notification queues, cached activity indices |
| **Privacy** | Zero-knowledge proof validation protects account balance metadata | Encrypted session state & API route access control |
| **Trust** | Cryptographic consensus guarantees funds cannot be seized or double-spent | Express endpoints handle payload preparation & routing |

Centralized payment gateways require trust in centralized servers and retain full ownership of funds. NovaPay ensures that **only the user's private key (via 1AM Wallet) can authorize transactions**, while smart contracts enforce settlement logic autonomously.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Client ["Frontend (Next.js 16 App Router)"]
        UI["NovaPay UI"]
        WalletCtx["Midnight Wallet Context"]
    end

    subgraph Wallet ["Browser Extension"]
        OneAM["1AM Wallet Extension (Preview Testnet)"]
    end

    subgraph Backend ["Backend Server (Node.js / Express)"]
        API["Express API Server"]
        Prisma["Prisma ORM"]
        DB[(SQLite Database)]
    end

    subgraph Blockchain ["Midnight Blockchain Network (Preview)"]
        RPC["Midnight RPC Node\n(https://rpc.preview.midnight.network)"]
        Indexer["Midnight GraphQL Indexer\n(https://indexer.preview.midnight.network/graphql)"]
        EscrowContract["Escrow Compact Contract\n(mn_contract1_escrow_preview_mt8xjoflwwff)"]
        RecurringContract["Recurring Billing Contract\n(mn_contract1_recurring_preview_mt8xjoflwwff)"]
        Explorer["1AM Explorer\n(https://explorer.1am.xyz)"]
    end

    UI --> WalletCtx
    WalletCtx <--> OneAM
    OneAM <--> RPC
    UI <--> API
    API <--> Prisma
    Prisma <--> DB
    UI <--> Indexer
    OneAM --> EscrowContract
    OneAM --> RecurringContract
    Indexer --> Explorer
```

---

## 🔄 User & Transaction Workflows

### 1. Wallet Connection Flow
1. User clicks **Connect 1AM Wallet** or opens NovaPay.
2. `MidnightWalletContext` queries `window.midnight['1am']`.
3. 1AM Extension requests authorization and retrieves the active Bech32m address (`mn_addr_preview1...`).
4. Session state is saved to `localStorage` (`STORAGE_SESSION_KEY`) for seamless persistence across page reloads.

### 2. Remittance & Settlement Flow
1. User enters recipient wallet address (`mn_addr_preview1...`) and amount in `tDUST`.
2. Frontend constructs the transaction payload and calls `execute1AMTransfer(connectedApi, recipient, amountBaseUnits)`.
3. 1AM Wallet displays the signature popup.
4. Upon approval, 1AM returns the transaction response.
5. NovaPay extracts the **canonical 64-character (32-byte) Midnight transaction hash** (`8d9b443a...`), filtering out preliminary CBOR proof strings (`0006...`).
6. The transaction is persisted to the backend database as `PENDING` and polled for block confirmation.
7. User receives a receipt modal linking directly to `https://explorer.1am.xyz/tx/<canonical_tx_hash>`.

---

## 💻 Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | Next.js 16 (App Router), React 19 | Server & client UI rendering |
| **Styling & UI** | Vanilla CSS, Tailwind CSS v4, Lucide Icons, Framer Motion | Dynamic dark-mode design system & animations |
| **Blockchain SDK** | `@midnight-ntwrk/compact-js`, `@midnight-ntwrk/compact-runtime`, `@midnight-ntwrk/ledger-v8` | Midnight Network ledger interaction & ZK proof parsing |
| **Smart Contracts** | Compact (`.compact`) Zero-Knowledge Language | On-chain escrow and recurring billing circuits |
| **Wallet Connector** | `@midnight-ntwrk/dapp-connector-api` / 1AM Wallet | Browser wallet signature & transaction submission |
| **Backend API** | Node.js, Express, TypeScript | Session authentication, transaction ledger, notifications |
| **Database ORM** | Prisma ORM, SQLite | Persistent relational storage for user profiles and activity |
| **CI/CD & Hosting** | GitHub Actions, Vercel, Render | Automated pipeline, web hosting & API deployment |

---

## ⛓️ Deployed Smart Contracts & Network Info

### Network Configuration
* **Network**: Midnight Preview Testnet (`preview`)
* **RPC Endpoint**: `https://rpc.preview.midnight.network`
* **GraphQL Indexer**: `https://indexer.preview.midnight.network/graphql`
* **Blockchain Explorer**: `https://explorer.1am.xyz`
* **Native Token**: `tDUST` (Testnet DUST)

### Active Deployed Compact Contracts

#### 1. Escrow Smart Contract (`EscrowContract`)
* **Contract Address**: `mn_contract1_escrow_preview_mt8xjoflwwff`
* **Network**: Midnight Preview
* **Source Artifacts**: [`contracts/escrow/managed/contract/index.js`](file:///Users/rijur/Downloads/novapay/contracts/escrow/managed/contract/index.js)
* **Purpose**: Locks `tDUST` funds in a zero-knowledge smart contract vault until condition fulfillment or arbiter approval.
* **Core Functions**:
  - `createEscrow(payer, recipient, arbiter, amount)` — Initializes a ZK escrow vault.
  - `fundEscrow(escrowId)` — Locks required `tDUST` tokens into the contract state.
  - `lockEscrow(escrowId)` — Places the escrow in a locked/disputed state.
  - `releaseEscrow(escrowId)` — Releases locked funds to the recipient.

#### 2. Pre-Authorized Recurring Billing Contract (`RecurringContract`)
* **Contract Address**: `mn_contract1_recurring_preview_mt8xjoflwwff`
* **Network**: Midnight Preview
* **Source Artifacts**: [`contracts/recurring_billing/managed/contract/index.js`](file:///Users/rijur/Downloads/novapay/contracts/recurring_billing/managed/contract/index.js)
* **Purpose**: Authorizes periodic merchant pull charges up to defined cycle limits without re-prompting for manual approval each period.
* **Core Functions**:
  - `recurringInitialize(payer, payee, limitStroops, intervalSeconds)` — Authorizes recurring spending limits.
  - `recurringCharge(payer, amount)` — Triggers an automated cycle charge within the authorized limit.

---

## 💰 Asset Movement Lifecycle

```text
[ Sender / Payer 1AM Wallet ]
            │
            ▼ (1AM Extension Sign & Submit)
[ Midnight Mempool (Preview Testnet) ]
            │
            ▼ (Block Producer Minting)
[ Midnight Ledger / Compact Circuit State ]
       ┌────┴──────────────────────────┐
       ▼                               ▼
[ P2P Recipient Wallet ]     [ Escrow / Recurring Vault ]
       │                               │
       └──────────────┬────────────────┘
                      ▼
            [ 1AM Explorer Verification ]
```

---

## 📸 Platform Screenshots

### 1. Payment Methods & Live Balance Dashboard
Manages connected Midnight Bech32m public addresses (`mn_addr_prev...3uhy7qf0q3ta`), live native `tDUST` token balances (Unshielded: `663.0 tDUST`, Shielded: `0.0 tDUST`), and wallet session state.

![Payment Methods & Active Balance Display](./public/screenshots/wallet-connected.png)

### 2. Activity Audit Log & Real-Time Alert Feed
Real-time transaction tracking showing total logged transactions (`14 Logged`), pending alerts (`26 Pending`), request payments, received funds, and deep-links to 1AM Explorer.

![Activity Log & Notifications](./public/screenshots/activity-log.png)

---

## 🚀 Local Development Setup

### Prerequisites
* **Node.js**: `v20.x` or higher
* **Package Manager**: `npm` (v10+)
* **Browser Extension**: **1AM Wallet Extension** installed in Brave or Chrome

### 1. Clone Repository & Install Dependencies
```bash
git clone https://github.com/Riju79/NovaPay.git
cd NovaPay

# Install Frontend Dependencies
npm install

# Install Server Dependencies
cd server
npm install
cd ..
```

### 2. Configure Environment Variables
Create `.env.local` in the project root:

```env
NEXT_PUBLIC_MIDNIGHT_NETWORK=preview
NEXT_PUBLIC_MIDNIGHT_RPC_URL=https://rpc.preview.midnight.network
NEXT_PUBLIC_MIDNIGHT_INDEXER_URL=https://indexer.preview.midnight.network/graphql
NEXT_PUBLIC_MIDNIGHT_EXPLORER_URL=https://explorer.1am.xyz
NEXT_PUBLIC_MIDNIGHT_ESCROW_CONTRACT_ADDRESS=mn_contract1_escrow_preview_mt8xjoflwwff
NEXT_PUBLIC_MIDNIGHT_RECURRING_CONTRACT_ADDRESS=mn_contract1_recurring_preview_mt8xjoflwwff
NEXT_PUBLIC_API_URL=http://localhost:5000
MIDNIGHT_PROOF_SERVER_URL=http://localhost:6300
```

### 3. Initialize Database & Run Local Servers

```bash
# Terminal 1: Run Backend API Server
cd server
npx prisma db push
npm run dev

# Terminal 2: Run Next.js Frontend Dev Server (in project root)
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 4. Build & Verification Commands

```bash
# Check Frontend Production Build & TypeScript
npm run build

# Run Backend Unit Tests
cd server
npm test
```

### 5. Deploy Smart Contracts (Optional Script)
To deploy new contract instances to Midnight testnet using a seed phrase:

```bash
MIDNIGHT_WALLET_SEED="your 24-word seed phrase..." npm run deploy-contracts
```

---

## 🔌 API Reference

### Payment Requests API (`/api/payment-requests`)
* `GET /api/payment-requests?walletAddress=<address>` — Retrieve payment requests related to the wallet.
* `POST /api/payment-requests` — Create a new payment request (`recipientWallet`, `amount`, `purpose`).
* `PATCH /api/payment-requests/:id/pay` — Execute on-chain payment and record canonical `txHash`.
* `PATCH /api/payment-requests/:id/decline` — Decline a pending request.

### Remittances API (`/api/send-money`)
* `POST /api/send-money/submit-transaction` — Persist transaction immediately as `PENDING`.
* `POST /api/send-money/confirm-transaction` — Update status to `SUCCESS` after block confirmation.
* `GET /api/send-money/history?walletAddress=<address>` — Fetch wallet remittance activity history.

---

## 🔐 Security & Trust Boundaries

* **Private Key Isolation**: Private keys never touch NovaPay servers. All cryptographic signatures occur strictly inside the user's isolated **1AM Wallet Extension**.
* **Canonical Hash Extraction**: High-precision string validation (`is64HexHash()`) enforces exact 64-character (32-byte) hex transaction identifiers and discards un-finalized raw CBOR payload strings.
* **Strict Payload Parsing**: Server endpoints validate wallet address formatting (`isValidWalletAddress`) and reject unauthorized payment requests.

---

## 📁 Project Structure

```text
novapay/
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions CI/CD Pipeline
├── contracts/
│   ├── escrow/                    # Escrow Compact ZK Contract
│   │   └── managed/contract/      # Compiled JS/TS Artifacts
│   └── recurring_billing/         # Recurring Billing Compact Contract
│       └── managed/contract/      # Compiled JS/TS Artifacts
├── public/
│   ├── screenshots/               # Verified UI Screenshots
│   └── icon.svg
├── scripts/
│   └── deploy-contracts.js        # Compact Smart Contract Deployer
├── server/                        # Express + Prisma Backend Server
│   ├── prisma/
│   │   └── schema.prisma          # Database Schema
│   ├── src/
│   │   ├── controllers/           # Route Controllers
│   │   ├── routes/                # Express API Routes
│   │   └── index.ts               # Server Entry Point
│   └── test/                      # Backend Unit Tests
├── src/
│   ├── app/                       # Next.js 16 App Router Pages
│   │   ├── activity/              # Transaction Feed & Receipt Modals
│   │   ├── pay/[id]/              # Shareable Invoice Links
│   │   ├── request-money/         # P2P Invoicing Dashboard
│   │   └── send-money/            # Direct Remittance Portal
│   ├── components/                # Modular UI Components (Navbar, Footer)
│   ├── config/                    # Global Configuration & Explorer Generators
│   ├── context/                   # Midnight Wallet React Context
│   ├── contracts/                 # Compact Client Wrappers
│   └── lib/
│       └── midnight-wallet/       # 1AM DApp Connector API Adapter & Helpers
├── .env.local                     # Environment Variables
├── package.json                   # Frontend Dependencies & Scripts
└── README.md                      # Production Documentation
```

---

## 🗺️ Roadmap

### Completed ✅
- [x] Midnight Preview Testnet integration via 1AM DApp Connector.
- [x] Canonical 64-character (32-byte) transaction hash extraction & block polling.
- [x] Direct 1AM Explorer deep-linking (`https://explorer.1am.xyz/tx/...`).
- [x] Persistent session auto-reconnection across browser refreshes.
- [x] Escrow and Recurring Billing Compact contract integration.
- [x] Full P2P Request Money & Shareable Invoice links (`/pay/[id]`).

### In Progress ⚙️
- [ ] Multi-token payment support for custom ZK assets on Midnight.
- [ ] Mobile responsive wallet connector view optimization.

### Future 🔮
- [ ] Mainnet deployment on Midnight Network launch.
- [ ] Multi-sig corporate treasury escrow vaults.

---

## 📄 License

This project is open-source software under the [MIT License](LICENSE).

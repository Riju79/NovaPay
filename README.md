# NovaPay 💸

NovaPay is a high-fidelity, decentralized cross-border remittance and payment portal. Powered by the **Stellar blockchain network**, NovaPay bypasses traditional intermediary banking overhead to settle international invoices, services, and business expenses in under 5 seconds with near-zero transaction fees.

NovaPay leverages **Soroban Smart Contracts** for trustless escrow agreements and pre-authorized recurring merchant billing.

---

## 🔗 Project Links & Resources

*   **Public GitHub Repository**: [https://github.com/Riju79/NovaPay](https://github.com/Riju79/NovaPay)
*   **Live Demo Link**: [https://novapay-remit.vercel.app](https://novapay-steel.vercel.app) *(Vercel Client)*
*   **Live Backend API**: [https://novapay-w4zv.onrender.com](https://novapay-w4zv.onrender.com) *(Render Host)*
*   **Demo Walkthrough Video (1–2 minutes)**: [Watch the Demo Video](https://youtu.be/SyGjRgLOz-I?si=NALjVZMkaTNyxD6G) *(Rickroll placeholder / Replace with actual video link)*

---

## 📜 Soroban Smart Contracts

NovaPay's core decentralized finance operations are backed by Soroban smart contracts compiled to WebAssembly (`.wasm`) and deployed to the Stellar Testnet.

### 1. Trustless Escrow Contract (`novapay-escrow`)
Allows payers to lock up USDC or XLM funds in a secure vault. The funds are only released to the recipient upon approval by the payer or an appointed arbiter. Paid funds can also be refunded back to the payer if canceled by the recipient or arbiter.
*   **Deployment Address**: `CA6K4WMGAL4KLNBVXSGHSSHE4TRGFZKXJG6P4MLTLYX2JYINBTRLTGWL`
*   **Contract Interaction Tx Hash**: `b3e52a0d0dbfe44c7bffb5381d1a4c2793ec00921c6e11e2001659adef7ae8a6`

### 2. Pre-Authorized Recurring Billing Contract (`recurring-billing`)
Allows payers to authorize a merchant (payee) to pull a fixed limit of tokens at periodic time intervals (e.g. 30-day billing cycle limit). The merchant triggers charges programmatically, and either party can cancel the plan at any time.
*   **Deployment Address**: `CBD43KTR6FUCF6HTHPTFZLAYVN3XAVELNXVUZKIZGSYXAZIB2A3EKM5Y`
*   **Contract Interaction Tx Hash**: `b60f01f1a265744c19849f730d527feec33aa4252b0131b52762b9561f03484f`

---

## 🚀 Key Features

*   **Freighter Wallet Integration**: Connect and authenticate securely using the Freighter browser extension on the Stellar Testnet.
*   **Auto-Account Provisioning**: Instant user profile and database registration on Freighter wallet connection.
*   **Live Balance Ledger**: Displays Freighter wallet public keys, native XLM balance, and USDC stablecoin balance fetched live from Stellar Horizon.
*   **Shareable Payment Links**: Generate custom persistent invoice links (in USDC/XLM) that payers can open to settle immediately without logging in.
*   **Peer-to-Peer Requests**: Create and send invoices from user to user, viewable in incoming/outgoing request feeds.
*   **Activity Audit Log & Notifications**: Real-time transaction logs coupled with system alerts and read/unread status updates.

---

## 📸 Platform Screenshots

### 1. Wallet Connected & Live Balance Display
The profile dashboard manages the authenticated user session and displays Freighter wallet node details, the linked public key, and the current active XLM balance fetched directly from the Stellar Horizon Testnet.

![Stellar Wallet Connected & Active Balance Display](/public/screenshots/wallet-connected.png)

### 2. Successful Testnet Transaction & Activity Alert Feed
The Activity Log dashboard provides real-time transaction tracking. It displays the history of sent and received remittances along with corresponding backend system alert notifications generated upon ledger confirmation.

![Successful Transaction & Activity Alert Feed](/public/screenshots/activity-log.png)

### 3. Mobile Responsive UI (Responsive Breakpoints)
The entire portal is optimized for standard screen sizes (Desktop, Tablet, and Mobile viewport grids).

*(Please add your custom mobile layout screenshot here as `/public/screenshots/mobile-responsive.png`)*

---

## ⚙️ CI/CD Pipeline & Tests

### 1. Automated GitHub Actions Workflow
The project includes a GitHub Actions pipeline configured in `.github/workflows/ci.yml` that triggers on every commit to verify:
*   Frontend Next.js production builds.
*   Backend database configurations and compilation.
*   Backend endpoint and contract simulator unit tests.

![CI/CD Pipeline Passing](https://github.com/Riju79/NovaPay/actions/workflows/ci.yml/badge.svg)

### 2. Unit Testing Suite (3+ Passing Tests)
We use the native Node.js test runner to execute lightweight, fast assertions on our business rules, status mappings, and payment limits.

Run the tests locally:
```bash
cd server
npm test
```

**Test Execution Output:**
```text
✔ Escrow Status Enum Values (2.3714ms)
✔ Escrow Initialization Amount Validation (1.0288ms)
✔ Recurring Billing Cycle Limits Check (0.3707ms)
ℹ tests 3
ℹ suites 0
ℹ pass 3
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 165.982
```

---

## 🛠️ Architecture & Tech Stack

*   **Frontend**: Next.js 16 (App Router), Tailwind CSS v4, Framer Motion, Lucide Icons
*   **Backend**: Node.js, Express, TypeScript, Prisma ORM, SQLite Database
*   **Blockchain Integration**: `@stellar/stellar-sdk`, `@stellar/freighter-api` (Horizon Testnet Submitter)
*   **Smart Contracts**: Rust, Soroban SDK

---

## 💻 Local Setup & Installation

Follow these steps to run NovaPay locally on your machine.

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18 or higher)
*   [Freighter Wallet Browser Extension](https://www.freighter.app/)

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/Riju79/NovaPay.git
cd NovaPay
```

---

### Step 2: Configure & Run the Backend Server
The backend service manages user authentication, profile data, transaction history caching, and notifications.

1.  Navigate to the server directory:
    ```bash
    cd server
    ```
2.  Install npm dependencies:
    ```bash
    npm install
    ```
3.  Initialize the SQLite database and sync schemas:
    ```bash
    npx prisma db push
    ```
4.  Start the Express development server (runs on port `5000`):
    ```bash
    npm run dev
    ```

---

### Step 3: Run the Next.js Frontend Client
1.  Open a new terminal and navigate to the project root directory:
    ```bash
    cd NovaPay
    ```
2.  Install client dependencies:
    ```bash
    npm install
    ```
3.  Start the Next.js development server (runs on port `3000`):
    ```bash
    npm run dev
    ```

---

### Step 4: Configure Freighter Wallet
1.  Open your **Freighter** extension.
2.  Go to **Settings** > **Network** and ensure it is set to **Test Net**.
3.  Open [http://localhost:3000](http://localhost:3000) in your browser, click **Connect Wallet**, and authorize the connection.
4.  If your test account is unfunded, go to your Profile and click **Fund Account** to receive test XLM.

# NovaPay 💸

NovaPay is a high-fidelity, decentralized cross-border remittance and tuition payment portal designed specifically for international students. Powered by the **Stellar blockchain network**, NovaPay bypasses traditional intermediary banking overhead to settle international tuition, accommodation rent, and book expenses in under 5 seconds with near-zero transaction fees.

---

## 🚀 Key Features

* **Freighter Wallet Integration**: Connect and authenticate securely using the Freighter browser extension on the Stellar Testnet.
* **Testnet Account Activation**: Check account ledger registration status and activate unfunded accounts instantly with a 10,000 XLM boost via Stellar Friendbot.
* **Peer-to-Peer Tuition Settlement**: Construct, sign, and dispatch payment transactions directly to the Horizon node.
* **Activity Log & System Alerts**: Audit transaction logs (sent and received payments) coupled with real-time backend success/failure notifications.
* **Transaction Receipt Modal**: Click any transaction log to view a detailed cryptographic receipt, copy the transaction hash, or view it live on the StellarExpert Explorer.
* **Payment Modes & Invoices**: Generate custom tuition invoices for parents or sponsors and execute path payments for direct settlement.

---

## 📸 Platform Screenshots

### 1. Wallet Connected & Live Balance Displayed
The profile dashboard manages the authenticated student session and displays Freighter wallet node details, the linked public key, and the current active XLM balance fetched directly from the Stellar Horizon Testnet.

![Stellar Wallet Connected & Active Balance Display](/public/screenshots/wallet-connected.png)

### 2. Successful Testnet Transaction & Live Results
The Activity Log dashboard provides real-time transaction tracking. It displays the history of sent and received remittances along with corresponding backend system alert notifications generated upon ledger confirmation.

![Successful Transaction & Activity Alert Feed](/public/screenshots/activity-log.png)

---

## 🛠️ Architecture & Tech Stack

* **Frontend**: Next.js 16 (App Router), Tailwind CSS v4, Framer Motion, Lucide Icons
* **Backend**: Node.js, Express, TypeScript, Prisma ORM, SQLite Database
* **Blockchain Integration**: `@stellar/stellar-sdk`, `@stellar/freighter-api` (Horizon Testnet Submitter)

---

## 💻 Local Setup & Installation

Follow these steps to run NovaPay locally on your machine.

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher)
* [Freighter Wallet Browser Extension](https://www.freighter.app/)

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/Riju79/NovaPay.git
cd NovaPay
```

---

### Step 2: Configure & Run the Backend Server
The backend service manages user authentication, profile data, transaction history caching, and notifications.

1. Navigate to the server directory:
   ```bash
   cd server
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Initialize the SQLite database and sync schemas:
   ```bash
   npx prisma db push
   ```
4. Start the Express development server (runs on port `5000`):
   ```bash
   npm run dev
   ```

---

### Step 3: Run the Next.js Frontend Client
1. Open a new terminal and navigate to the project root directory:
   ```bash
   cd NovaPay
   ```
2. Install client dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js development server (runs on port `3000`):
   ```bash
   npm run dev
   ```

---

### Step 4: Configure Freighter Wallet
1. Open your **Freighter** extension.
2. Go to **Settings** > **Network** and ensure it is set to **Test Net**.
3. Open [http://localhost:3000](http://localhost:3000) in your browser, click **Connect Wallet**, and authorize the connection.
4. If your test account is unfunded, go to your Profile and click **Fund Account** to receive test XLM.

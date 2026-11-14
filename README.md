# 🏦 UZU UNION BANK

**Secure Digital Banking Platform** — Multi-currency accounts, SWIFT GPI international transfers, crypto wallet with real market prices, and full admin panel.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![Prisma](https://img.shields.io/badge/Prisma-5-SQLite)
![Tailwind](https://img.shields.io/badge/Tailwind-3-cyan)

---

## ✨ Features

### 💰 Multi-Currency Banking
- 60+ currencies with live exchange rates
- Automatic currency adaptation based on user's country
- European users see amounts in EUR with proper locale formatting
- Checking & Savings accounts per currency

### 🌐 SWIFT GPI Transfers
- International wire transfers to 200+ countries
- Professional 2-step workflow (Details → Review & Confirm)
- Real-time exchange rate preview with fee calculation
- ISO 20022 compliant messaging

### ₿ Crypto Wallet
- 14 crypto assets with real market prices (via CoinGecko)
- Live price ticker with 24h change indicators
- Admin-managed deposit addresses
- Market cap & volume data

### 🔐 Security
- AES-256-GCM encryption
- Biometric multi-factor authentication
- JWT-based session management
- Rate-limited brute-force protection
- TLS 1.3 transport security

### 🛠️ Admin Panel
- User management & KYC verification
- Fund control (credit/debit any account)
- Transaction status management
- Crypto address management (14 presets)
- Real-time notifications

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/mrmolly90/uzu-union-bank.git
cd uzu-union-bank

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your values

# Generate Prisma client & push schema
npx prisma generate
npx prisma db push

# Seed demo data (optional)
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🏗️ Production Deployment

### Vercel (Recommended)

```bash
npm i -g vercel
vercel --prod
```

### Manual Deployment

```bash
npm run build
npm start
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

---

## 📁 Project Structure

```
uzu-union-bank/
├── prisma/              # Database schema & seeds
├── src/
│   ├── app/             # Next.js App Router pages
│   │   ├── (admin)/     # Admin panel
│   │   ├── (auth)/      # Login & Register
│   │   ├── (dashboard)/ # Dashboard & Transfer
│   │   └── api/         # API routes
│   ├── components/      # UI & layout components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities & helpers
│   ├── store/           # Zustand state stores
│   └── types/           # TypeScript types
├── server/              # Legacy Express server
└── public/              # Static assets
```

---

## 🧪 Test Accounts

| Role    | Email              | Password        |
|---------|--------------------|-----------------|
| Admin   | admin@uzu.com      | Admin123!       |
| User    | (register via UI)  | (your choice)   |

---

## 📄 License

Private — All rights reserved.

---

## 🤝 Support

- Email: support@uzudigitalunion.com
- Phone: +1 (800) UZU-BANK
- 24/7 Live Chat available in-app
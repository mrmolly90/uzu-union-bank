# =============================================================================
# UZU UNION BANK — Production Deployment Guide
# =============================================================================
# This file documents how to deploy the application to production.
# =============================================================================

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- A hosting provider (Vercel, Railway, Render, Fly.io, or any Node.js host)

## Quick Deploy (Vercel — Recommended)

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel --prod
   ```

4. Set environment variables in Vercel Dashboard:
   - `JWT_SECRET` — Generate with `openssl rand -base64 32`
   - `DATABASE_URL` — Use a PostgreSQL provider (see below)
   - `NEXT_PUBLIC_APP_URL` — Your production domain
   - `NEXT_PUBLIC_WS_URL` — WebSocket URL (if using real-time features)

## Database Setup

### Option 1: SQLite (Simple, single-server only)
- Default configuration works out of the box
- NOT recommended for production with multiple instances

### Option 2: PostgreSQL (Recommended for production)
1. Create a PostgreSQL database (Supabase, Neon, Railway, etc.)
2. Set `DATABASE_URL` in your hosting environment
3. Run migrations:
   ```bash
   npx prisma db push
   ```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Database connection string | Yes |
| `JWT_SECRET` | Secret for signing JWT tokens | Yes |
| `NEXT_PUBLIC_APP_URL` | Public URL of your app | Yes |
| `NEXT_PUBLIC_WS_URL` | WebSocket server URL | Optional |
| `NEXT_PUBLIC_SMARTSUPP_KEY` | SmartSupp chat widget key | Optional |

## Build for Production

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Build the application
npm run build

# Start the production server
npm start
```

## Deployment Platforms

### Vercel (easiest)
```bash
vercel --prod
```

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Manual (any Node.js host)
```bash
npm run build
npm start
```

## Post-Deployment Checklist

- [ ] Environment variables set correctly
- [ ] Database migrations applied
- [ ] JWT secret changed from default
- [ ] SSL/HTTPS enabled
- [ ] Domain DNS configured
- [ ] WebSocket server running (if applicable)
- [ ] Admin account created via seed script
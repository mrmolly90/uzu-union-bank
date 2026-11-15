import { NextRequest, NextResponse } from 'next/server';

const COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin' },
  { id: 'tether', symbol: 'USDT', name: 'Tether' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
  { id: 'uniswap', symbol: 'UNI', name: 'Uniswap' },
  { id: 'matic-network', symbol: 'MATIC', name: 'Polygon' },
  { id: 'cosmos', symbol: 'ATOM', name: 'Cosmos' },
];

export async function GET(request: NextRequest) {
  const currency = (request.nextUrl.searchParams.get('currency') || 'USD').toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) {
    return NextResponse.json({ error: 'Invalid currency.' }, { status: 400 });
  }

  const params = new URLSearchParams({
    ids: COINS.map((coin) => coin.id).join(','),
    vs_currencies: currency,
    include_24hr_change: 'true',
    include_market_cap: 'true',
    include_24hr_vol: 'true',
  });

  try {
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?${params}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });
    if (!response.ok) {
      return NextResponse.json({ error: 'Market quotes are temporarily unavailable.' }, { status: 502 });
    }

    const prices = await response.json();
    const quotes = COINS.flatMap((coin) => {
      const quote = prices[coin.id];
      const price = quote?.[currency];
      if (typeof price !== 'number' || !Number.isFinite(price)) return [];

      return [{
        ...coin,
        currency: currency.toUpperCase(),
        price,
        change24h: Number(quote[`${currency}_24h_change`] || 0),
        marketCap: Number(quote[`${currency}_market_cap`] || 0),
        volume24h: Number(quote[`${currency}_24h_vol`] || 0),
      }];
    });

    return NextResponse.json(quotes, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } });
  } catch {
    return NextResponse.json({ error: 'Market quotes are temporarily unavailable.' }, { status: 502 });
  }
}

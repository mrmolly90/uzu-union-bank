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
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin' },
  { id: 'stellar', symbol: 'XLM', name: 'Stellar' },
  { id: 'monero', symbol: 'XMR', name: 'Monero' },
  { id: 'eos', symbol: 'EOS', name: 'EOS' },
  { id: 'tron', symbol: 'TRX', name: 'TRON' },
  { id: 'tezos', symbol: 'XTZ', name: 'Tezos' },
  { id: 'vechain', symbol: 'VET', name: 'VeChain' },
  { id: 'filecoin', symbol: 'FIL', name: 'Filecoin' },
  { id: 'theta-token', symbol: 'THETA', name: 'Theta Network' },
  { id: 'aave', symbol: 'AAVE', name: 'Aave' },
  { id: 'maker', symbol: 'MKR', name: 'Maker' },
  { id: 'compound-governance-token', symbol: 'COMP', name: 'Compound' },
  { id: 'sushi', symbol: 'SUSHI', name: 'SushiSwap' },
  { id: 'crypto-com-chain', symbol: 'CRO', name: 'Cronos' },
  { id: 'near', symbol: 'NEAR', name: 'NEAR Protocol' },
  { id: 'hedera-hashgraph', symbol: 'HBAR', name: 'Hedera' },
  { id: 'algorand', symbol: 'ALGO', name: 'Algorand' },
  { id: 'internet-computer', symbol: 'ICP', name: 'Internet Computer' },
  { id: 'fetch-ai', symbol: 'FET', name: 'Fetch.ai' },
  { id: 'render-token', symbol: 'RNDR', name: 'Render' },
  { id: 'immutable-x', symbol: 'IMX', name: 'Immutable' },
  { id: 'gala', symbol: 'GALA', name: 'GALA' },
  { id: 'decentraland', symbol: 'MANA', name: 'Decentraland' },
  { id: 'the-sandbox', symbol: 'SAND', name: 'The Sandbox' },
  { id: 'axie-infinity', symbol: 'AXS', name: 'Axie Infinity' },
  { id: 'flow', symbol: 'FLOW', name: 'Flow' },
  { id: 'enjincoin', symbol: 'ENJ', name: 'Enjin' },
  { id: 'basic-attention-token', symbol: 'BAT', name: 'Basic Attention Token' },
  { id: 'zcash', symbol: 'ZEC', name: 'Zcash' },
  { id: 'dash', symbol: 'DASH', name: 'Dash' },
  { id: 'neo', symbol: 'NEO', name: 'Neo' },
  { id: 'iota', symbol: 'MIOTA', name: 'IOTA' },
  { id: 'waves', symbol: 'WAVES', name: 'Waves' },
  { id: 'ontology', symbol: 'ONT', name: 'Ontology' },
  { id: 'qtum', symbol: 'QTUM', name: 'Qtum' },
  { id: 'zilliqa', symbol: 'ZIL', name: 'Zilliqa' },
  { id: 'siacoin', symbol: 'SC', name: 'Siacoin' },
  { id: '0x', symbol: 'ZRX', name: '0x' },
  { id: 'loopring', symbol: 'LRC', name: 'Loopring' },
  { id: 'yearn-finance', symbol: 'YFI', name: 'yearn.finance' },
  { id: 'curve-dao-token', symbol: 'CRV', name: 'Curve DAO' },
  { id: 'balancer', symbol: 'BAL', name: 'Balancer' },
  { id: '1inch', symbol: '1INCH', name: '1inch' },
  { id: 'pancakeswap', symbol: 'CAKE', name: 'PancakeSwap' },
  { id: 'the-graph', symbol: 'GRT', name: 'The Graph' },
  { id: 'arweave', symbol: 'AR', name: 'Arweave' },
  { id: 'convex-finance', symbol: 'CVX', name: 'Convex Finance' },
  { id: 'fantom', symbol: 'FTM', name: 'Fantom' },
  { id: 'harmony', symbol: 'ONE', name: 'Harmony' },
  { id: 'elrond-erd-2', symbol: 'EGLD', name: 'MultiversX' },
  { id: 'celo', symbol: 'CELO', name: 'Celo' },
  { id: 'kusama', symbol: 'KSM', name: 'Kusama' },
  { id: 'bitcoin-cash', symbol: 'BCH', name: 'Bitcoin Cash' },
  { id: 'stellar', symbol: 'XLM', name: 'Stellar' },
  { id: 'ethereum-classic', symbol: 'ETC', name: 'Ethereum Classic' },
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

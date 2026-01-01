/**
 * Polymarket Historical Data Extractor
 *
 * Fetches market data from Polymarket's public APIs for Sooth simulation.
 *
 * Usage:
 *   bun run script/polymarket/fetch-market-data.ts [--market <slug>] [--days <n>]
 *
 * Examples:
 *   bun run script/polymarket/fetch-market-data.ts --market fed-decreases-interest-rates-by-50-bps-january-2026
 *   bun run script/polymarket/fetch-market-data.ts --top 5 --days 30
 */

import * as fs from 'fs';
import * as path from 'path';

// API Endpoints
const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';

// Types
interface PolymarketToken {
  token_id: string;
  outcome: string;
  price: number;
  winner: boolean;
}

interface PolymarketMarketRaw {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  resolutionSource: string;
  endDate: string;
  liquidity: string;
  volume: string;
  volume24hr: number;
  // These may come as JSON strings from API
  clobTokenIds: string[] | string;
  outcomePrices: string[] | string;
  outcomes: string[] | string;
  active: boolean;
  closed: boolean;
  tokens: PolymarketToken[];
}

interface PolymarketMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  resolutionSource: string;
  endDate: string;
  liquidity: string;
  volume: string;
  volume24hr: number;
  clobTokenIds: string[];
  outcomePrices: string[];
  outcomes: string[];
  active: boolean;
  closed: boolean;
  tokens: PolymarketToken[];
}

interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  volume: number;
  liquidity: number;
  markets: PolymarketMarket[];
}

interface PricePoint {
  t: number;  // Unix timestamp
  p: string;  // Price (0-1)
}

interface MarketPriceHistory {
  tokenId: string;
  outcome: string;
  history: PricePoint[];
}

interface SoothSimulationData {
  source: 'polymarket';
  fetchedAt: string;
  market: {
    question: string;
    slug: string;
    conditionId: string;
    endDate: string;
    volume: string;
    liquidity: string;
    outcomes: string[];
  };
  priceHistory: {
    outcome: string;
    tokenId: string;
    dataPoints: Array<{
      timestamp: number;
      price: number;
    }>;
  }[];
  // Derived simulation params
  simulation: {
    initialPrices: { yes: number; no: number };
    volatility: number;  // Std dev of price changes
    avgTradesPerDay: number;
    priceRange: { min: number; max: number };
  };
}

// Parse JSON string or return array as-is
function parseJsonArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Normalize raw market data from API
function normalizeMarket(raw: PolymarketMarketRaw): PolymarketMarket {
  return {
    ...raw,
    clobTokenIds: parseJsonArray(raw.clobTokenIds),
    outcomePrices: parseJsonArray(raw.outcomePrices),
    outcomes: parseJsonArray(raw.outcomes),
  };
}

// Fetch helpers
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

// Fetch top markets by volume
async function fetchTopMarkets(limit: number = 10): Promise<PolymarketMarket[]> {
  const url = `${GAMMA_API}/markets?active=true&order=volume24hr&ascending=false&limit=${limit}`;
  console.log(`Fetching top ${limit} markets...`);
  const raw = await fetchJson<PolymarketMarketRaw[]>(url);
  return raw.map(normalizeMarket);
}

// Fetch market by slug
async function fetchMarketBySlug(slug: string): Promise<PolymarketMarket | null> {
  const url = `${GAMMA_API}/markets?slug=${encodeURIComponent(slug)}`;
  const raw = await fetchJson<PolymarketMarketRaw[]>(url);
  return raw[0] ? normalizeMarket(raw[0]) : null;
}

// Fetch market by condition ID
async function fetchMarketByConditionId(conditionId: string): Promise<PolymarketMarket | null> {
  const url = `${GAMMA_API}/markets?condition_ids=${encodeURIComponent(conditionId)}`;
  const raw = await fetchJson<PolymarketMarketRaw[]>(url);
  return raw[0] ? normalizeMarket(raw[0]) : null;
}

// Fetch events with markets
async function fetchTopEvents(limit: number = 5): Promise<PolymarketEvent[]> {
  const url = `${GAMMA_API}/events?active=true&order=volume&ascending=false&limit=${limit}`;
  console.log(`Fetching top ${limit} events...`);
  return fetchJson<PolymarketEvent[]>(url);
}

// Fetch price history for a token
async function fetchPriceHistory(
  tokenId: string,
  interval: '1m' | '5m' | '1h' | '1d' | 'max' = 'max',
  fidelity: number = 60
): Promise<PricePoint[]> {
  // Validate token ID (should be numeric string)
  if (!tokenId || !/^\d+$/.test(tokenId)) {
    console.warn(`    Invalid token ID: ${tokenId?.slice(0, 30)}`);
    return [];
  }

  const url = `${CLOB_API}/prices-history?market=${tokenId}&interval=${interval}&fidelity=${fidelity}`;

  try {
    const data = await fetchJson<{ history: PricePoint[] }>(url);
    return data.history || [];
  } catch (error) {
    console.warn(`    Failed to fetch price history: ${(error as Error).message}`);
    return [];
  }
}

// Calculate simulation parameters from price history
function calculateSimulationParams(priceHistory: PricePoint[]): {
  volatility: number;
  avgTradesPerDay: number;
  priceRange: { min: number; max: number };
} {
  if (priceHistory.length < 2) {
    return { volatility: 0.1, avgTradesPerDay: 100, priceRange: { min: 0, max: 1 } };
  }

  const prices = priceHistory.map(p => parseFloat(p.p));
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  // Calculate returns
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }

  // Volatility = std dev of returns
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance);

  // Estimate trades per day from data density
  const firstTs = priceHistory[0].t;
  const lastTs = priceHistory[priceHistory.length - 1].t;
  const daysSpan = (lastTs - firstTs) / 86400;
  const avgTradesPerDay = daysSpan > 0 ? priceHistory.length / daysSpan : 100;

  return {
    volatility: Math.max(0.01, volatility),
    avgTradesPerDay: Math.round(avgTradesPerDay),
    priceRange: { min, max },
  };
}

// Build Sooth simulation data from Polymarket data
async function buildSimulationData(market: PolymarketMarket): Promise<SoothSimulationData> {
  console.log(`\nBuilding simulation data for: ${market.question}`);
  console.log(`  Condition ID: ${market.conditionId}`);
  console.log(`  Volume: $${parseFloat(market.volume).toLocaleString()}`);
  console.log(`  Token IDs: ${market.clobTokenIds.length} tokens`);

  const priceHistories: MarketPriceHistory[] = [];

  // Fetch price history for each token (YES and NO)
  for (let i = 0; i < market.clobTokenIds.length; i++) {
    const tokenId = market.clobTokenIds[i];
    const outcome = market.outcomes?.[i] || (i === 0 ? 'Yes' : 'No');

    console.log(`  Fetching ${outcome} token: ${tokenId.slice(0, 30)}...`);
    const history = await fetchPriceHistory(tokenId, 'max');
    priceHistories.push({
      tokenId,
      outcome,
      history,
    });

    console.log(`    → ${history.length} data points`);
  }

  // Get initial prices from current market state
  const yesPrice = parseFloat(market.outcomePrices?.[0] || '0.5');
  const noPrice = parseFloat(market.outcomePrices?.[1] || '0.5');

  // Calculate simulation params from YES token history
  const yesHistory = priceHistories.find(h => h.outcome.toLowerCase() === 'yes')?.history || [];
  const simParams = calculateSimulationParams(yesHistory);

  return {
    source: 'polymarket',
    fetchedAt: new Date().toISOString(),
    market: {
      question: market.question,
      slug: market.slug,
      conditionId: market.conditionId,
      endDate: market.endDate,
      volume: market.volume,
      liquidity: market.liquidity,
      outcomes: market.outcomes || ['Yes', 'No'],
    },
    priceHistory: priceHistories.map(ph => ({
      outcome: ph.outcome,
      tokenId: ph.tokenId,
      dataPoints: ph.history.map(h => ({
        timestamp: h.t,
        price: parseFloat(h.p),
      })),
    })),
    simulation: {
      initialPrices: { yes: yesPrice, no: noPrice },
      ...simParams,
    },
  };
}

// Save simulation data to file
function saveSimulationData(data: SoothSimulationData, outputDir: string): string {
  const filename = `${data.market.slug}-${Date.now()}.json`;
  const filepath = path.join(outputDir, filename);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

  return filepath;
}

// Print market summary
function printMarketSummary(market: PolymarketMarket, index?: number) {
  const prefix = index !== undefined ? `${index + 1}.` : '-';
  console.log(`${prefix} ${market.question}`);
  console.log(`   Slug: ${market.slug}`);
  console.log(`   Volume: $${parseFloat(market.volume).toLocaleString()}`);
  console.log(`   Liquidity: $${parseFloat(market.liquidity).toLocaleString()}`);
  console.log(`   Prices: Yes ${(parseFloat(market.outcomePrices?.[0] || '0') * 100).toFixed(1)}% / No ${(parseFloat(market.outcomePrices?.[1] || '0') * 100).toFixed(1)}%`);
  console.log(`   Active: ${market.active}, Closed: ${market.closed}`);
  console.log('');
}

// Main CLI
async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let marketSlug: string | null = null;
  let topN = 5;
  let outputDir = path.join(__dirname, '..', 'data', 'polymarket');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--market' && args[i + 1]) {
      marketSlug = args[++i];
    } else if (args[i] === '--top' && args[i + 1]) {
      topN = parseInt(args[++i]);
    } else if (args[i] === '--output' && args[i + 1]) {
      outputDir = args[++i];
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Polymarket Historical Data Extractor

Usage:
  bun run script/polymarket/fetch-market-data.ts [options]

Options:
  --market <slug>    Fetch specific market by slug
  --top <n>          List top N markets by volume (default: 5)
  --output <dir>     Output directory for JSON files
  --help             Show this help

Examples:
  # List top 10 markets
  bun run script/polymarket/fetch-market-data.ts --top 10

  # Fetch specific market data
  bun run script/polymarket/fetch-market-data.ts --market presidential-election-winner-2028

  # Fetch and save to custom directory
  bun run script/polymarket/fetch-market-data.ts --market some-market --output ./data
      `);
      return;
    }
  }

  console.log('='.repeat(60));
  console.log('Polymarket Data Extractor for Sooth Simulation');
  console.log('='.repeat(60));
  console.log('');

  if (marketSlug) {
    // Fetch specific market
    console.log(`Looking up market: ${marketSlug}`);
    const market = await fetchMarketBySlug(marketSlug);

    if (!market) {
      console.error(`Market not found: ${marketSlug}`);
      process.exit(1);
    }

    printMarketSummary(market);

    // Build simulation data
    const simData = await buildSimulationData(market);

    // Save to file
    const filepath = saveSimulationData(simData, outputDir);
    console.log(`\nSaved simulation data to: ${filepath}`);

    // Print summary
    console.log('\nSimulation Parameters:');
    console.log(`  Initial Prices: YES=${(simData.simulation.initialPrices.yes * 100).toFixed(1)}%, NO=${(simData.simulation.initialPrices.no * 100).toFixed(1)}%`);
    console.log(`  Volatility: ${(simData.simulation.volatility * 100).toFixed(2)}%`);
    console.log(`  Avg Trades/Day: ${simData.simulation.avgTradesPerDay}`);
    console.log(`  Price Range: ${(simData.simulation.priceRange.min * 100).toFixed(1)}% - ${(simData.simulation.priceRange.max * 100).toFixed(1)}%`);
    console.log(`  Data Points: ${simData.priceHistory.reduce((sum, h) => sum + h.dataPoints.length, 0)}`);

  } else {
    // List top markets
    const markets = await fetchTopMarkets(topN);

    console.log(`Top ${topN} Active Markets by 24h Volume:\n`);

    for (let i = 0; i < markets.length; i++) {
      printMarketSummary(markets[i], i);
    }

    console.log('-'.repeat(60));
    console.log('To fetch data for a specific market, run:');
    console.log(`  bun run script/polymarket/fetch-market-data.ts --market <slug>`);
  }
}

main().catch(console.error);

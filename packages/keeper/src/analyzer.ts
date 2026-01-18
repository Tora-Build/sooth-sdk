import type { Address } from 'viem';
import type { RangeOrder, SpotSellOrder, ArbitrageOpportunity } from './types.js';
import { WAD } from './config.js';

function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

function calculateRestingShares(order: RangeOrder | SpotSellOrder): bigint {
  return order.sharesTotal - order.filledShares;
}

const MIN_SAFE_TICK = 10;
const MAX_SAFE_TICK = 990;

function tickToPrice(tick: number): bigint {
  return (BigInt(tick) * WAD) / 1000n;
}

export function findArbitrageOpportunities(
  orders: RangeOrder[],
  spotSells: SpotSellOrder[],
  keeperAddress?: Address
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

  const filteredSells = keeperAddress
    ? spotSells.filter(s => s.owner.toLowerCase() !== keeperAddress.toLowerCase())
    : spotSells;

  opportunities.push(...findOpportunitiesForOutcome(orders, filteredSells, 1));
  opportunities.push(...findOpportunitiesForOutcome(orders, filteredSells, 0));

  return opportunities.sort((a, b) => {
    const spreadDiff = b.spread - a.spread;
    if (spreadDiff !== 0) return spreadDiff;
    return Number(b.estimatedProfitWad - a.estimatedProfitWad);
  });
}

function findOpportunitiesForOutcome(
  orders: RangeOrder[],
  spotSells: SpotSellOrder[],
  outcome: number
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

  const buys = orders
    .filter(o => o.outcome === outcome && o.active && calculateRestingShares(o) > 0n)
    .sort((a, b) => a.tickLower - b.tickLower);

  const sells = spotSells
    .filter(s => s.outcome === outcome && s.active && calculateRestingShares(s) > 0n && s.tickLower >= MIN_SAFE_TICK && s.tickLower <= MAX_SAFE_TICK)
    .sort((a, b) => a.tickLower - b.tickLower);

  if (buys.length === 0 || sells.length === 0) return opportunities;

  for (const sell of sells) {
    const sellTick = sell.tickLower;
    const sellRestingShares = calculateRestingShares(sell);

    for (const buy of buys) {
      if (sellTick >= buy.tickLower) continue;

      const buyRestingShares = calculateRestingShares(buy);
      const spread = buy.tickLower - sellTick;
      const maxShares = min(buyRestingShares, sellRestingShares);

      const buyPriceWad = tickToPrice(buy.tickLower);
      const sellPriceWad = tickToPrice(sellTick);
      const estimatedProfitWad = ((buyPriceWad - sellPriceWad) * maxShares) / WAD;

      opportunities.push({
        buyOrder: buy,
        sellSource: sell,
        buyPrice: buy.tickLower,
        sellPrice: sellTick,
        spread,
        maxShares,
        estimatedProfitWad,
      });
    }
  }

  return opportunities;
}

export function formatOpportunity(opp: ArbitrageOpportunity): string {
  const side = opp.buyOrder.outcome === 1 ? 'YES' : 'NO';
  const spreadPct = (opp.spread / 10).toFixed(1);
  const shares = Number(opp.maxShares) / 1e18;
  const profit = Number(opp.estimatedProfitWad) / 1e18;
  
  return `${side} | Spread: ${spreadPct}% | Shares: ${shares.toFixed(2)} | Est. Profit: ${profit.toFixed(4)} USDC`;
}

export function filterProfitableOpportunities(
  opportunities: ArbitrageOpportunity[],
  minProfitWad: bigint
): ArbitrageOpportunity[] {
  return opportunities.filter(opp => opp.estimatedProfitWad >= minProfitWad);
}

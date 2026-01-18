import type { RangeOrder, SpotSellOrder, ArbitrageOpportunity } from './types.js';
import { WAD } from './config.js';

function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

function calculateRestingShares(order: RangeOrder | SpotSellOrder): bigint {
  return order.sharesTotal - order.filledShares;
}

function tickToPrice(tick: number): bigint {
  return (BigInt(tick) * WAD) / 1000n;
}

export function findArbitrageOpportunities(
  orders: RangeOrder[],
  spotSells: SpotSellOrder[]
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

  const yesBuys = orders.filter(o => o.outcome === 1 && o.active);
  const yesSells = spotSells.filter(s => s.outcome === 1 && s.active);

  for (const buy of yesBuys) {
    const buyRestingShares = calculateRestingShares(buy);
    if (buyRestingShares <= 0n) continue;

    for (const sell of yesSells) {
      const sellRestingShares = calculateRestingShares(sell);
      if (sellRestingShares <= 0n) continue;

      const sellAskTick = sell.tickLower;
      
      if (sellAskTick < buy.tickLower) {
        const spread = buy.tickLower - sellAskTick;
        const maxShares = min(buyRestingShares, sellRestingShares);
        
        const buyPriceWad = tickToPrice(buy.tickLower);
        const sellPriceWad = tickToPrice(sellAskTick);
        const estimatedProfitWad = ((buyPriceWad - sellPriceWad) * maxShares) / WAD;

        opportunities.push({
          buyOrder: buy,
          sellSource: sell,
          buyPrice: buy.tickLower,
          sellPrice: sellAskTick,
          spread,
          maxShares,
          estimatedProfitWad,
        });
      }
    }
  }

  const noBuys = orders.filter(o => o.outcome === 0 && o.active);
  const noSells = spotSells.filter(s => s.outcome === 0 && s.active);

  for (const buy of noBuys) {
    const buyRestingShares = calculateRestingShares(buy);
    if (buyRestingShares <= 0n) continue;

    for (const sell of noSells) {
      const sellRestingShares = calculateRestingShares(sell);
      if (sellRestingShares <= 0n) continue;

      const sellAskTick = sell.tickLower;
      
      if (sellAskTick < buy.tickLower) {
        const spread = buy.tickLower - sellAskTick;
        const maxShares = min(buyRestingShares, sellRestingShares);
        
        const buyPriceWad = tickToPrice(buy.tickLower);
        const sellPriceWad = tickToPrice(sellAskTick);
        const estimatedProfitWad = ((buyPriceWad - sellPriceWad) * maxShares) / WAD;

        opportunities.push({
          buyOrder: buy,
          sellSource: sell,
          buyPrice: buy.tickLower,
          sellPrice: sellAskTick,
          spread,
          maxShares,
          estimatedProfitWad,
        });
      }
    }
  }

  return opportunities.sort((a, b) => 
    Number(b.estimatedProfitWad - a.estimatedProfitWad)
  );
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

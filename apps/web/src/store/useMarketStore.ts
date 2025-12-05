import { create } from 'zustand';
import { Market, Pool } from '../types';
import marketsConfig from '../config/markets.json';

interface MarketState {
  mode: 'real' | 'demo';
  markets: Market[];
  
  // Actions
  setMode: (mode: 'real' | 'demo') => void;
  updateMarket: (marketId: string, updates: Partial<Market>) => void;
}

import marketOverrides from '../config/marketOverrides.json';

// Initial Demo Data
const initialDemoMarkets: Market[] = marketsConfig.markets.map(m => {
  // Apply overrides if they exist for this market ID
  const override = (marketOverrides.overrides as Record<string, any>)[m.id] || {};
  const mergedMarket = { ...m, ...override };

  // Only process demo markets for bParam calculation
  if ((mergedMarket as any).mode !== 'demo') {
    return mergedMarket as Market;
  }

  const initialYes = (mergedMarket as any).initialYes || 0.5;
  const initialNo = 1 - initialYes;
  
  // Base Liquidity (risk-adjusted allocation)
  const baseLiquidity = (mergedMarket as any).baseLiquidity ? BigInt((mergedMarket as any).baseLiquidity) : 
            ((mergedMarket as any).riskLevel === 'HIGH' ? 50000n * 10n**18n : 
            (mergedMarket as any).riskLevel === 'MEDIUM' ? 25000n * 10n**18n : 
            10000n * 10n**18n); // LOW or default
  
  // Reserve Calculation
  // For BTC (id: 'm1') and UN confirms alien life (id: 'm3') markets, start with 0 reserve (fresh market)
  // For others, simulate 5% accumulated profit
  const isFreshMarket = m.id === 'm1' || m.id === 'm3';
  const reserve = isFreshMarket ? 0n : (baseLiquidity * 5n / 100n);
  
  // Total Liquidity: b = Base + Reserve
  const bParam = baseLiquidity + reserve;
  
  const b = Number(bParam) / 1e18;
  
  // Calculate qYes and qNo from initial prices using LMSR: q = b * ln(price)
  // Clamp to avoid Math.log(0) = -Infinity
  const clampedYes = Math.max(0.001, Math.min(0.999, initialYes));
  const clampedNo = Math.max(0.001, Math.min(0.999, initialNo));
  const qYes = BigInt(Math.round(b * Math.log(clampedYes) * 1e18));
  const qNo = BigInt(Math.round(b * Math.log(clampedNo) * 1e18));

  return {
    ...mergedMarket,
    status: (mergedMarket as any).initialStatus || 'trading',
    priceYes: initialYes,
    priceNo: initialNo,
    qYes,
    qNo,
    bParam,
    baseLiquidity,
    reserve,
    userYesShares: 0,
    userNoShares: 0,
    userAvgEntryYes: null,
    userAvgEntryNo: null,
    winningOutcome: (mergedMarket as any).winningOutcome,
    mode: (mergedMarket as any).mode || 'demo', // Preserve mode from config
  } as Market;
});

export const useMarketStore = create<MarketState>((set) => ({
  mode: 'demo',
  markets: initialDemoMarkets,
  
  setMode: (mode) => set({ mode }),
  
  updateMarket: (marketId, updates) => set((state) => ({
    markets: state.markets.map(m => 
      m.id === marketId ? { ...m, ...updates } : m
    )
  })),
}));

/**
 * useSandbox - Sandbox mode hook for practice trading
 * 
 * Simulates trades without blockchain interaction.
 * Uses the same LMSR formulas as the real contracts.
 */
import { useState, useCallback } from 'react';

// WAD precision (18 decimals)
const WAD = 10n ** 18n;

interface SandboxPosition {
  market: string;
  yesShares: bigint;
  noShares: bigint;
  costBasis: bigint;
}

interface SandboxTrade {
  market: string;
  isYes: boolean;
  shares: bigint;
  cost: bigint;
  timestamp: number;
}

interface SandboxMarketState {
  qYes: bigint;
  qNo: bigint;
  bBase: bigint;
}

interface SandboxState {
  enabled: boolean;
  balance: bigint;
  positions: Map<string, SandboxPosition>;
  trades: SandboxTrade[];
  markets: Map<string, SandboxMarketState>;
}

// LMSR cost function: C(q) = b * ln(e^(qYes/b) + e^(qNo/b))
const lmsrCost = (qYes: bigint, qNo: bigint, b: bigint): bigint => {
  // Simplified calculation for JavaScript (lose some precision but works for sandbox)
  const qYesNum = Number(qYes) / 1e18;
  const qNoNum = Number(qNo) / 1e18;
  const bNum = Number(b) / 1e18;
  
  const cost = bNum * Math.log(Math.exp(qYesNum / bNum) + Math.exp(qNoNum / bNum));
  return BigInt(Math.floor(cost * 1e18));
};

// Calculate price for an outcome: p = e^(q/b) / (e^(qYes/b) + e^(qNo/b))
const lmsrPrice = (qYes: bigint, qNo: bigint, b: bigint, isYes: boolean): number => {
  const qYesNum = Number(qYes) / 1e18;
  const qNoNum = Number(qNo) / 1e18;
  const bNum = Number(b) / 1e18;
  
  const q = isYes ? qYesNum : qNoNum;
  const numerator = Math.exp(q / bNum);
  const denominator = Math.exp(qYesNum / bNum) + Math.exp(qNoNum / bNum);
  
  return numerator / denominator;
};

// Default initial state
const defaultState: SandboxState = {
  enabled: true,
  balance: 10000n * WAD, // 10,000 USDC
  positions: new Map(),
  trades: [],
  markets: new Map(),
};

// Default market state (equal quantities)
const defaultMarketState: SandboxMarketState = {
  qYes: 1000n * WAD,
  qNo: 1000n * WAD,
  bBase: 1000n * WAD,
};

export const useSandbox = () => {
  const [state, setState] = useState<SandboxState>(defaultState);

  // Get or initialize market state
  const getMarketState = useCallback((market: string): SandboxMarketState => {
    return state.markets.get(market) || { ...defaultMarketState };
  }, [state.markets]);

  // Calculate quote for a trade
  const getQuote = useCallback((
    market: string,
    shares: bigint,
    isYes: boolean,
    isBuy: boolean
  ): { cost: bigint; newPrice: number; priceImpact: number } => {
    const marketState = getMarketState(market);
    const { qYes, qNo, bBase } = marketState;
    
    // Calculate old cost
    const oldCost = lmsrCost(qYes, qNo, bBase);
    
    // Calculate new quantities after trade
    let newQYes = qYes;
    let newQNo = qNo;
    
    if (isBuy) {
      if (isYes) {
        newQYes = qYes + shares;
      } else {
        newQNo = qNo + shares;
      }
    } else {
      if (isYes) {
        newQYes = qYes > shares ? qYes - shares : 0n;
      } else {
        newQNo = qNo > shares ? qNo - shares : 0n;
      }
    }
    
    // Calculate new cost
    const newCost = lmsrCost(newQYes, newQNo, bBase);
    
    // Cost is the difference
    const tradeCost = isBuy ? newCost - oldCost : oldCost - newCost;
    
    // Calculate new price
    const newPrice = lmsrPrice(newQYes, newQNo, bBase, isYes);
    const oldPrice = lmsrPrice(qYes, qNo, bBase, isYes);
    const priceImpact = Math.abs(newPrice - oldPrice) / oldPrice * 100;
    
    return {
      cost: tradeCost > 0n ? tradeCost : 0n,
      newPrice,
      priceImpact,
    };
  }, [getMarketState]);

  // Execute a simulated trade
  const simulateTrade = useCallback((
    market: string,
    shares: bigint,
    isYes: boolean,
    isBuy: boolean
  ): { success: boolean; receipt?: SandboxTrade; error?: string } => {
    const quote = getQuote(market, shares, isYes, isBuy);
    const cost = quote.cost;
    
    // Apply 5% fee
    const fee = (cost * 5n) / 100n;
    const totalCost = cost + fee;
    
    // Check balance for buys
    if (isBuy && totalCost > state.balance) {
      return { success: false, error: 'Insufficient balance' };
    }
    
    // Check position for sells
    if (!isBuy) {
      const position = state.positions.get(market);
      const currentShares = isYes ? (position?.yesShares ?? 0n) : (position?.noShares ?? 0n);
      if (shares > currentShares) {
        return { success: false, error: 'Insufficient shares' };
      }
    }
    
    // Update state
    setState(prev => {
      const newBalance = isBuy 
        ? prev.balance - totalCost 
        : prev.balance + cost;
      
      const newMarkets = new Map(prev.markets);
      const marketState = newMarkets.get(market) || { ...defaultMarketState };
      
      if (isBuy) {
        if (isYes) {
          marketState.qYes = marketState.qYes + shares;
        } else {
          marketState.qNo = marketState.qNo + shares;
        }
      } else {
        if (isYes) {
          marketState.qYes = marketState.qYes - shares;
        } else {
          marketState.qNo = marketState.qNo - shares;
        }
      }
      newMarkets.set(market, marketState);
      
      const newPositions = new Map(prev.positions);
      const position = newPositions.get(market) || {
        market,
        yesShares: 0n,
        noShares: 0n,
        costBasis: 0n,
      };
      
      if (isBuy) {
        if (isYes) {
          position.yesShares = position.yesShares + shares;
        } else {
          position.noShares = position.noShares + shares;
        }
        position.costBasis = position.costBasis + totalCost;
      } else {
        if (isYes) {
          position.yesShares = position.yesShares - shares;
        } else {
          position.noShares = position.noShares - shares;
        }
        // Reduce cost basis proportionally
        const totalShares = position.yesShares + position.noShares + shares;
        if (totalShares > 0n) {
          position.costBasis = (position.costBasis * (totalShares - shares)) / totalShares;
        }
      }
      newPositions.set(market, position);
      
      const trade: SandboxTrade = {
        market,
        isYes,
        shares,
        cost: totalCost,
        timestamp: Date.now(),
      };
      
      return {
        ...prev,
        balance: newBalance,
        positions: newPositions,
        markets: newMarkets,
        trades: [...prev.trades, trade],
      };
    });
    
    return {
      success: true,
      receipt: {
        market,
        isYes,
        shares,
        cost: totalCost,
        timestamp: Date.now(),
      },
    };
  }, [state.balance, state.positions, getQuote]);

  // Get current price for a market
  const getPrice = useCallback((market: string, isYes: boolean): number => {
    const marketState = getMarketState(market);
    return lmsrPrice(marketState.qYes, marketState.qNo, marketState.bBase, isYes);
  }, [getMarketState]);

  // Get position for a market
  const getPosition = useCallback((market: string): SandboxPosition | undefined => {
    return state.positions.get(market);
  }, [state.positions]);

  // Reset sandbox to default state
  const reset = useCallback(() => {
    setState(defaultState);
  }, []);

  // Toggle sandbox mode
  const toggle = useCallback(() => {
    setState(prev => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  // Format balance for display
  const balanceFormatted = (Number(state.balance) / 1e18).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return {
    // State
    enabled: state.enabled,
    balance: state.balance,
    balanceFormatted,
    positions: state.positions,
    trades: state.trades,
    
    // Actions
    getQuote,
    simulateTrade,
    getPrice,
    getPosition,
    reset,
    toggle,
    
    // Utils
    getMarketState,
  };
};

export default useSandbox;


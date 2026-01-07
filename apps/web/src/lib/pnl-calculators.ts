/**
 * P&L Calculation Utilities for Launchpad Simulator
 * 
 * Simplified formulas for instant UI updates.
 * All calculations use rounded approximations suitable for educational display.
 */

// ═══════════════════════════════════════════════════════════════════════════
//                              CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export const LN2 = 0.693147;
export const PRE_GRAD_FEE_RATE = 0.05; // 5%
export const POST_GRAD_FEE_RATE = 0.01; // 1%
export const BBASE_SHARE = 0.50; // 50% post-grad
export const LP_YIELD_SHARE = 0.30; // 30% post-grad
export const PROTOCOL_SHARE = 0.20; // 20% post-grad

// ═══════════════════════════════════════════════════════════════════════════
//                              TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface CreatorResult {
    deposit: number;
    lpTokens: number;
    graduationThreshold: number;
    preGradFees: number;
    postGradFees: number;
    totalFees: number;
    lpYieldEarned: number;
    isGraduated: boolean;
    floorValue: number;
    lpRedemptionValue: number;
    netPnL: number;
    roi: number;
    breakEvenVolume: number;
}

export interface GamingTraderResult {
    tradeSize: number;
    feePaid: number;
    lpTokensReceived: number;
    lpOwnershipPercent: number;
    lpValueAtEntry: number;
    lpValueAfterVolume: number;
    lpAppreciation: number;
    predictionPnL: number;
    netPnL: number;
    recoveryPercent: number; // How much of loss recovered via LP
    totalReturn: number;
}

export interface ArbitrageurResult {
    tradeSize: number;
    spreadPercent: number;
    grossProfit: number;
    gasCost: number;
    ammFee: number;
    totalCosts: number;
    netProfit: number;
    returnPercent: number;
    isProfitable: boolean;
    minViableSpread: number;
}

export interface PvPTraderResult {
    positionSize: number;
    entryPrice: number;
    sharesReceived: number;
    profitIfWin: number;
    lossIfWrong: number;
    estimatedWinProb: number;
    expectedValue: number;
    actualPnL: number;
    returnPercent: number;
}

// ═══════════════════════════════════════════════════════════════════════════
//                         CREATOR CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate Creator P&L based on deposit and volume
 * 
 * Simplified model:
 * - Deposit = b × ln(2) ≈ b × 0.693
 * - Graduation threshold = deposit (at multiplier = 1)
 * - Pre-grad fees go to bBase + LP to traders
 * - Post-grad fees split 50/30/20
 */
export function calculateCreatorPnL(
    liquidityTier: number, // The "b" value (e.g., 1000 for $1000 tier)
    totalVolume: number,
    settlementLiabilityPercent: number = 0.5 // 0-1, how much of max liability is realized
): CreatorResult {
    // Initial deposit calculation
    const deposit = Math.round(liquidityTier * LN2);
    const lpTokens = deposit; // 1:1 with deposit in WAD terms (simplified to dollars)
    const graduationThreshold = deposit;
    
    // Fee calculations
    const preGradVolume = Math.min(totalVolume, graduationThreshold / PRE_GRAD_FEE_RATE);
    const preGradFees = Math.round(preGradVolume * PRE_GRAD_FEE_RATE);
    const isGraduated = preGradFees >= graduationThreshold;
    
    const postGradVolume = isGraduated ? Math.max(0, totalVolume - preGradVolume) : 0;
    const postGradFees = Math.round(postGradVolume * POST_GRAD_FEE_RATE);
    const totalFees = preGradFees + postGradFees;
    
    // LP yield from post-grad fees (30% to LP holders)
    const lpYieldEarned = Math.round(postGradFees * LP_YIELD_SHARE);
    
    // Total cash in system
    const totalCash = deposit + totalFees;
    
    // Simplified liability: assume some percentage of max possible liability
    // In reality, this depends on qYes vs qNo outstanding
    const maxLiability = totalVolume * 0.3 * settlementLiabilityPercent; // Simplified estimate
    
    // Floor value calculation
    const floorValue = Math.max(0, Math.round(totalCash - maxLiability));
    
    // Creator gets their pro-rata share (they own 100% initially, diluted by trader LP)
    // Simplified: assume creator retains ~70% ownership after trader LP minting
    const creatorOwnershipPercent = Math.max(0.3, 1 - (preGradFees / (deposit + preGradFees)));
    const lpRedemptionValue = Math.round(floorValue * creatorOwnershipPercent);
    
    // Net P&L
    const netPnL = lpRedemptionValue - deposit;
    const roi = deposit > 0 ? (netPnL / deposit) * 100 : 0;
    
    // Break-even volume
    const breakEvenVolume = Math.round(deposit / PRE_GRAD_FEE_RATE);
    
    return {
        deposit,
        lpTokens,
        graduationThreshold,
        preGradFees,
        postGradFees,
        totalFees,
        lpYieldEarned,
        isGraduated,
        floorValue,
        lpRedemptionValue,
        netPnL,
        roi: Math.round(roi),
        breakEvenVolume
    };
}

// ═══════════════════════════════════════════════════════════════════════════
//                      GAMING TRADER CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate Gaming Trader P&L
 * 
 * Key insight: Fee → LP conversion provides asymmetric upside
 * - Win: +Payout + LP value
 * - Lose: -Stake + LP value (cushions loss)
 */
export function calculateGamingTraderPnL(
    tradeSize: number,
    isPreGraduation: boolean,
    isPredictionCorrect: boolean,
    volumeAfterEntry: number,
    currentMarketLPSupply: number = 10000 // Simplified default
): GamingTraderResult {
    // Fee calculation
    const feeRate = isPreGraduation ? PRE_GRAD_FEE_RATE : POST_GRAD_FEE_RATE;
    const feePaid = Math.round(tradeSize * feeRate);
    
    // LP tokens only minted during pre-graduation
    const lpTokensReceived = isPreGraduation ? feePaid : 0;
    
    // LP ownership percent (simplified)
    const lpOwnershipPercent = currentMarketLPSupply > 0 
        ? (lpTokensReceived / (currentMarketLPSupply + lpTokensReceived)) * 100 
        : 0;
    
    // LP value at entry
    const lpValueAtEntry = lpTokensReceived;
    
    // LP appreciation based on volume after entry
    // Simplified model: LP value grows ~linearly with volume due to fee accumulation
    // Assume ~5% of volume becomes LP value growth
    const lpGrowthFromVolume = volumeAfterEntry * 0.05;
    const lpAppreciationMultiplier = 1 + (lpGrowthFromVolume / Math.max(1, currentMarketLPSupply));
    const lpValueAfterVolume = Math.round(lpTokensReceived * Math.min(lpAppreciationMultiplier, 10)); // Cap at 10x
    const lpAppreciation = lpValueAfterVolume - lpValueAtEntry;
    
    // Prediction P&L (simplified: win = +tradeSize, lose = -tradeSize)
    const predictionPnL = isPredictionCorrect ? tradeSize : -tradeSize;
    
    // Net P&L
    const netPnL = predictionPnL + lpValueAfterVolume;
    
    // Recovery percent (only relevant when prediction is wrong)
    const recoveryPercent = !isPredictionCorrect && tradeSize > 0
        ? Math.round((lpValueAfterVolume / tradeSize) * 100)
        : 0;
    
    // Total return percent
    const totalReturn = tradeSize > 0 ? Math.round((netPnL / tradeSize) * 100) : 0;
    
    return {
        tradeSize,
        feePaid,
        lpTokensReceived,
        lpOwnershipPercent: Math.round(lpOwnershipPercent * 100) / 100,
        lpValueAtEntry,
        lpValueAfterVolume,
        lpAppreciation,
        predictionPnL,
        netPnL,
        recoveryPercent,
        totalReturn
    };
}

// ═══════════════════════════════════════════════════════════════════════════
//                       ARBITRAGEUR CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate Arbitrageur P&L
 * 
 * Arb captures spread between AMM and TickBook venues
 * Profit = Spread - Gas - AMM Fee
 */
export function calculateArbitrageurPnL(
    tradeSize: number,
    spreadPercent: number, // e.g., 0.04 for 4%
    gasCost: number,
    ammFeeRate: number = POST_GRAD_FEE_RATE // 1% default
): ArbitrageurResult {
    // Gross profit from spread
    const grossProfit = Math.round(tradeSize * spreadPercent);
    
    // AMM fee (charged on the sell side)
    const ammFee = Math.round(tradeSize * ammFeeRate);
    
    // Total costs
    const totalCosts = gasCost + ammFee;
    
    // Net profit
    const netProfit = grossProfit - totalCosts;
    
    // Return percent
    const returnPercent = tradeSize > 0 ? (netProfit / tradeSize) * 100 : 0;
    
    // Is it profitable?
    const isProfitable = netProfit > 0;
    
    // Minimum viable spread
    const minViableSpread = tradeSize > 0 
        ? ((gasCost + (tradeSize * ammFeeRate)) / tradeSize) * 100 
        : 0;
    
    return {
        tradeSize,
        spreadPercent: spreadPercent * 100, // Convert to percentage for display
        grossProfit,
        gasCost,
        ammFee,
        totalCosts,
        netProfit,
        returnPercent: Math.round(returnPercent * 100) / 100,
        isProfitable,
        minViableSpread: Math.round(minViableSpread * 100) / 100
    };
}

// ═══════════════════════════════════════════════════════════════════════════
//                        PVP TRADER CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate PvP Trader P&L
 * 
 * Pure binary outcome: Win = shares × $1, Lose = $0
 * No LP safety net - winner takes all
 */
export function calculatePvPTraderPnL(
    positionSize: number,
    entryPrice: number, // e.g., 0.35 for 35%
    estimatedWinProb: number, // Trader's belief, e.g., 0.6 for 60%
    outcome: 'win' | 'lose' | 'expected'
): PvPTraderResult {
    // Shares received
    const sharesReceived = entryPrice > 0 ? Math.round(positionSize / entryPrice) : 0;
    
    // Profit if win (shares pay $1 each)
    const profitIfWin = sharesReceived - positionSize;
    
    // Loss if wrong
    const lossIfWrong = -positionSize;
    
    // Expected value
    const expectedValue = Math.round(
        (estimatedWinProb * profitIfWin) + ((1 - estimatedWinProb) * lossIfWrong)
    );
    
    // Actual P&L based on outcome
    let actualPnL: number;
    if (outcome === 'win') {
        actualPnL = profitIfWin;
    } else if (outcome === 'lose') {
        actualPnL = lossIfWrong;
    } else {
        actualPnL = expectedValue;
    }
    
    // Return percent
    const returnPercent = positionSize > 0 ? (actualPnL / positionSize) * 100 : 0;
    
    return {
        positionSize,
        entryPrice,
        sharesReceived,
        profitIfWin,
        lossIfWrong,
        estimatedWinProb,
        expectedValue,
        actualPnL,
        returnPercent: Math.round(returnPercent)
    };
}

// ═══════════════════════════════════════════════════════════════════════════
//                           HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format currency for display
 */
export function formatCurrency(value: number, showSign: boolean = false): string {
    const absValue = Math.abs(value);
    const formatted = absValue >= 1000 
        ? `$${(absValue / 1000).toFixed(1)}k`
        : `$${absValue.toLocaleString()}`;
    
    if (showSign && value !== 0) {
        return value > 0 ? `+${formatted}` : `-${formatted.replace('$', '')}`;
    }
    return formatted;
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number, showSign: boolean = false): string {
    const formatted = `${Math.abs(value).toFixed(1)}%`;
    if (showSign && value !== 0) {
        return value > 0 ? `+${formatted}` : `-${formatted}`;
    }
    return formatted;
}

/**
 * Get liquidity tier info
 */
export function getLiquidityTier(deposit: number): { name: string; b: number; threshold: number } {
    if (deposit <= 100) return { name: 'Micro', b: 100, threshold: 69 };
    if (deposit <= 1000) return { name: 'Small', b: 1000, threshold: 693 };
    if (deposit <= 10000) return { name: 'Medium', b: 10000, threshold: 6930 };
    return { name: 'Large', b: 100000, threshold: 69300 };
}

/**
 * Calculate deposit required for a given liquidity tier
 */
export function calculateDeposit(liquidityTier: number): number {
    return Math.round(liquidityTier * LN2);
}

/**
 * Calculate graduation threshold for a given deposit
 */
export function calculateGraduationThreshold(deposit: number, multiplier: number = 1): number {
    return Math.round(deposit * multiplier);
}

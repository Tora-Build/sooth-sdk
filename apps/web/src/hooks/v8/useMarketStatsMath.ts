/**
 * Market Stats Math Hook
 * 
 * LMSR Accounting Model:
 * - Gross Cash = C(qYes, qNo, bCurrent) = the LMSR cost function value
 *   This represents the total cash in the AMM system
 * - Liability = max(qYes, qNo) = worst-case payout to traders
 * - Floor = Gross - Liability = LP's guaranteed minimum equity
 * - Ceiling = Gross - min(qYes, qNo) = LP's best-case equity
 * 
 * Note: We don't try to decompose Gross into "Seed + Fees + P&L" because
 * with dynamic b (liquidity grows via fee reinvestment), the cost function
 * changes non-linearly and such decomposition becomes meaningless.
 */
import { useMemo } from 'react';
import { formatUnits, parseUnits } from 'viem';

// Types from our other hooks
interface LaunchpadData {
    creatorDeposit: bigint;
    feesAccrued: bigint;
    lpYieldPool: bigint;
    lpSupply: bigint;
    currentBBase: bigint;
    initialBBase: bigint;
    floorValue?: bigint;
}

interface AMMStateData {
    qYes: bigint;
    qNo: bigint;
}

const LN2 = 0.693147180559945309;

// Stable log-sum-exp LMSR cost function: C(q) = b * ln(e^(qYes/b) + e^(qNo/b))
function calculateLMSRCost(qYes: bigint, qNo: bigint, b: bigint): number {
    if (b === 0n) return 0;
    const bNum = Number(formatUnits(b, 18));
    const qYesNum = Number(formatUnits(qYes, 18));
    const qNoNum = Number(formatUnits(qNo, 18));
    
    // At (0, 0): C = b * ln(2) = creator deposit
    if (qYesNum === 0 && qNoNum === 0) {
        return bNum * LN2;
    }
    
    // Stable Log-Sum-Exp: ln(e^x + e^y) = max(x, y) + ln(1 + e^(-|x-y|))
    const x = qYesNum / bNum;
    const y = qNoNum / bNum;
    const max = x > y ? x : y;
    const diff = Math.abs(x - y);
    
    return bNum * (max + Math.log(1 + Math.exp(-diff)));
}

export const useMarketStatsMath = (launchpad: LaunchpadData | undefined, ammState: AMMStateData | undefined, usdcDecimals: number = 18) => {
    return useMemo(() => {
        if (!launchpad || !ammState) return null;

        // Scale factors
        const usdcFactor = BigInt(10 ** usdcDecimals);
        const wad = 1_000_000_000_000_000_000n;

        const seed = launchpad.creatorDeposit; 
        const fees = launchpad.feesAccrued;    
        const yield_ = launchpad.lpYieldPool;  
        
        const bCurrent = launchpad.currentBBase;
        const bBase = launchpad.initialBBase;      
        const rawQYes = ammState.qYes;         
        const rawQNo = ammState.qNo;           

        // 1. Gross Cash = LMSR Cost Function Value
        // This is the total cash in the AMM system: C(qYes, qNo, bCurrent)
        const grossNum = calculateLMSRCost(rawQYes, rawQNo, bCurrent);
        const gross = parseUnits(grossNum.toFixed(usdcDecimals), usdcDecimals);

        // 2. Liability = max(qYes, qNo) - worst case payout
        const qYesUsdc = usdcDecimals === 18 ? rawQYes : rawQYes / (wad / usdcFactor);
        const qNoUsdc = usdcDecimals === 18 ? rawQNo : rawQNo / (wad / usdcFactor);
        const liability = qYesUsdc > qNoUsdc ? qYesUsdc : qNoUsdc;

        // 3. Floor = Gross - max(qYes, qNo) - guaranteed LP equity
        const floor = gross > liability ? gross - liability : 0n;

        // 4. Ceiling = Gross - min(qYes, qNo) - best case LP equity
        const minLiability = qYesUsdc < qNoUsdc ? qYesUsdc : qNoUsdc;
        const ceilingEquity = gross > minLiability ? gross - minLiability : 0n;

        // 5. Supply & Rates
        const supply = launchpad.lpSupply; 
        const supplyNum = Number(formatUnits(supply, 18));

        const floorRate = supplyNum > 0 ? Number(formatUnits(floor, usdcDecimals)) / supplyNum : 0;
        const ceilingRate = supplyNum > 0 ? Number(formatUnits(ceilingEquity, usdcDecimals)) / supplyNum : 0;

        // 6. Anchor Supply = b × ln(2) ≈ initial LP supply at creation
        const anchorSupply = Number(formatUnits(bBase, 18)) * LN2;

        // 7. Liquidity growth = bCurrent - bBase (from fee reinvestment)
        const liquidityGrowth = bCurrent > bBase ? bCurrent - bBase : 0n;

        return {
            seed,
            fees,
            gross,
            liability,
            floor,
            ceilingEquity,
            supply,
            floorRate,
            ceilingRate,
            b: bCurrent,
            bBase,
            liquidityGrowth,
            anchorSupply,
            qYes: qYesUsdc,
            qNo: qNoUsdc,
            rawQYes,
            rawQNo,
            decimals: usdcDecimals
        };
    }, [launchpad, ammState, usdcDecimals]);
};

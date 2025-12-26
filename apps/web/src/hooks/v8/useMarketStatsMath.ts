
import { useMemo } from 'react';
import { formatUnits, parseUnits } from 'viem';

// Types from our other hooks
interface LaunchpadData {
    creatorDeposit: bigint;
    feesAccrued: bigint;
    lpYieldPool: bigint;
    lpSupply: bigint;
    currentBBase: bigint;
    floorValue?: bigint;
}

interface AMMStateData {
    qYes: bigint;
    qNo: bigint;
}

// Stable log-sum-exp LMSR cost function: C(q) = b * ln(e^(qYes/b) + e^(qNo/b))
function calculateLMSRCost(qYes: bigint, qNo: bigint, b: bigint): number {
    if (b === 0n) return 0;
    const bNum = Number(formatUnits(b, 18));
    const qYesNum = Number(formatUnits(qYes, 18));
    const qNoNum = Number(formatUnits(qNo, 18));
    
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
        
        const b = launchpad.currentBBase;      
        const rawQYes = ammState.qYes;         
        const rawQNo = ammState.qNo;           

        // 1. Calculate P&L (Swap P&L)
        const currentCostNum = calculateLMSRCost(rawQYes, rawQNo, b);
        const initialCostNum = Number(formatUnits(seed, usdcDecimals)); 
        
        const pnlNum = currentCostNum - initialCostNum;
        const pnl = parseUnits(pnlNum.toFixed(usdcDecimals), usdcDecimals); 

        // 2. Calculate Gross Cash
        const gross = seed + fees + pnl + yield_;

        // 3. Calculate Liability
        // Liability in USDC terms: Max(qYes, qNo) scaled to usdcDecimals
        const qYesUsdc = usdcDecimals === 18 ? rawQYes : rawQYes / (wad / usdcFactor);
        const qNoUsdc = usdcDecimals === 18 ? rawQNo : rawQNo / (wad / usdcFactor);
        const liability = qYesUsdc > qNoUsdc ? qYesUsdc : qNoUsdc;

        // 4. Calculate Floor
        const floor = gross > liability ? gross - liability : 0n;

        // 5. Supply & Rates
        const supply = launchpad.lpSupply; 
        const supplyNum = Number(formatUnits(supply, 18));

        const floorRate = supplyNum > 0 ? Number(formatUnits(floor, usdcDecimals)) / supplyNum : 0;

        const minLiability = qYesUsdc < qNoUsdc ? qYesUsdc : qNoUsdc;
        const ceilingEquity = gross - minLiability;
        const ceilingRate = supplyNum > 0 ? Number(formatUnits(ceilingEquity, usdcDecimals)) / supplyNum : 0;

        const anchorSupply = Number(formatUnits(b, 18)) * 0.693147;

        return {
            seed,
            fees,
            pnl,
            gross,
            liability,
            floor,
            ceilingEquity,
            supply,
            floorRate,
            ceilingRate,
            b,
            anchorSupply,
            qYes: qYesUsdc,
            qNo: qNoUsdc,
            rawQYes,
            rawQNo,
            decimals: usdcDecimals
        };
    }, [launchpad, ammState, usdcDecimals]);
};


import { useMemo } from 'react';
import { formatUnits } from 'viem';

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

export const useMarketStatsMath = (launchpad: LaunchpadData | undefined, ammState: AMMStateData | undefined) => {
    return useMemo(() => {
        if (!launchpad || !ammState) return null;

        // Helper to normalize to USDC (6 decimals)
        const toUsdc = (val: bigint) => {
            // If value > 1e14 (100M USDC), assume it's WAD (18 dec) and scale down
            // This matches the logic we put in MarketStats.tsx
            if (val > 1_000_000_000_000_000n) return val / 1_000_000_000_000n;
            return val;
        };

        const wadToUsdc = (val: bigint) => val / 1_000_000_000_000n;

        const seed = toUsdc(launchpad.creatorDeposit);
        const fees = toUsdc(launchpad.feesAccrued);
        const floor = launchpad.floorValue !== undefined 
            ? toUsdc(launchpad.floorValue) 
            : toUsdc(launchpad.lpYieldPool); // Fallback to yield pool if floorValue missing

        // Liability
        const rawQYes = ammState.qYes;
        const rawQNo = ammState.qNo;
        const qYes = wadToUsdc(rawQYes);
        const qNo = wadToUsdc(rawQNo);

        // Liability = Max(qYes, qNo) used for Floor calc
        const liability = qYes > qNo ? qYes : qNo;

        // Gross = Current Assets held by system
        // Floor = Gross - Liability
        // Therefore Gross = Floor + Liability
        const gross = floor + liability;

        // P&L
        const pnl = gross - seed - fees;

        // Supply
        const supply = launchpad.lpSupply; // WAD
        const supplyNum = Number(formatUnits(supply, 18));

        // Rates (Price per LP token in USDC)
        // Floor Rate (Worst Case)
        const floorRate = supplyNum > 0 ? Number(formatUnits(floor, 6)) / supplyNum : 0;

        // Ceiling Rate (Best Case)
        // Ceiling occurs when Liability is minimized (i.e. the outcome with LOWER shares wins)
        // If Yes wins: Liability is qYes. Equity is Gross - qYes.
        // If No wins: Liability is qNo. Equity is Gross - qNo.
        // Ceiling Equity = Gross - Min(qYes, qNo)
        const minLiability = qYes < qNo ? qYes : qNo;
        const ceilingEquity = gross - minLiability; // 6 decimals
        const ceilingRate = supplyNum > 0 ? Number(formatUnits(ceilingEquity, 6)) / supplyNum : 0;

        // Liquidity Anchor
        const b = launchpad.currentBBase;
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
            qYes,
            qNo
        };
    }, [launchpad, ammState]);
};

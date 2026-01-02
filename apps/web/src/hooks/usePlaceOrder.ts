import { useState, useCallback, useMemo } from 'react';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { V996_ABIS } from '../config/abis';
import { useDeployments } from './useDeployments';
import { useChainStore } from '../store/useChainStore';
import toast from 'react-hot-toast';

type Address = `0x${string}`;

// Tick constants matching contract
const MIN_TICK = 1;
const MAX_TICK = 999;

/**
 * Result from placeOrder call
 */
export interface PlaceOrderResult {
  orderId: bigint;
  filledShares: bigint;
  filledCost: bigint;
  restingShares: bigint;
  txHash: `0x${string}`;
}

/**
 * V9.9.6 Unified Order API Hook
 *
 * Replaces separate placeRangeOrder() and executeMarketOrder() with single placeOrder().
 * Order type is determined by tick range:
 * - Market order: tickLower=1, tickUpper=999 (fill everything)
 * - Limit order: tickLower=X, tickUpper=X (single tick)
 * - Range order: tickLower < tickUpper (spread liquidity)
 * - Market with floor: tickLower=floor, tickUpper=999 (fill down to floor)
 *
 * Features:
 * - Auto-claims all user's pending fills before placing new order
 * - Returns filled shares and resting shares separately
 * - Slippage protection via maxCost parameter
 */
export function usePlaceOrder(marketKey: `0x${string}` | undefined) {
  const { address } = useAccount();
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === 'number' ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const poolManagerAddress = deployments?.contracts?.TickBookPoolManager as Address | undefined;
  const publicClient = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();

  const [isPending, setIsPending] = useState(false);

  /**
   * Core placeOrder function - unified API
   */
  const placeOrder = useCallback(async (
    outcome: 0 | 1,
    shares: bigint,
    tickLower: number,
    tickUpper: number,
    maxCost: bigint
  ): Promise<PlaceOrderResult | null> => {
    if (!marketKey || !poolManagerAddress || !address) {
      toast.error('Missing market or wallet connection');
      return null;
    }

    setIsPending(true);
    const toastId = toast.loading('Placing order...');

    try {
      // Validate tick range
      if (tickLower < MIN_TICK || tickUpper > MAX_TICK) {
        throw new Error(`Invalid tick range: must be ${MIN_TICK}-${MAX_TICK}`);
      }
      if (tickLower > tickUpper) {
        throw new Error('tickLower cannot exceed tickUpper');
      }

      // V9.9.6: placeOrder(bytes32 marketKey, uint8 outcome, uint256 shares, uint16 tickLower, uint16 tickUpper, uint256 maxCost)
      const args = [marketKey, outcome, shares, tickLower, tickUpper, maxCost] as const;

      console.log('[usePlaceOrder] Placing order with args:', {
        marketKey,
        outcome,
        shares: shares.toString(),
        tickLower,
        tickUpper,
        maxCost: maxCost.toString(),
        poolManagerAddress,
        address
      });

      // Simulate first to catch reverts
      if (publicClient) {
        try {
          await publicClient.simulateContract({
            account: address,
            address: poolManagerAddress,
            abi: V996_ABIS.TickBookPoolManager,
            functionName: 'placeOrder',
            args,
          });
        } catch (simError: any) {
          const reason = simError.cause?.reason || simError.shortMessage || simError.message;
          throw new Error(`Simulation failed: ${reason}`);
        }
      }

      const hash = await writeContractAsync({
        address: poolManagerAddress,
        abi: V996_ABIS.TickBookPoolManager,
        functionName: 'placeOrder',
        args,
      });

      toast.loading('Confirming...', { id: toastId });

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        // Parse OrderPlaced event from receipt
        // TODO: Parse actual values from event logs
        toast.success('Order placed!', { id: toastId });

        return {
          orderId: 0n, // TODO: Parse from event
          filledShares: 0n,
          filledCost: 0n,
          restingShares: shares,
          txHash: hash,
        };
      }

      toast.success('Order submitted!', { id: toastId });
      return {
        orderId: 0n,
        filledShares: 0n,
        filledCost: 0n,
        restingShares: shares,
        txHash: hash,
      };
    } catch (error: any) {
      const msg = error?.cause?.reason || error?.shortMessage || error?.message || 'Order failed';
      toast.error(msg, { id: toastId });
      console.error('placeOrder error:', error);
      return null;
    } finally {
      setIsPending(false);
    }
  }, [marketKey, poolManagerAddress, address, publicClient, writeContractAsync]);

  /**
   * Helper: Market order - fill everything available
   * tickLower=1, tickUpper=999
   */
  const marketOrder = useCallback(async (
    outcome: 0 | 1,
    shares: bigint,
    maxCost: bigint
  ): Promise<PlaceOrderResult | null> => {
    return placeOrder(outcome, shares, MIN_TICK, MAX_TICK, maxCost);
  }, [placeOrder]);

  /**
   * Helper: Limit order at single price tick
   * tickLower=tick, tickUpper=tick
   *
   * @param priceCents Price in cents (1-99 representing 0.01-0.99)
   */
  const limitOrder = useCallback(async (
    outcome: 0 | 1,
    shares: bigint,
    priceCents: number,
    maxCost: bigint
  ): Promise<PlaceOrderResult | null> => {
    // Convert price in cents (1-99) to tick (10-990)
    const tick = Math.round(priceCents * 10);
    if (tick < MIN_TICK || tick > MAX_TICK) {
      toast.error(`Invalid price: ${priceCents}% - must be 0.1-99.9%`);
      return null;
    }
    return placeOrder(outcome, shares, tick, tick, maxCost);
  }, [placeOrder]);

  /**
   * Helper: Range order - spread liquidity across price range
   */
  const rangeOrder = useCallback(async (
    outcome: 0 | 1,
    shares: bigint,
    priceLowCents: number,
    priceHighCents: number,
    maxCost: bigint
  ): Promise<PlaceOrderResult | null> => {
    const tickLower = Math.round(priceLowCents * 10);
    const tickUpper = Math.round(priceHighCents * 10);
    return placeOrder(outcome, shares, tickLower, tickUpper, maxCost);
  }, [placeOrder]);

  /**
   * Helper: Market order with floor - fill down to floor, rest at floor
   * tickLower=floor, tickUpper=999
   *
   * @param floorCents Minimum price in cents (order rests here if not fully filled)
   */
  const marketWithFloor = useCallback(async (
    outcome: 0 | 1,
    shares: bigint,
    floorCents: number,
    maxCost: bigint
  ): Promise<PlaceOrderResult | null> => {
    const floorTick = Math.round(floorCents * 10);
    if (floorTick < MIN_TICK) {
      toast.error(`Invalid floor: ${floorCents}% - must be at least 0.1%`);
      return null;
    }
    return placeOrder(outcome, shares, floorTick, MAX_TICK, maxCost);
  }, [placeOrder]);

  /**
   * Calculate max cost for a limit order at given price
   */
  const calculateMaxCost = useMemo(() => {
    return (outcome: 0 | 1, shares: bigint, priceCents: number, slippageBps = 100): bigint => {
      // For YES at price P: cost = P * shares
      // For NO at price P: cost = (1-P) * shares
      const priceWad = parseUnits(String(priceCents / 100), 18);
      const WAD = parseUnits('1', 18);

      let baseCost: bigint;
      if (outcome === 1) {
        // YES: cost = price * shares
        baseCost = (priceWad * shares) / WAD;
      } else {
        // NO: cost = (1 - price) * shares
        baseCost = ((WAD - priceWad) * shares) / WAD;
      }

      // Add slippage buffer
      return (baseCost * (10000n + BigInt(slippageBps))) / 10000n;
    };
  }, []);

  return {
    // Core function
    placeOrder,

    // Helper functions (recommended for FE use)
    marketOrder,
    limitOrder,
    rangeOrder,
    marketWithFloor,

    // Utilities
    calculateMaxCost,

    // State
    isPending,
    isReady: !!marketKey && !!poolManagerAddress && !!address,
  };
}

/**
 * Quick conversion utilities
 */
export const orderUtils = {
  /** Convert percentage (0.5 = 50%) to tick (500) */
  percentToTick: (percent: number): number => Math.round(percent * 1000),

  /** Convert tick (500) to percentage (0.5 = 50%) */
  tickToPercent: (tick: number): number => tick / 1000,

  /** Convert cents (50 = 50%) to tick (500) */
  centsToTick: (cents: number): number => Math.round(cents * 10),

  /** Convert tick (500) to cents (50) */
  tickToCents: (tick: number): number => tick / 10,

  /** Format shares for display */
  formatShares: (shares: bigint): string => {
    return parseFloat(formatUnits(shares, 18)).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  },

  /** Parse shares from user input */
  parseShares: (input: string): bigint => parseUnits(input, 18),
};

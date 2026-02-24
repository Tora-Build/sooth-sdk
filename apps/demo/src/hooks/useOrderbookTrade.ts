import { useCallback, useMemo, useState } from 'react';
import { useAccount, usePublicClient, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { encodePacked, formatUnits, isAddress, keccak256, maxUint256, parseUnits } from 'viem';
import toast from 'react-hot-toast';
import { ERC20_ABI, SOOTHBOOK_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import { useAmmMarket } from './useAmmMarket';
import { useAmmMarketByAddress } from './useAmmMarketByAddress';
import { useOrderStore } from '../store/useOrderStore';

type CancelTarget = {
  kind: 'level';
  side: 0 | 1;
  tick: number;
} | {
  kind: 'id';
  orderId: bigint;
};

type WriteFunctionName = 'buyYes' | 'buyNo' | 'cancel' | 'cancelById' | 'mint' | 'merge' | 'redeem';
type ExecuteWriteOptions = {
  silent?: boolean;
};

const GAS_LIMIT_CAP = 25_000_000n;
const MIN_SHARE_CHUNK = 10n ** 18n; // 1 share in WAD

const clampTick = (price: string) => {
  const value = Number(price);
  if (!Number.isFinite(value)) return 500;
  return Math.max(1, Math.min(999, Math.round(value * 1000)));
};

const toWad = (amount: bigint, decimals: number) => {
  if (decimals === 18) return amount;
  if (decimals < 18) return amount * 10n ** BigInt(18 - decimals);
  return amount / 10n ** BigInt(decimals - 18);
};

const fromWad = (amount: bigint, decimals: number) => {
  if (decimals === 18) return amount;
  if (decimals < 18) return amount / 10n ** BigInt(18 - decimals);
  return amount * 10n ** BigInt(decimals - 18);
};

const parseOrderId = (orderId: string): CancelTarget | null => {
  const normalized = orderId.trim().toLowerCase();
  if (!normalized) return null;

  if (/^\d+$/.test(normalized)) {
    return { kind: 'id', orderId: BigInt(normalized) };
  }

  const directMatch = normalized.match(/^(0|1):(\d{1,3})$/);
  if (directMatch) {
    const side = Number(directMatch[1]) as 0 | 1;
    const tick = Number(directMatch[2]);
    if (tick >= 1 && tick <= 999) return { kind: 'level', side, tick };
  }

  const suffixTick = normalized.match(/(\d{1,3})$/);
  if (!suffixTick) return null;

  const tick = Number(suffixTick[1]);
  if (tick < 1 || tick > 999) return null;

  if (normalized.includes('no')) return { kind: 'level', side: 0, tick };
  if (normalized.includes('yes') || normalized.includes('bid')) return { kind: 'level', side: 1, tick };
  if (normalized.includes('ask')) return { kind: 'level', side: 0, tick };

  return { kind: 'level', side: 1, tick };
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error ?? '');
  }
};

const isGasCapMessage = (message: string): boolean => {
  const lower = message.toLowerCase();
  return (
    lower.includes('exceeds maximum per-transaction gas limit') ||
    lower.includes('gas-per-tx limit') ||
    (lower.includes('transaction gas') && lower.includes('limit'))
  );
};

const normalizeTxErrorMessage = (error: unknown): string => {
  const message = getErrorMessage(error);
  if (isGasCapMessage(message)) {
    return 'Order exceeds chain gas-per-tx limit. Split size or use a less aggressive price.';
  }

  const lower = message.toLowerCase();
  if (lower.includes('user rejected') || lower.includes('user denied')) {
    return 'Transaction rejected in wallet.';
  }

  const reasonMatch = message.match(/reverted with the following reason:\s*([^\n]+)/i);
  if (reasonMatch?.[1]) {
    return reasonMatch[1].trim();
  }

  const firstLine = message.split('\n')[0]?.trim();
  return firstLine || 'Transaction failed';
};

export function useOrderbookTrade(marketId: string) {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const { contracts } = useDeployments();
  const soothBookAddress = contracts.SoothBook as `0x${string}` | undefined;

  const isAddressFormat = marketId?.startsWith('0x') && marketId.length === 42;
  const { amm: configMarket } = useAmmMarket(
    isAddressFormat ? undefined : (marketId as `0x${string}` | undefined)
  );
  const { market: addressMarket } = useAmmMarketByAddress(
    isAddressFormat ? (marketId as `0x${string}`) : undefined
  );
  const market = isAddressFormat ? addressMarket : configMarket;

  const marketAddress = isAddressFormat
    ? (marketId as `0x${string}`)
    : (((market as { contractAddress?: string; address?: string } | null)?.contractAddress ||
        (market as { contractAddress?: string; address?: string } | null)?.address) as
        | `0x${string}`
        | undefined);

  const marketKey = useMemo(() => {
    if (!marketAddress || !isAddress(marketAddress)) return undefined;
    return keccak256(encodePacked(['address'], [marketAddress]));
  }, [marketAddress]);

  const { data: marketData } = useReadContract({
    address: soothBookAddress,
    abi: SOOTHBOOK_ABI,
    functionName: 'markets',
    args: marketKey ? [marketKey] : undefined,
    query: { enabled: !!soothBookAddress && !!marketKey },
  });

  const collateralAddress = (marketData?.[0] as `0x${string}` | undefined) ||
    (contracts.MockUSDC as `0x${string}` | undefined);

  const { data: collateralDecimalsData = 6 } = useReadContract({
    address: collateralAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: !!collateralAddress },
  });

  const collateralDecimals = Number(collateralDecimalsData);

  const { data: walletBalanceRaw = 0n, refetch: refetchWalletBalance } = useReadContract({
    address: collateralAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!collateralAddress && !!userAddress },
  });

  const { data: allowance = 0n, refetch: refetchAllowance } = useReadContract({
    address: collateralAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress && soothBookAddress ? [userAddress, soothBookAddress] : undefined,
    query: { enabled: !!collateralAddress && !!userAddress && !!soothBookAddress },
  });

  const walletBalance = (walletBalanceRaw as bigint) ?? 0n;
  const allowanceAmount = (allowance as bigint) ?? 0n;
  const availableBalance = toWad(walletBalance, collateralDecimals);

  const { writeContractAsync, data: txHash, isPending: isWritePending } = useWriteContract();
  const [localPending, setLocalPending] = useState(false);

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const refetchBalance = useCallback(async () => {
    await Promise.all([refetchWalletBalance(), refetchAllowance()]);
  }, [refetchAllowance, refetchWalletBalance]);

  const ensureApproval = useCallback(
    async (requiredWad: bigint) => {
      if (!collateralAddress || !soothBookAddress || !userAddress || !publicClient) {
        toast.error('Missing approval context');
        return false;
      }

      const requiredRaw = fromWad(requiredWad, collateralDecimals);
      if (allowanceAmount >= requiredRaw) return true;

      const toastId = toast.loading('Approving collateral...');
      try {
        const approveHash = await writeContractAsync({
          address: collateralAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [soothBookAddress, maxUint256],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        toast.success('Approval confirmed', { id: toastId });
        await refetchAllowance();
        return true;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Approval failed';
        toast.error(message, { id: toastId });
        return false;
      }
    },
    [allowanceAmount, collateralAddress, collateralDecimals, publicClient, refetchAllowance, soothBookAddress, userAddress, writeContractAsync]
  );

  const executeWrite = useCallback(
    async (
      label: string,
      functionName: WriteFunctionName,
      args: readonly unknown[],
      approvalWad?: bigint,
      options?: ExecuteWriteOptions
    ) => {
      if (!soothBookAddress || !marketKey || !userAddress || !publicClient) {
        toast.error('Connect wallet and select a valid market');
        return false;
      }

      if (approvalWad && approvalWad > 0n) {
        const approved = await ensureApproval(approvalWad);
        if (!approved) return false;
      }

      try {
        const estimatedGas = await publicClient.estimateContractGas({
          address: soothBookAddress,
          abi: SOOTHBOOK_ABI,
          functionName: functionName as never,
          args: args as never,
          account: userAddress,
        });
        if (estimatedGas > GAS_LIMIT_CAP) {
          toast.error(`Estimated gas ${estimatedGas.toString()} exceeds chain limit ${GAS_LIMIT_CAP.toString()}. Try smaller size or less aggressive price.`);
          return false;
        }
      } catch (error: unknown) {
        if (isGasCapMessage(getErrorMessage(error))) {
          toast.error('Order exceeds chain gas-per-tx limit. Split into smaller orders or use a less aggressive price.');
          return false;
        }
      }

      setLocalPending(true);
      const silent = options?.silent === true;
      const toastId = silent ? '' : toast.loading(label);
      try {
        const hash = await writeContractAsync({
          address: soothBookAddress,
          abi: SOOTHBOOK_ABI,
          functionName: functionName as never,
          args: args as never,
        });

        await publicClient.waitForTransactionReceipt({ hash });
        if (!silent) {
          toast.success('Transaction confirmed', { id: toastId });
        }
        await refetchBalance();
        return true;
      } catch (error: unknown) {
        const message = normalizeTxErrorMessage(error);
        if (!silent) {
          toast.error(message, { id: toastId });
        }
        return false;
      } finally {
        setLocalPending(false);
      }
    },
    [ensureApproval, marketKey, publicClient, refetchBalance, soothBookAddress, userAddress, writeContractAsync]
  );

  const estimateGas = useCallback(
    async (functionName: WriteFunctionName, args: readonly unknown[]) => {
      if (!soothBookAddress || !userAddress || !publicClient) {
        return { gasCapHit: false };
      }

      try {
        const estimatedGas = await publicClient.estimateContractGas({
          address: soothBookAddress,
          abi: SOOTHBOOK_ABI,
          functionName: functionName as never,
          args: args as never,
          account: userAddress,
        });
        return {
          gasCapHit: estimatedGas > GAS_LIMIT_CAP,
          estimatedGas,
        };
      } catch (error: unknown) {
        if (isGasCapMessage(getErrorMessage(error))) {
          return { gasCapHit: true };
        }
        return { gasCapHit: false };
      }
    },
    [publicClient, soothBookAddress, userAddress]
  );

  const placeOrder = useCallback(
    async (outcome: 0 | 1, price: string, amount: string, isBuy = true) => {
      if (!marketKey || !marketAddress) {
        toast.error('Market key unavailable');
        return false;
      }

      let shares: bigint;
      let maxCostWad: bigint;
      try {
        shares = parseUnits(amount, 18);
        const priceNum = Number(price);
        const amountNum = Number(amount);
        if (!Number.isFinite(priceNum) || !Number.isFinite(amountNum)) {
          toast.error('Invalid order inputs');
          return false;
        }
        const estimatedCost = Math.max(0, priceNum * amountNum);
        maxCostWad = parseUnits(estimatedCost.toFixed(18), 18);
      } catch {
        toast.error('Invalid order amount');
        return false;
      }

      const directTick = clampTick(price);
      const oppositeTick = clampTick((1 - Number(price)).toFixed(4));
      const priceNum = Number(price);
      const amountNum = Number(amount);

      let success = false;
      let actualSide: 0 | 1 = outcome;
      let actualTick = directTick;

      if (isBuy) {
        if (outcome === 0) {
          success = await executeWrite(
            'Submitting buy YES order...',
            'buyYes',
            [marketKey, directTick, shares, false, maxCostWad],
            maxCostWad
          );
          actualSide = 1;
          actualTick = directTick;
        } else {
          success = await executeWrite(
            'Submitting buy NO order...',
            'buyNo',
            [marketKey, directTick, shares, false, maxCostWad],
            maxCostWad
          );
          actualSide = 0;
          actualTick = directTick;
        }
      } else {
        const sellFunction: WriteFunctionName = outcome === 0 ? 'buyNo' : 'buyYes';
        const sellLabel = outcome === 0 ? 'Submitting sell YES order...' : 'Submitting sell NO order...';
        // Escrow sell uses the opposite-side tick as the price bound.
        // maxCost is buy-path slippage protection and does not model escrow exits well.
        const sellMaxCost = 0n;
        const buildSellArgs = (chunkShares: bigint) => [marketKey, oppositeTick, chunkShares, true, sellMaxCost] as const;

        const fullEstimate = await estimateGas(sellFunction, buildSellArgs(shares));
        if (!fullEstimate.gasCapHit) {
          success = await executeWrite(sellLabel, sellFunction, buildSellArgs(shares));
        } else {
          let chunkSize = shares / 2n;
          if (chunkSize < MIN_SHARE_CHUNK) chunkSize = MIN_SHARE_CHUNK;

          while (chunkSize >= MIN_SHARE_CHUNK) {
            const check = await estimateGas(sellFunction, buildSellArgs(chunkSize));
            if (!check.gasCapHit) break;
            if (chunkSize === MIN_SHARE_CHUNK) {
              toast.error('Order too deep for per-tx gas cap. Raise price or submit smaller slices manually.');
              return false;
            }
            chunkSize = chunkSize / 2n;
            if (chunkSize < MIN_SHARE_CHUNK) chunkSize = MIN_SHARE_CHUNK;
          }

          const totalShares = shares;
          let remaining = shares;
          let submitted = 0n;
          toast('Large sweep detected. Splitting into smaller transactions.');

          while (remaining > 0n) {
            const currentChunk = remaining > chunkSize ? chunkSize : remaining;
            const chunkSuccess = await executeWrite(sellLabel, sellFunction, buildSellArgs(currentChunk));
            if (!chunkSuccess) {
              if (submitted > 0n) {
                const submittedShares = Number(formatUnits(submitted, 18));
                toast.error(`Partially submitted ${submittedShares.toLocaleString(undefined, { maximumFractionDigits: 3 })} shares. Submit remaining manually.`);
              }
              return false;
            }
            submitted += currentChunk;
            remaining -= currentChunk;
          }

          success = submitted === totalShares;
        }

        if (outcome === 0) {
          actualSide = 0;
          actualTick = oppositeTick;
        } else {
          actualSide = 1;
          actualTick = oppositeTick;
        }
      }

      if (success) {
        const orderId = `${actualSide}:${actualTick}`;
        const marketName = marketAddress.slice(0, 10) + '...';
        useOrderStore.getState().addOrder({
          id: orderId,
          marketAddress,
          marketName,
          outcome: actualSide,
          price: priceNum,
          amount: amountNum,
          timestamp: Date.now(),
          isBuy,
        });
      }

      return success;
    },
    [estimateGas, executeWrite, marketKey, marketAddress]
  );

  const placeSpotOrder = useCallback(
    async (outcome: 0 | 1, price: string, amount: string) => {
      return placeOrder(outcome, price, amount, false);
    },
    [placeOrder]
  );

  const executeHybridSell = useCallback(
    async (outcome: 0 | 1, price: string, amount: string) => {
      return placeOrder(outcome, price, amount, false);
    },
    [placeOrder]
  );

  const executeTakerOrder = useCallback(
    async (outcome: 0 | 1, price: string, amount: string, isBuy: boolean) => {
      return placeOrder(outcome, price, amount, isBuy);
    },
    [placeOrder]
  );

  const cancelOrder = useCallback(
    async (orderId: string, options?: ExecuteWriteOptions) => {
      if (!marketKey) {
        toast.error('Market key unavailable');
        return false;
      }

      const target = parseOrderId(orderId);
      if (!target) {
        toast.error('Unable to decode order id for cancel');
        return false;
      }

      const success = target.kind === 'id'
        ? await executeWrite('Cancelling order...', 'cancelById', [target.orderId], undefined, options)
        : await executeWrite('Cancelling order...', 'cancel', [marketKey, target.side, target.tick], undefined, options);
      
      if (success) {
        useOrderStore.getState().removeOrder(orderId);
      }

      return success;
    },
    [executeWrite, marketKey]
  );

  const mint = useCallback(
    async (amount: string) => {
      if (!marketKey) {
        toast.error('Market key unavailable');
        return false;
      }

      let amountWad: bigint;
      try {
        amountWad = parseUnits(amount, 18);
      } catch {
        toast.error('Invalid mint amount');
        return false;
      }

      return executeWrite('Minting YES+NO...', 'mint', [marketKey, amountWad], amountWad);
    },
    [executeWrite, marketKey]
  );

  const merge = useCallback(
    async (amount: string) => {
      if (!marketKey) {
        toast.error('Market key unavailable');
        return false;
      }

      let amountWad: bigint;
      try {
        amountWad = parseUnits(amount, 18);
      } catch {
        toast.error('Invalid merge amount');
        return false;
      }

      return executeWrite('Merging YES+NO...', 'merge', [marketKey, amountWad]);
    },
    [executeWrite, marketKey]
  );

  const redeem = useCallback(async () => {
    if (!marketKey) {
      toast.error('Market key unavailable');
      return false;
    }
    return executeWrite('Redeeming settled payout...', 'redeem', [marketKey]);
  }, [executeWrite, marketKey]);

  const depositShares = useCallback(async (_outcome: number, _amount: string) => {
    toast('Shares are held in wallet in SoothBook mode.');
    return false;
  }, []);

  return {
    placeOrder,
    placeSpotOrder,
    executeHybridSell,
    cancelOrder,
    executeTakerOrder,
    depositShares,
    mint,
    merge,
    redeem,
    isPending: localPending || isWritePending || isConfirming,
    availableBalance,
    internalYesShares: 0n,
    internalNoShares: 0n,
    refetchBalance,
  };
}

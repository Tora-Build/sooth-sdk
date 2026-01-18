/**
 * ClaimFillsButton - Batch claim all pending fills for a market
 *
 * V9 Architecture: Uses TickBookPoolManager.batchClaimFills()
 */
import { useState } from 'react';
import { Gift, Loader2, ExternalLink } from 'lucide-react';
import { useAccount, useWriteContract, useChainId, usePublicClient } from 'wagmi';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import { useDeployments } from '../../hooks/useDeployments';
import { ABIS } from '../../config/abis';
import { cn } from '../../lib/utils';
import { logger } from '../../lib/logger';

// Explorer URL helper
const getExplorerUrl = (chainId: number, hash: string) => {
  const explorers: Record<number, string> = {
    84532: 'https://sepolia.basescan.org',
    10143: 'https://testnet.monadexplorer.com',
  };
  const base = explorers[chainId] || 'https://sepolia.basescan.org';
  return `${base}/tx/${hash}`;
};

type Address = `0x${string}`;

interface ClaimFillsButtonProps {
  marketKey: `0x${string}` | undefined;
  orderIds: bigint[];
  className?: string;
  compact?: boolean;
  label?: string;
  variant?: 'filled' | 'partial';
  disabled?: boolean; // External disable (e.g., no orders to claim)
  onSuccess?: () => void; // Callback after successful claim
}

export const ClaimFillsButton = ({
  marketKey,
  orderIds,
  className,
  compact = false,
  label,
  variant = 'filled',
  disabled = false,
  onSuccess,
}: ClaimFillsButtonProps) => {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const deployments = useDeployments();
  const poolManagerAddress = deployments?.contracts?.TickBookPoolManager as Address | undefined;

  const { writeContractAsync, isPending } = useWriteContract();
  const [isConfirming, setIsConfirming] = useState(false);

  const handleClaim = async () => {
    if (!marketKey || !poolManagerAddress || orderIds.length === 0) return;

    const toastId = toast.loading(`Claiming ${orderIds.length} order(s)...`);

    try {
      // Step 1: Pre-flight check - verify which orders are actually active
      // This prevents "Internal JSON-RPC Error" (revert) if indexer is stale
      if (publicClient) {
        const results = await publicClient.multicall({
          contracts: orderIds.map(id => ({
            address: poolManagerAddress,
            abi: ABIS.TickBookPoolManager,
            functionName: 'getOrder',
            args: [marketKey, id]
          }))
        });

        // Filter for active orders that are NOT null/error
        const validOrderIds: bigint[] = [];
        results.forEach((res, idx) => {
          if (res.status === 'success' && res.result) {
            const order = res.result as any;
            // In V10, even active orders might have 0 pending shares, but usually batchClaim doesn't revert on 0 pending.
            // It DEFINITELY reverts if order is inactive/invalid.
            if (order.active) {
              validOrderIds.push(orderIds[idx]);
            }
          }
        });

        if (validOrderIds.length === 0) {
          toast.error('No active orders found to claim (indexer might be stale)', { id: toastId });
          onSuccess?.(); // Refresh to sync UI
          return;
        }

        if (validOrderIds.length < orderIds.length) {
          logger.claim.warn(`Filtered ${orderIds.length - validOrderIds.length} stale/inactive orders`);
          // Update the list to claim
          orderIds = validOrderIds;
        }
      }

      logger.claim.log('Calling batchClaimFills:', {
        marketKey,
        orderIds: orderIds.map(id => id.toString()),
        poolManager: poolManagerAddress
      });
      // Simulate first
      if (publicClient && address) {
        try {
          await publicClient.simulateContract({
            account: address,
            address: poolManagerAddress,
            abi: ABIS.TickBookPoolManager,
            functionName: 'batchClaimFills',
            args: [marketKey, orderIds],
            gas: BigInt(500000 + orderIds.length * 200000),
          });
        } catch (simError: any) {
          logger.claim.error('Simulation failed:', simError);
          const reason = simError.cause?.reason || simError.shortMessage || simError.message || 'Simulation failed';

          if (reason.includes('OrderNotActive')) {
            toast.error('Some orders are no longer active. Refreshing...', { id: toastId });
            onSuccess?.(); // Trigger refresh
            return;
          }
          // Non-blocking simulation
          logger.claim.warn('Simulation failed, attempting forced execution:', simError);
        }
      }

      const hash = await writeContractAsync({
        address: poolManagerAddress,
        abi: ABIS.TickBookPoolManager,
        functionName: 'batchClaimFills',
        args: [marketKey, orderIds],
        gas: BigInt(500000 + orderIds.length * 200000), // Aggressive buffer
      });
      logger.claim.log('TX submitted:', hash);

      toast.loading('Waiting for confirmation...', { id: toastId });
      setIsConfirming(true);

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
        logger.claim.log('TX receipt:', receipt.status, receipt);
        if (receipt.status === 'reverted') {
          toast.error('Transaction reverted on-chain', { id: toastId });
          setIsConfirming(false);
          return;
        }
      }

      // Step 2: Check and claim any pending refunds (unused collateral)
      let refundsClaimed = false;
      if (publicClient && address) {
        try {
          const pendingRefunds = await publicClient.readContract({
            address: poolManagerAddress,
            abi: ABIS.TickBookPoolManager,
            functionName: 'getPendingRefunds',
            args: [address, marketKey],
          }) as bigint;

          if (pendingRefunds > 0n) {
            logger.claim.log('Claiming pending refunds:', pendingRefunds.toString());
            toast.loading('Claiming refunds...', { id: toastId });

            const refundHash = await writeContractAsync({
              address: poolManagerAddress,
              abi: ABIS.TickBookPoolManager,
              functionName: 'claimPooledRefunds',
              args: [marketKey],
            });

            const refundReceipt = await publicClient.waitForTransactionReceipt({ hash: refundHash, timeout: 60_000 });
            if (refundReceipt.status === 'reverted') {
              logger.claim.warn('Refund claim reverted');
            } else {
              refundsClaimed = true;
            }
          }
        } catch (refundError) {
          logger.claim.warn('Refund claim failed (non-blocking):', refundError);
        }
      }

      toast.success(
        <div className="flex items-center gap-2">
          <span>{orderIds.length} fill(s) claimed!{refundsClaimed ? ' + refunds' : ''}</span>
          <a href={getExplorerUrl(chainId, hash)} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>,
        { id: toastId }
      );
      onSuccess?.();
    } catch (e: any) {
      logger.claim.error('Error:', e);
      const msg = e?.cause?.reason || e?.shortMessage || e?.message || 'Claim failed';
      toast.error(msg, { id: toastId });
    } finally {
      setIsConfirming(false);
    }
  };

  const isLoading = isPending || isConfirming;
  const hasOrders = orderIds.length > 0;
  const isDisabled = disabled || !isConnected || !hasOrders || isLoading;

  if (compact) {
    return (
      <button
        onClick={handleClaim}
        disabled={isDisabled}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold transition-all border',
          isDisabled
            ? 'bg-slate-800/50 text-slate-600 border-slate-700/50 cursor-not-allowed'
            : variant === 'partial'
              ? 'bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20',
          className
        )}
      >
        {isLoading && <Loader2 size={10} className="animate-spin" />}
        {label || `Claim ${orderIds.length}`}
      </button>
    );
  }

  return (
    <Button
      onClick={handleClaim}
      disabled={isDisabled}
      className={cn(
        'flex items-center gap-2',
        isDisabled
          ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
          : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400',
        className
      )}
    >
      {isLoading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Gift size={16} />
      )}
      <span>
        Claim {orderIds.length} Fill{orderIds.length > 1 ? 's' : ''}
      </span>
    </Button>
  );
};

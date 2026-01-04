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
import { V996_ABIS } from '../../config/abis';
import { cn } from '../../lib/utils';

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
  const { isConnected } = useAccount();
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
      console.log('[BatchClaim] Calling batchClaimFills:', { 
        marketKey, 
        orderIds: orderIds.map(id => id.toString()), 
        poolManager: poolManagerAddress 
      });
      const hash = await writeContractAsync({
        address: poolManagerAddress,
        abi: V996_ABIS.TickBookPoolManager,
        functionName: 'batchClaimFills',
        args: [marketKey, orderIds],
        gas: BigInt(200000 + orderIds.length * 100000), // Dynamic gas based on order count
      });
      console.log('[BatchClaim] TX submitted:', hash);

      toast.loading('Waiting for confirmation...', { id: toastId });
      setIsConfirming(true);

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
        console.log('[BatchClaim] TX receipt:', receipt.status, receipt);
        if (receipt.status === 'reverted') {
          toast.error('Transaction reverted on-chain', { id: toastId });
          setIsConfirming(false);
          return;
        }
      }

      toast.success(
        <div className="flex items-center gap-2">
          <span>{orderIds.length} fill(s) claimed!</span>
          <a href={getExplorerUrl(chainId, hash)} target="_blank" rel="noreferrer" className="text-amber-400 hover:text-amber-300">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>,
        { id: toastId }
      );
      onSuccess?.();
    } catch (e: any) {
      console.error('[BatchClaim] Error:', e);
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
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold transition-all border',
          isDisabled
            ? 'bg-slate-800/50 text-slate-600 border-slate-700/50 cursor-not-allowed'
            : variant === 'partial'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20',
          className
        )}
      >
        {isLoading ? (
          <Loader2 size={10} className="animate-spin" />
        ) : (
          <Gift size={10} />
        )}
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

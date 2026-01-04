/**
 * ClaimFillsButton - Batch claim all pending fills for a market
 *
 * V9 Architecture: Uses TickBookPoolManager.batchClaimFills()
 */
import { useState } from 'react';
import { Gift, Loader2, ExternalLink } from 'lucide-react';
import { useAccount, useWriteContract, useChainId, usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import { useDeployments } from '../../hooks/useDeployments';
import { usePendingFills } from '../../hooks';
import { V9_ABIS } from '../../config/abis';
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
}

export const ClaimFillsButton = ({
  marketKey,
  orderIds,
  className,
  compact = false,
  label,
  variant = 'filled',
  disabled = false,
}: ClaimFillsButtonProps) => {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const deployments = useDeployments();
  const poolManagerAddress = deployments?.contracts?.TickBookPoolManager as Address | undefined;

  const { fills, totalClaimableShares, hasClaimable, refetch } = usePendingFills(marketKey, orderIds);

  const { writeContractAsync, isPending } = useWriteContract();
  const [isConfirming, setIsConfirming] = useState(false);

  const handleClaim = async () => {
    if (!marketKey || !poolManagerAddress || fills.length === 0) return;

    const toastId = toast.loading('Submitting claim...');
    const claimableIds = fills.filter(f => f !== null).map((f) => f.orderId);

    try {
      const hash = await writeContractAsync({
        address: poolManagerAddress,
        abi: V9_ABIS.TickBookPoolManager,
        functionName: 'batchClaimFills',
        args: [marketKey, claimableIds],
        gas: 500000n,
      });

      toast.loading('Waiting for confirmation...', { id: toastId });
      setIsConfirming(true);

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
      }

      toast.success(
        <div className="flex items-center gap-2">
          <span>Fills claimed!</span>
          <a href={getExplorerUrl(chainId, hash)} target="_blank" rel="noreferrer" className="text-amber-400 hover:text-amber-300">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>,
        { id: toastId }
      );
      refetch();
    } catch (e: any) {
      const msg = e?.cause?.reason || e?.shortMessage || e?.message || 'Claim failed';
      toast.error(msg, { id: toastId });
      console.error(e);
    } finally {
      setIsConfirming(false);
    }
  };

  const isLoading = isPending || isConfirming;
  const isDisabled = disabled || !isConnected || !hasClaimable || isLoading;
  const sharesFormatted = Number(formatUnits(totalClaimableShares, 18)).toFixed(2);

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
        {label || `Claim ${fills.length}`}
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
        Claim {fills.length} Fill{fills.length > 1 ? 's' : ''} ({sharesFormatted} shares)
      </span>
    </Button>
  );
};

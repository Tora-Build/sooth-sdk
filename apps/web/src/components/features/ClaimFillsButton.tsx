/**
 * ClaimFillsButton - Batch claim all pending fills for a market
 *
 * V9 Architecture: Uses TickBookPoolManager.batchClaimFills()
 */
import { useState } from 'react';
import { Gift, Loader2, CheckCircle } from 'lucide-react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits } from 'viem';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import { useDeployments } from '../../hooks/useDeployments';
import { usePendingFills } from '../../hooks';
import { V9_ABIS } from '../../config/abis';
import { cn } from '../../lib/utils';

type Address = `0x${string}`;

interface ClaimFillsButtonProps {
  marketKey: `0x${string}` | undefined;
  orderIds: bigint[];
  className?: string;
  compact?: boolean;
}

export const ClaimFillsButton = ({
  marketKey,
  orderIds,
  className,
  compact = false,
}: ClaimFillsButtonProps) => {
  const { isConnected } = useAccount();
  const deployments = useDeployments();
  const poolManagerAddress = deployments?.contracts?.TickBookPoolManager as Address | undefined;

  const { fills, totalClaimableShares, hasClaimable, refetch } = usePendingFills(marketKey, orderIds);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleClaim = () => {
    if (!marketKey || !poolManagerAddress || fills.length === 0) return;

    const claimableIds = fills.map((f) => f.orderId);

    writeContract(
      {
        address: poolManagerAddress,
        abi: V9_ABIS.TickBookPoolManager,
        functionName: 'batchClaimFills',
        args: [marketKey, claimableIds],
        gas: 500000n,
      },
      {
        onSuccess: (hash) => {
          toast.loading('Claiming fills...', { id: 'claim-fills' });
        },
        onError: (error) => {
          toast.error(`Claim failed: ${error.message}`);
        },
      }
    );
  };

  // Handle success
  if (isSuccess && txHash) {
    toast.success('Fills claimed successfully!', { id: 'claim-fills' });
    refetch();
  }

  if (!isConnected || !hasClaimable) {
    return null;
  }

  const isLoading = isPending || isConfirming;
  const sharesFormatted = Number(formatUnits(totalClaimableShares, 18)).toFixed(2);

  if (compact) {
    return (
      <button
        onClick={handleClaim}
        disabled={isLoading}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all',
          'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20',
          isLoading && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        {isLoading ? (
          <Loader2 size={10} className="animate-spin" />
        ) : (
          <Gift size={10} />
        )}
        Claim {fills.length}
      </button>
    );
  }

  return (
    <Button
      onClick={handleClaim}
      disabled={isLoading}
      className={cn(
        'flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400',
        isLoading && 'opacity-50 cursor-not-allowed',
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

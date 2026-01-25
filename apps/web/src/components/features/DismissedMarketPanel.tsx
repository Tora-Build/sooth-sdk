/**
 * DismissedMarketPanel - V11 Trial Period Dismissal
 * Shows refund claim UI for users who traded on dismissed markets
 */
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { XCircle, AlertTriangle, Wallet, Loader2 } from 'lucide-react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { useLaunchpadMarketDirect } from '../../hooks';

interface DismissedMarketPanelProps {
  address: `0x${string}`;
}

export const DismissedMarketPanel = ({ address }: DismissedMarketPanelProps) => {
  const { isConnected } = useAccount();
  const {
    launchpad,
    isLoading,
    claimRefund,
    isPending
  } = useLaunchpadMarketDirect(address);

  if (isLoading) {
    return (
      <Card>
        <div className="p-4 animate-pulse space-y-3">
          <div className="h-4 bg-slate-700 rounded w-1/3" />
          <div className="h-6 bg-slate-700 rounded w-1/2" />
        </div>
      </Card>
    );
  }

  // Don't show if not dismissed
  if (!launchpad?.isDismissed) {
    return null;
  }

  const userLockedCost = launchpad.userLockedCost ?? 0n;
  const hasRefund = userLockedCost > 0n;
  const refundAmount = Number(formatUnits(userLockedCost, 6)); // USDC has 6 decimals

  if (!isConnected) {
    return (
      <Card className="border-rose-500/30 bg-rose-500/5">
        <div className="p-6 text-center">
          <XCircle className="w-8 h-8 mx-auto text-rose-400 mb-3" />
          <h3 className="text-lg font-semibold text-white mb-2">Market Dismissed</h3>
          <p className="text-slate-400 text-sm mb-4">
            This market was dismissed during the trial period.
          </p>
          <p className="text-slate-500 text-xs">Connect wallet to claim any refunds</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-rose-500/30 bg-rose-500/5">
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <XCircle className="w-5 h-5 text-rose-400" />
          <h3 className="font-semibold text-white">Market Dismissed</h3>
        </div>

        {/* Info */}
        <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-300">
              This market was dismissed by the creator during the trial period.
              All trades are being refunded at cost.
            </p>
          </div>
        </div>

        {/* Refund Info */}
        {hasRefund ? (
          <>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Your Refund Amount</span>
                <span className="text-xl font-bold text-white font-mono">
                  ${refundAmount.toFixed(2)}
                </span>
              </div>
            </div>

            <Button
              onClick={claimRefund}
              disabled={isPending}
              className="w-full bg-rose-600 hover:bg-rose-500"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Claiming...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Claim ${refundAmount.toFixed(2)} Refund
                </span>
              )}
            </Button>
          </>
        ) : (
          <div className="text-center py-2">
            <p className="text-slate-400 text-sm">
              You have no refund to claim for this market.
            </p>
            <p className="text-slate-500 text-xs mt-1">
              Only users who traded during the trial period are eligible.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

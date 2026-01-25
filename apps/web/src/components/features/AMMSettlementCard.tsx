/**
 * AMMSettlementCard - Displays settlement info and claim button per V8_AMM_TRADING_SPEC.md
 * 
 * Shows: Winning outcome, user's payout, claim button
 */
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Trophy, TrendingUp, TrendingDown, CheckCircle, Wallet, AlertCircle, Clock } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useTruthMarketDirect, useAmmMarketDirect } from '../../hooks';

interface AMMSettlementCardProps {
  address: `0x${string}`;
}

// Format USDC (6 decimals)
const formatUSDC = (value: number): string => {
  return `$${value.toFixed(2)}`;
};

// Format WAD values
const formatWad = (value: bigint): string => {
  const num = Number(value) / 1e18;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const AMMSettlementCard = ({ address }: AMMSettlementCardProps) => {
  const { address: userAddress, isConnected } = useAccount();
  const { market: truthMarket, isLoading: truthLoading } = useTruthMarketDirect(address);
  const { isLoading: ammLoading } = useAmmMarketDirect(address);

  const isLoading = truthLoading || ammLoading;
  const isSettled = truthMarket?.isSettled ?? false;
  const isFinalized = truthMarket?.isFinalized ?? false;
  const winningOutcome = truthMarket?.winningOutcome ?? 0;
  
  // Mock user position - in production from AMMEngine.getPosition
  const mockPosition = {
    yesShares: 0n,
    noShares: 0n,
  };
  
  // Calculate payout based on winning outcome
  const redemptionValue = 1.0; // $1 per winning share
  const userPayout = winningOutcome === 1 
    ? Number(mockPosition.yesShares) / 1e18 * redemptionValue
    : winningOutcome === 2
    ? Number(mockPosition.noShares) / 1e18 * redemptionValue
    : 0;

  const hasWinningPosition = 
    (winningOutcome === 1 && mockPosition.yesShares > 0n) ||
    (winningOutcome === 2 && mockPosition.noShares > 0n);

  // Don't show if market not settled
  if (!isSettled && !isLoading) {
    return null;
  }

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

  if (!isConnected) {
    return (
      <Card className={isFinalized ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}>
        <div className="p-6 text-center">
          {isFinalized ? (
            <Trophy className="w-8 h-8 mx-auto text-emerald-400 mb-3" />
          ) : (
            <Clock className="w-8 h-8 mx-auto text-amber-400 mb-3" />
          )}
          <h3 className="text-lg font-semibold text-white mb-2">
            {isFinalized ? 'Market Finalized' : 'Market Settled'}
          </h3>
          <p className="text-slate-400 text-sm mb-4">
            Outcome: {winningOutcome === 1 ? 'YES' : winningOutcome === 2 ? 'NO' : 'INVALID'}
          </p>
          {isFinalized ? (
            <p className="text-slate-500 text-xs">Connect wallet to claim any payouts</p>
          ) : (
            <p className="text-amber-400/80 text-xs">Veto period active - redemption not yet available</p>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className={isFinalized ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            {isFinalized ? (
              <Trophy className="w-5 h-5 text-emerald-400" />
            ) : (
              <Clock className="w-5 h-5 text-amber-400" />
            )}
            {isFinalized ? 'Market Finalized' : 'Market Settled'}
          </h3>
          {isFinalized ? (
            <Badge variant="success" className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Final
            </Badge>
          ) : (
            <Badge variant="warning" className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Veto Period
            </Badge>
          )}
        </div>

        {/* Outcome Display */}
        <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Winning Outcome</span>
            <div className="flex items-center gap-2">
              {winningOutcome === 1 ? (
                <>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-emerald-400">YES ✓</span>
                </>
              ) : winningOutcome === 2 ? (
                <>
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                  <span className="font-bold text-rose-400">NO ✓</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-slate-400" />
                  <span className="font-bold text-slate-400">INVALID</span>
                </>
              )}
            </div>
          </div>

          {/* User's Position */}
          {mockPosition.yesShares > 0n && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Your YES Shares</span>
              <span className={winningOutcome === 1 ? 'text-emerald-400' : 'text-slate-500 line-through'}>
                {formatWad(mockPosition.yesShares)}
              </span>
            </div>
          )}
          
          {mockPosition.noShares > 0n && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Your NO Shares</span>
              <span className={winningOutcome === 2 ? 'text-emerald-400' : 'text-slate-500 line-through'}>
                {formatWad(mockPosition.noShares)}
              </span>
            </div>
          )}

          {/* Payout Display */}
          {hasWinningPosition && (
            <div className="border-t border-slate-700 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">Your Payout</span>
                <span className="text-xl font-bold text-emerald-400">
                  {formatUSDC(userPayout)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Claim Button or Veto Period Notice */}
        {!isFinalized ? (
          <div className="text-center py-3 bg-amber-500/10 rounded-lg">
            <p className="text-amber-400 text-sm font-medium">Veto Period Active</p>
            <p className="text-slate-500 text-xs mt-1">
              Redemption will be available after the veto period ends
            </p>
          </div>
        ) : hasWinningPosition ? (
          <Button variant="primary" className="w-full">
            <Wallet className="w-4 h-4 mr-2" />
            Claim {formatUSDC(userPayout)} Payout
          </Button>
        ) : mockPosition.yesShares > 0n || mockPosition.noShares > 0n ? (
          <div className="text-center py-2">
            <p className="text-slate-400 text-sm">
              Your position was on the losing side
            </p>
            <p className="text-slate-500 text-xs mt-1">
              No payout available
            </p>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-slate-400 text-sm">
              You had no position in this market
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};


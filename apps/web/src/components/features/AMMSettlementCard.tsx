/**
 * AMMSettlementCard - Displays settlement info and claim button per V8_AMM_TRADING_SPEC.md
 * 
 * Shows: Winning outcome, user's payout, claim button
 */
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Trophy, TrendingUp, TrendingDown, CheckCircle, Wallet, AlertCircle, Clock } from 'lucide-react';
import { useAccount, useWriteContract } from 'wagmi';
import { useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useTruthMarketDirect, useAmmMarketDirect, useAMMPositionDirect, useInvalidateQueries } from '../../hooks';
import { useDeployments } from '../../hooks/useDeployments';
import { ABIS } from '../../config/abis';

interface AMMSettlementCardProps {
  address: `0x${string}`;
  stage?: 'bonding' | 'live' | 'settled' | 'finalized' | 'dismissed';
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

export const AMMSettlementCard = ({ address, stage }: AMMSettlementCardProps) => {
   const { address: userAddress, isConnected } = useAccount();
   const { market: truthMarket, isLoading: truthLoading } = useTruthMarketDirect(address);
   const { isLoading: ammLoading } = useAmmMarketDirect(address);
   const { data: position } = useAMMPositionDirect(address);
   
   const { writeContractAsync, isPending } = useWriteContract();
   const { contracts } = useDeployments();
   const queryClient = useQueryClient();
   const invalidateQueries = useInvalidateQueries();

    // Track initial load state to avoid flicker during polling refetches
    const initialLoadRef = useRef(true);
    const rawIsLoading = truthLoading || ammLoading;
    
    // Memoized loading state: only show skeleton on initial load, not on subsequent refetches
    const isLoading = useMemo(() => {
      if (rawIsLoading && initialLoadRef.current) {
        return true; // Show skeleton on initial load
      }
      if (!rawIsLoading) {
        initialLoadRef.current = false; // Mark initial load complete
      }
      return false; // Don't show skeleton on refetches
    }, [rawIsLoading]);
   const isSettled = stage === 'settled' || stage === 'finalized' || truthMarket?.isSettled || false;
   const isFinalized = stage === 'finalized' || truthMarket?.isFinalized || false;
  const winningOutcome = truthMarket?.winningOutcome ?? 0;
  
  const yesShares = position?.yesShares ?? 0n;
  const noShares = position?.noShares ?? 0n;
  
  // Calculate payout based on winning outcome
  // Protocol encoding: 0=NO, 1=YES, 2=INVALID
  const redemptionValue = 1.0; // $1 per winning share
  const userPayout = winningOutcome === 1 
    ? Number(yesShares) / 1e18 * redemptionValue
    : winningOutcome === 0
    ? Number(noShares) / 1e18 * redemptionValue
    : 0;

   const hasWinningPosition = 
     (winningOutcome === 1 && yesShares > 0n) ||
     (winningOutcome === 0 && noShares > 0n);

   const handleClaim = async () => {
     if (!contracts?.AMMEngine) return;
     try {
       await writeContractAsync({
         address: contracts.AMMEngine as `0x${string}`,
         abi: ABIS.AMMEngine,
         functionName: 'settlePosition',
         args: [address],
       });
       toast.success('Payout claimed successfully');
       invalidateQueries();
       queryClient.invalidateQueries({ queryKey: ['v9'] });
       queryClient.invalidateQueries({ queryKey: ['v10'] });
     } catch (e: any) {
       toast.error(`Claim failed: ${e.message || 'Unknown error'}`);
     }
   };

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
            Outcome: {winningOutcome === 1 ? 'YES' : winningOutcome === 0 ? 'NO' : 'INVALID'}
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
      <div className="p-5 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/50 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {isFinalized ? (
                <Trophy className="w-5 h-5 text-emerald-400" />
              ) : (
                <Clock className="w-5 h-5 text-amber-400" />
              )}
              {isFinalized ? 'Market Finalized' : 'Market Settled'}
            </h3>
            <p className="text-slate-400 text-xs mt-1">
              {isFinalized 
                ? "Trading has ended and outcomes are final." 
                : "Trading has ended. Waiting for veto period."}
            </p>
          </div>
          {isFinalized ? (
            <Badge variant="success" className="flex items-center gap-1 px-3 py-1">
              <CheckCircle className="w-3 h-3" />
              Finalized
            </Badge>
          ) : (
            <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 px-3 py-1">
              <Clock className="w-3 h-3" />
              Settled
            </Badge>
          )}
        </div>

        {/* Winning Outcome & Payout Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Winning Outcome Box */}
          <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-800/50 flex flex-col justify-center items-center text-center">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Winning Outcome</span>
            <div className="flex items-center gap-2">
              {winningOutcome === 1 ? (
                <div className="flex items-center gap-2 bg-emerald-500/10 px-4 py-2 rounded-lg border border-emerald-500/20">
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                  <span className="text-2xl font-black text-emerald-400">YES</span>
                </div>
              ) : winningOutcome === 0 ? (
                <div className="flex items-center gap-2 bg-rose-500/10 px-4 py-2 rounded-lg border border-rose-500/20">
                  <TrendingDown className="w-6 h-6 text-rose-400" />
                  <span className="text-2xl font-black text-rose-400">NO</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-slate-500/10 px-4 py-2 rounded-lg border border-slate-500/20">
                  <AlertCircle className="w-6 h-6 text-slate-400" />
                  <span className="text-2xl font-black text-slate-400">INVALID</span>
                </div>
              )}
            </div>
          </div>

          {/* User Payout Box */}
          <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-800/50 flex flex-col justify-center items-center text-center">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Your Payout</span>
            {hasWinningPosition ? (
              <div className="flex flex-col items-center">
                <span className="text-3xl font-mono font-bold text-emerald-400 tracking-tight">
                  {formatUSDC(userPayout)}
                </span>
                <span className="text-emerald-500/60 text-xs mt-1 font-medium">
                  Ready to claim
                </span>
              </div>
            ) : (yesShares > 0n || noShares > 0n) ? (
              <div className="flex flex-col items-center">
                <span className="text-3xl font-mono font-bold text-slate-600 tracking-tight">
                  $0.00
                </span>
                <span className="text-slate-500 text-xs mt-1">
                  Position lost
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-slate-400 text-sm italic">
                  No position
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Position Details (Collapsed/Small) */}
        {(yesShares > 0n || noShares > 0n) && (
          <div className="bg-slate-950/30 rounded-lg p-3 text-sm border border-slate-800/30">
            <div className="flex justify-between items-center text-slate-400 text-xs mb-2 uppercase tracking-wider font-bold">
              <span>Your Position</span>
              <span>Shares</span>
            </div>
            {yesShares > 0n && (
              <div className="flex justify-between items-center py-1">
                <span className={winningOutcome === 1 ? "text-emerald-400 font-bold" : "text-slate-500 line-through"}>YES Outcome</span>
                <span className="font-mono text-slate-300">{formatWad(yesShares)}</span>
              </div>
            )}
            {noShares > 0n && (
              <div className="flex justify-between items-center py-1">
                <span className={winningOutcome === 0 ? "text-emerald-400 font-bold" : "text-slate-500 line-through"}>NO Outcome</span>
                <span className="font-mono text-slate-300">{formatWad(noShares)}</span>
              </div>
            )}
          </div>
        )}

        {/* Action Area */}
        <div className="pt-2">
          {!isFinalized ? (
            <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <Clock className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-amber-400 text-sm font-bold">Veto Period Active</p>
                <p className="text-amber-400/70 text-xs mt-0.5">
                  Payouts are locked until the veto period ends. Check back soon.
                </p>
              </div>
            </div>
          ) : hasWinningPosition ? (
            <div className="space-y-3">
              <Button 
                variant="primary" 
                className="w-full h-12 text-base font-bold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all" 
                onClick={handleClaim} 
                disabled={isPending}
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing Claim...
                  </span>
                ) : (
                  <>
                    <Wallet className="w-5 h-5 mr-2" />
                    Claim {formatUSDC(userPayout)} Payout
                  </>
                )}
              </Button>
              <p className="text-center text-slate-500 text-xs">
                Funds will be sent directly to your wallet
              </p>
            </div>
          ) : (yesShares > 0n || noShares > 0n) ? (
            <div className="text-center py-2">
              <p className="text-slate-500 text-sm">
                Better luck next time.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
};

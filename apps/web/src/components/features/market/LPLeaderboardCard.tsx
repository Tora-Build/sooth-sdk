// LPLeaderboardCard.tsx - Shows LP leaderboard with creator and user positions
import React, { useState } from 'react';
import { Coins, HelpCircle, Crown } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { formatUnits } from 'viem';
import { formatCurrency } from '../../../utils/format';

interface LPLeaderboardCardProps {
  userAddress?: `0x${string}`;
  userLpBalance?: bigint;
  userLpValue: bigint;
  userSharePercent: number;
  isLive?: boolean;
  redeemLP: (amount: bigint) => void;
  isRedeemLPPending: boolean;
  // Creator info
  creatorAddress?: `0x${string}`;
  creatorLpBalance?: bigint;
  totalSupply?: bigint;
  totalAssets?: bigint;
}

export const LPLeaderboardCard: React.FC<LPLeaderboardCardProps> = ({
  userAddress,
  userLpBalance,
  userLpValue,
  userSharePercent,
  isLive,
  redeemLP,
  isRedeemLPPending,
  creatorAddress,
  creatorLpBalance,
  totalSupply,
  totalAssets,
}) => {
  const [showHelp, setShowHelp] = useState(false);
  
  const hasUserPosition = userAddress && userLpBalance !== undefined && userLpBalance > 0n;
  // Show creator if we have their address (even if balance is still loading or 0)
  const creatorBalance = creatorLpBalance ?? 0n;
  const hasCreatorToShow = !!creatorAddress;
  const isUserCreator = userAddress && creatorAddress && userAddress.toLowerCase() === creatorAddress.toLowerCase();

  // Calculate creator's share and value
  const creatorSharePercent = (totalSupply && totalSupply > 0n && creatorBalance > 0n) 
    ? Number((creatorBalance * 10000n) / totalSupply) / 100 
    : 0;
  const creatorLpValue = (totalSupply && totalSupply > 0n && totalAssets && creatorBalance > 0n)
    ? (creatorBalance * totalAssets) / totalSupply
    : 0n;

  // LP tokens match USDC decimals (6 for real USDC and new MockUSDC)
  const LP_DECIMALS = 6;
  
  // Helper to render a leaderboard row
  const LeaderboardRow = ({ 
    address, 
    balance, 
    value, 
    share, 
    isCreatorRow, 
    isYou 
  }: { 
    address: string; 
    balance: bigint; 
    value: bigint; 
    share: number; 
    isCreatorRow?: boolean;
    isYou?: boolean;
  }) => (
    <div className={`flex items-center justify-between py-2 px-2 rounded-lg ${isYou ? 'bg-purple-500/10' : 'bg-slate-800/30'}`}>
      <div className="flex items-center gap-2 min-w-0">
        {isCreatorRow && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />}
        <span className="text-xs font-mono text-slate-400 truncate">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        {isCreatorRow && (
          <Badge className="text-[8px] bg-amber-500/20 text-amber-400 border-amber-500/50 py-0 px-1 flex-shrink-0">
            Creator
          </Badge>
        )}
        {isYou && !isCreatorRow && (
          <Badge className="text-[8px] bg-purple-500/20 text-purple-400 border-purple-500/50 py-0 px-1 flex-shrink-0">
            You
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs flex-shrink-0">
        <span className="font-mono text-slate-500">
          {parseFloat(formatUnits(balance, LP_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 0 })} LP
        </span>
        <span className="font-mono font-bold text-white w-16 text-right">
          {share.toFixed(1)}%
        </span>
      </div>
    </div>
  );

  return (
    <Card className="p-4 border-purple-500/20">
      {/* Header with Help Button */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-white flex items-center gap-2 text-sm">
          <Coins className="w-4 h-4 text-purple-400" />
          LP Holders
        </h3>
        <div className="flex items-center gap-2">
          {hasUserPosition && !isLive && (
            <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
              Redeemable
            </Badge>
          )}
          <button
            onClick={() => setShowHelp(!showHelp)}
            className={`p-1 rounded transition-colors ${showHelp ? 'bg-purple-500/20 text-purple-400' : 'text-slate-500 hover:text-purple-400'}`}
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Education Panel (toggleable) */}
      {showHelp && (
        <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 mb-3 text-xs text-slate-300 space-y-1">
          <p>• <strong>LP tokens</strong> = your share of trading fees</p>
          <p>• Earned automatically when you trade</p>
          <p>• Creator gets initial LP equal to deposit</p>
          <p>• Redeemable for USDC after market settles</p>
        </div>
      )}

      {/* Leaderboard */}
      <div className="space-y-1 mb-3">
        {/* Creator Row (always show if we have creator address, and they're not the connected user) */}
        {hasCreatorToShow && !isUserCreator && (
          <LeaderboardRow
            address={creatorAddress!}
            balance={creatorBalance}
            value={creatorLpValue}
            share={creatorSharePercent}
            isCreatorRow
          />
        )}

        {/* User Row */}
        {hasUserPosition && (
          <LeaderboardRow
            address={userAddress!}
            balance={userLpBalance!}
            value={userLpValue}
            share={userSharePercent}
            isCreatorRow={isUserCreator}
            isYou
          />
        )}

        {/* Empty state if no positions and no creator */}
        {!hasUserPosition && !hasCreatorToShow && (
          <div className="text-center py-3 text-xs text-slate-500">
            No LP holders yet
          </div>
        )}
      </div>

      {/* User's detailed stats + redeem (if they have LP) */}
      {hasUserPosition && (
        <div className="pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-500">Your Value</span>
            <span className="font-mono font-bold text-purple-400">
              {formatCurrency(parseFloat(formatUnits(userLpValue, LP_DECIMALS)))}
            </span>
          </div>
          {!isLive && (
            <Button
              onClick={() => redeemLP(userLpBalance!)}
              disabled={isRedeemLPPending}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-bold text-xs py-2"
            >
              {isRedeemLPPending ? 'Redeeming...' : 'Redeem LP'}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
};

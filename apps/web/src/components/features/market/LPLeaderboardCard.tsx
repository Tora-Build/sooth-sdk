// LPLeaderboardCard.tsx - Shows LP leaderboard with all LP holders
import React, { useState } from 'react';
import { Coins, HelpCircle, Crown } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { formatUnits } from 'viem';
import { formatCurrency } from '../../../utils/format';
import { useLPHolders } from '../../../hooks/v5/useLPHolders';

interface LPLeaderboardCardProps {
  marketAddress?: `0x${string}`;
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
  totalNetAssets?: bigint;
}

export const LPLeaderboardCard: React.FC<LPLeaderboardCardProps> = ({
  marketAddress,
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
  totalNetAssets,
}) => {
  const [showHelp, setShowHelp] = useState(false);
  
  // Fetch all LP holders from Transfer events
  const { holders, isLoading: isLoadingHolders } = useLPHolders(marketAddress, creatorAddress);
  
  const hasUserPosition = userAddress && userLpBalance !== undefined && userLpBalance > 0n;
  const isUserCreator = userAddress && creatorAddress && userAddress.toLowerCase() === creatorAddress.toLowerCase();

  // LP tokens are ERC20 with 18 decimals, but LP *value* is in USDC (6 decimals)
  const LP_TOKEN_DECIMALS = 18;
  const USDC_DECIMALS = 6;

  // Calculate value and share for any holder (uses Net Assets)
  const calcValue = (balance: bigint) => {
    if (!totalSupply || totalSupply === 0n || !totalNetAssets) return 0n;
    return (balance * totalNetAssets) / totalSupply;
  };
  const calcShare = (balance: bigint) => {
    if (!totalSupply || totalSupply === 0n) return 0;
    return Number((balance * 10000n) / totalSupply) / 100;
  };
  
  // Helper to render a leaderboard row
  const LeaderboardRow = ({ 
    address, 
    balance, 
    isCreatorRow, 
    isYou 
  }: { 
    address: string; 
    balance: bigint; 
    isCreatorRow?: boolean;
    isYou?: boolean;
  }) => {
    const share = calcShare(balance);
    return (
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
          {isYou && (
            <Badge className="text-[8px] bg-purple-500/20 text-purple-400 border-purple-500/50 py-0 px-1 flex-shrink-0">
              You
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs flex-shrink-0">
          <span className="font-mono text-slate-500">
            {parseFloat(formatUnits(balance, LP_TOKEN_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 0 })} LP
          </span>
          <span className="font-mono font-bold text-white w-16 text-right">
            {share.toFixed(1)}%
          </span>
        </div>
      </div>
    );
  };

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

      {/* Leaderboard Header */}
      <div className="flex items-center justify-between px-2 pb-1 mb-1 text-[9px] text-slate-600 uppercase tracking-wider">
        <span>Holder</span>
        <div className="flex items-center gap-3">
          <span>Balance</span>
          <span className="w-16 text-right">Share</span>
        </div>
      </div>

      {/* Leaderboard - Show all holders sorted by balance */}
      <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
        {isLoadingHolders ? (
          <div className="text-center py-4 text-xs text-slate-500 animate-pulse">
            Loading LP holders...
          </div>
        ) : holders.length > 0 ? (
          holders.map((holder) => {
            const isCreator = creatorAddress?.toLowerCase() === holder.address.toLowerCase();
            const isYou = userAddress?.toLowerCase() === holder.address.toLowerCase();
            return (
              <LeaderboardRow
                key={holder.address}
                address={holder.address}
                balance={holder.balance}
                isCreatorRow={isCreator}
                isYou={isYou}
              />
            );
          })
        ) : (
          <div className="text-center py-4 text-xs text-slate-500">
            No LP holders yet
          </div>
        )}
      </div>

      {/* Value Summary - Show user's LP value and redeem button */}
      {hasUserPosition && (
        <div className="pt-3 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">{isUserCreator ? 'Your Value (Creator)' : 'Your Value'}</span>
            <span className="font-mono font-bold text-purple-400">
              {formatCurrency(parseFloat(formatUnits(userLpValue, USDC_DECIMALS)))}
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

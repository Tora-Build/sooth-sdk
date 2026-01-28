/**
 * AMMPositionCard - Displays user's AMM position per V8_AMM_TRADING_SPEC.md
 * 
 * Shows: Active shares, locked proceeds with countdown, claim button
 */
import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Wallet, Lock, Clock, TrendingUp, TrendingDown, Unlock } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useAmmMarketDirect } from '../../hooks';

interface AMMPositionCardProps {
  address: `0x${string}`;
}

// Format WAD values
const formatWad = (value: bigint): string => {
  const num = Number(value) / 1e18;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Format USDC (6 decimals)
const formatUSDC = (value: bigint): string => {
  const num = Number(value) / 1e6;
  return `$${num.toFixed(2)}`;
};

// Countdown timer hook
const useCountdown = (targetTimestamp: number) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = targetTimestamp - now;
      
      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft('Ready');
        return;
      }
      
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      
      setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      setIsExpired(false);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  return { timeLeft, isExpired };
};

export const AMMPositionCard = ({ address }: AMMPositionCardProps) => {
  const { address: userAddress, isConnected } = useAccount();
  const { amm, isLoading } = useAmmMarketDirect(address);
  
  // Mock position data - in production this comes from AMMEngine.getPosition(market, user)
  // TODO: Create useAMMPosition hook to fetch real position data
  const mockPosition = {
    yesShares: 0n,
    noShares: 0n,
    lockedProceeds: 0n,
    lockExpiry: 0,
    entryPrice: 0.5,
  };

  const { timeLeft, isExpired } = useCountdown(mockPosition.lockExpiry);

  const currentPrice = amm?.yesProbability ?? 0.5;
  const hasPosition = mockPosition.yesShares > 0n || mockPosition.noShares > 0n;
  const hasLockedProceeds = mockPosition.lockedProceeds > 0n;

  // Calculate unrealized PnL
  const unrealizedPnL = hasPosition 
    ? (currentPrice - mockPosition.entryPrice) * Number(mockPosition.yesShares) / 1e18
    : 0;
  const pnlPercent = mockPosition.entryPrice > 0 
    ? ((currentPrice - mockPosition.entryPrice) / mockPosition.entryPrice) * 100
    : 0;

  if (!isConnected) {
    return (
      <Card>
        <div className="p-6 text-center">
          <Wallet className="w-8 h-8 mx-auto text-slate-500 mb-3" />
          <p className="text-slate-400 text-sm">Connect wallet to view positions</p>
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <div className="p-4 animate-pulse space-y-3">
          <div className="h-4 bg-slate-700 rounded w-1/3" />
          <div className="h-6 bg-slate-700 rounded w-1/2" />
          <div className="h-10 bg-slate-700 rounded" />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-4 space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Wallet className="w-5 h-5 text-cyan-400" />
          My Position
        </h3>

        {/* Active Position */}
        {hasPosition ? (
          <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
            {mockPosition.yesShares > 0n && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-300">YES Shares</span>
                </div>
                <span className="font-mono font-bold text-emerald-400">
                  {formatWad(mockPosition.yesShares)}
                </span>
              </div>
            )}
            
            {mockPosition.noShares > 0n && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                  <span className="text-slate-300">NO Shares</span>
                </div>
                <span className="font-mono font-bold text-rose-400">
                  {formatWad(mockPosition.noShares)}
                </span>
              </div>
            )}

            <div className="border-t border-slate-700 pt-2 mt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Entry Price</span>
                <span className="text-slate-300">{(mockPosition.entryPrice * 100).toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Current Price</span>
                <span className="text-slate-300">{(currentPrice * 100).toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Unrealized PnL</span>
                <span className={unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toFixed(2)} ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/50 rounded-lg p-4 text-center">
            <p className="text-slate-400 text-sm">No active position</p>
            <p className="text-slate-500 text-xs mt-1">Use the trading panel to buy shares</p>
          </div>
        )}

        {/* Locked Proceeds */}
        {hasLockedProceeds && (
          <div className="bg-slate-500/10 border border-slate-500/30 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-400" />
                <span className="text-slate-200 font-medium">Locked Proceeds</span>
              </div>
              <Badge variant={isExpired ? 'success' : 'warning'}>
                {isExpired ? (
                  <span className="flex items-center gap-1">
                    <Unlock className="w-3 h-3" />
                    Ready
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeLeft}
                  </span>
                )}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-300">Amount</span>
              <span className="font-mono font-bold text-white">
                {formatUSDC(mockPosition.lockedProceeds)}
              </span>
            </div>

            <Button 
              variant={isExpired ? 'primary' : 'secondary'}
              className="w-full mt-2"
              disabled={!isExpired}
            >
              {isExpired ? `Claim ${formatUSDC(mockPosition.lockedProceeds)}` : `Locked (${timeLeft})`}
            </Button>
          </div>
        )}

        {/* Empty state with no locked proceeds either */}
        {!hasPosition && !hasLockedProceeds && (
          <div className="text-center py-2">
            <p className="text-slate-500 text-xs">
              Trade to build a position and earn from price movements
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};


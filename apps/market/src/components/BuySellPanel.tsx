import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { Loader2 } from 'lucide-react';
import { type LaunchpadMarket } from '../types';
import { useOrderbookTrade } from '../hooks/useOrderbookTrade';
import { useSoothBookMarket } from '../hooks/useSoothBook';
import { useUsdcBalance } from '../hooks/useUsdcBalance';

interface BuySellPanelProps {
  market: LaunchpadMarket;
  onClose?: () => void;
}

export function BuySellPanel({ market, onClose }: BuySellPanelProps) {
  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const [tick, setTick] = useState<string>('');
  const [amount, setAmount] = useState<string>('');

  const { isConnected } = useAccount();
  const { buyYes, buyNo, approve, state } = useOrderbookTrade(market.address);
  const {
    yesPrice,
    noPrice,
    bestYesTick,
    bestNoTick,
    isActive,
  } = useSoothBookMarket(market.address);
  const { balance, allowance, formatted, refetch } = useUsdcBalance();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-8 text-center bg-zinc-900/30 border border-zinc-800/50 rounded-lg">
        <p className="font-sans">Connect wallet to trade</p>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-8 text-center bg-zinc-900/30 border border-zinc-800/50 rounded-lg">
        <p className="font-sans">Market not active</p>
      </div>
    );
  }

  const parsedAmount = amount && !isNaN(parseFloat(amount)) ? parseUnits(amount, 6) : 0n;
  
  // Show approve if allowance is lower than parsedAmount OR if amount is empty/0 and allowance is 0
  const needsApproval =
    allowance !== undefined && (allowance < parsedAmount || (parsedAmount === 0n && allowance === 0n));

  const handleApprove = async () => {
    await approve('max');
    refetch();
  };

  const handleBuy = async () => {
    const tickNum = parseInt(tick, 10);
    if (isNaN(tickNum) || tickNum < 1 || tickNum > 999) return;
    if (!amount || parsedAmount <= 0n) return;

    if (side === 'yes') {
      await buyYes(tickNum, amount, false, amount);
    } else {
      await buyNo(tickNum, amount, false, amount);
    }

    if (!state.error) {
      setAmount('');
      refetch();
    }
  };

  const currentPrice = side === 'yes' ? yesPrice : noPrice;
  const impliedPriceStr = currentPrice
    ? (Number(currentPrice) / 1e18 * 100).toFixed(1) + '%'
    : '--';

  const bestTick = side === 'yes' ? bestYesTick : bestNoTick;
  const bestTickStr = bestTick !== undefined ? (bestTick / 10).toFixed(1) + '%' : '--';

  const impliedProb =
    tick && !isNaN(parseInt(tick, 10))
      ? (parseInt(tick, 10) / 10).toFixed(1) + '%'
      : '--';

  const isTickValid =
    tick && !isNaN(parseInt(tick, 10)) && parseInt(tick, 10) >= 1 && parseInt(tick, 10) <= 999;
  const isAmountValid = amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0;
  const isBalanceSufficient = balance !== undefined && balance >= parsedAmount;

  // We only enable the Buy button if there are valid inputs and enough balance, and it's already approved.
  const canBuy = isTickValid && isAmountValid && isBalanceSufficient && !needsApproval;

  return (
    <div className="flex flex-col gap-5 h-full relative">
      {/* Tab toggle */}
      <div className="flex p-1 bg-zinc-950/50 rounded-lg border border-zinc-800/50">
        <button
          className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all font-sans ${
            side === 'yes'
              ? 'bg-amber-500/10 text-amber-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
          onClick={() => setSide('yes')}
        >
          Buy YES
        </button>
        <button
          className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all font-sans ${
            side === 'no'
              ? 'bg-amber-500/10 text-amber-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
          onClick={() => setSide('no')}
        >
          Buy NO
        </button>
      </div>

      <div className="flex flex-col bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-5 gap-4">
        {/* Market Stats */}
        <div className="flex justify-between items-center mb-1">
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500 uppercase font-sans tracking-wider">
              Implied Price
            </span>
            <span className="text-sm text-zinc-300 font-mono">{impliedPriceStr}</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-xs text-zinc-500 uppercase font-sans tracking-wider">
              Best Tick
            </span>
            <span className="text-sm text-zinc-300 font-mono">{bestTickStr}</span>
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs text-zinc-400 uppercase font-sans tracking-wider ml-1">
                Limit Tick (1-999)
              </label>
              <span className="text-xs text-amber-500/80 font-mono">{impliedProb}</span>
            </div>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="999"
                step="1"
                value={tick}
                onChange={(e) => setTick(e.target.value)}
                placeholder="e.g. 500"
                className="w-full bg-zinc-950/50 border border-zinc-800/80 rounded-lg px-4 py-3 text-white font-mono text-lg focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder:text-zinc-600"
                disabled={state.isPending}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs text-zinc-400 uppercase font-sans tracking-wider ml-1">
                Amount (USDC)
              </label>
              <span className="text-xs text-zinc-500 font-mono">Bal: {formatted}</span>
            </div>
            <div className="relative group">
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-zinc-950/50 border border-zinc-800/80 rounded-lg px-4 py-3 text-white font-mono text-lg focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder:text-zinc-600 pr-24"
                disabled={state.isPending}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button
                  onClick={() => setAmount(formatted)}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded transition-colors font-sans"
                  disabled={state.isPending}
                >
                  MAX
                </button>
                <span className="text-zinc-500 font-sans text-sm">USDC</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3">
          {needsApproval ? (
            <button
              onClick={handleApprove}
              disabled={state.isPending}
              className="w-full py-3 px-4 rounded-lg bg-zinc-200 hover:bg-white text-zinc-900 font-sans font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Approve USDC'}
            </button>
          ) : (
            <button
              onClick={handleBuy}
              disabled={!canBuy || state.isPending}
              className="w-full py-3 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-sans font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
            >
              {state.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : !isAmountValid ? (
                'Enter Amount'
              ) : !isTickValid ? (
                'Enter Valid Tick'
              ) : !isBalanceSufficient ? (
                'Insufficient Balance'
              ) : (
                `Buy ${side.toUpperCase()}`
              )}
            </button>
          )}
        </div>

        {/* Feedback Messages */}
        {state.error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm font-sans mt-1 break-words">
            {state.error}
          </div>
        )}
        {state.txHash && !state.error && !state.isPending && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm font-sans mt-1 break-words">
            Success! TX:{' '}
            <span className="font-mono">
              {state.txHash.slice(0, 8)}...{state.txHash.slice(-6)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

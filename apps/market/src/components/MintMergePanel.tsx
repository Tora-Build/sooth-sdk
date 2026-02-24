import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { Loader2 } from 'lucide-react';
import { type LaunchpadMarket } from '../types';
import { useOrderbookTrade } from '../hooks/useOrderbookTrade';
import { useSoothBookBalance } from '../hooks/useSoothBook';
import { useUsdcBalance } from '../hooks/useUsdcBalance';

interface MintMergePanelProps {
  market: LaunchpadMarket;
}

export function MintMergePanel({ market }: MintMergePanelProps) {
  const [tab, setTab] = useState<'mint' | 'merge'>('mint');
  const [amount, setAmount] = useState<string>('');

  const { isConnected } = useAccount();
  const { mint, merge, approve, state } = useOrderbookTrade(market.address);
  const { yesShares, noShares } = useSoothBookBalance(market.address);
  const { balance, allowance, formatted: usdcFormatted, refetch: refetchUsdc } = useUsdcBalance();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-8 text-center bg-zinc-900/30 border border-zinc-800/50 rounded-lg">
        <p className="font-sans">Connect wallet to trade</p>
      </div>
    );
  }

  const parsedAmount = amount && !isNaN(parseFloat(amount)) ? parseUnits(amount, 6) : 0n;
  const needsApproval =
    tab === 'mint' &&
    allowance !== undefined &&
    (allowance < parsedAmount || (parsedAmount === 0n && allowance === 0n));

  const handleApprove = async () => {
    await approve('max');
    refetchUsdc();
  };

  const handleMintMerge = async () => {
    if (!amount || parsedAmount <= 0n) return;

    if (tab === 'mint') {
      await mint(amount);
    } else {
      await merge(amount);
    }

    if (!state.error) {
      setAmount('');
      refetchUsdc();
    }
  };

  const isAmountValid = amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0;

  const yesFormatted = yesShares !== undefined ? (Number(yesShares) / 1e18).toFixed(2) : '0.00';
  const noFormatted = noShares !== undefined ? (Number(noShares) / 1e18).toFixed(2) : '0.00';

  const minShares =
    yesShares !== undefined && noShares !== undefined
      ? yesShares < noShares
        ? yesShares
        : noShares
      : 0n;
  const maxMergeSharesFormatted = (Number(minShares) / 1e18).toFixed(2);
  const maxMergeAmountStr = maxMergeSharesFormatted === '0.00' ? '' : maxMergeSharesFormatted;

  let isBalanceSufficient = true;
  if (tab === 'mint') {
    isBalanceSufficient = balance !== undefined && balance >= parsedAmount;
  } else {
    // Merge needs sufficient shares
    const requiredShares = amount && !isNaN(parseFloat(amount)) ? parseUnits(amount, 18) : 0n;
    isBalanceSufficient = minShares >= requiredShares;
  }

  const canAction = isAmountValid && isBalanceSufficient && !needsApproval;

  return (
    <div className="flex flex-col gap-5 h-full relative">
      <div className="flex p-1 bg-zinc-950/50 rounded-lg border border-zinc-800/50">
        <button
          className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all font-sans ${
            tab === 'mint'
              ? 'bg-amber-500/10 text-amber-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
          onClick={() => {
            setTab('mint');
            setAmount('');
          }}
        >
          Mint
        </button>
        <button
          className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all font-sans ${
            tab === 'merge'
              ? 'bg-amber-500/10 text-amber-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
          onClick={() => {
            setTab('merge');
            setAmount('');
          }}
        >
          Merge
        </button>
      </div>

      <div className="flex flex-col bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-5 gap-4">
        <p className="text-sm text-zinc-400 font-sans text-center mb-2">
          {tab === 'mint'
            ? 'Mint equal YES + NO tokens by depositing USDC'
            : 'Burn equal YES + NO tokens to recover USDC'}
        </p>

        {tab === 'merge' && (
          <div className="flex justify-between items-center mb-1">
            <div className="flex flex-col">
              <span className="text-xs text-zinc-500 uppercase font-sans tracking-wider">
                YES Balance
              </span>
              <span className="text-sm text-zinc-300 font-mono">{yesFormatted}</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-xs text-zinc-500 uppercase font-sans tracking-wider">
                NO Balance
              </span>
              <span className="text-sm text-zinc-300 font-mono">{noFormatted}</span>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs text-zinc-400 uppercase font-sans tracking-wider ml-1">
                {tab === 'mint' ? 'Amount (USDC)' : 'Amount (Shares)'}
              </label>
              <span className="text-xs text-zinc-500 font-mono">
                Bal: {tab === 'mint' ? usdcFormatted : maxMergeSharesFormatted}
              </span>
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
                  onClick={() => setAmount(tab === 'mint' ? usdcFormatted : maxMergeAmountStr)}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded transition-colors font-sans"
                  disabled={state.isPending}
                >
                  MAX
                </button>
                <span className="text-zinc-500 font-sans text-sm">
                  {tab === 'mint' ? 'USDC' : 'SHRS'}
                </span>
              </div>
            </div>
          </div>
        </div>

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
              onClick={handleMintMerge}
              disabled={!canAction || state.isPending}
              className="w-full py-3 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-sans font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
            >
              {state.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : !isAmountValid ? (
                'Enter Amount'
              ) : !isBalanceSufficient ? (
                'Insufficient Balance'
              ) : tab === 'mint' ? (
                'Mint Shares'
              ) : (
                'Merge Shares'
              )}
            </button>
          )}
        </div>

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

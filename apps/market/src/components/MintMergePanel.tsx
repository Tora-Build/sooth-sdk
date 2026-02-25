import { useState } from 'react';
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
  const { mint, merge, approve, isPending } = useOrderbookTrade(market.address, market.soothBookAddress);
  const { yesShares, noShares } = useSoothBookBalance(market.address);
  const { balance, allowance, formatted: usdcFormatted, refetch: refetchUsdc } = useUsdcBalance();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-12 text-center">
        <p>Connect wallet to trade</p>
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

    setAmount('');
    refetchUsdc();
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
    <div className="flex flex-col gap-6">
      <div className="flex p-1 bg-zinc-950 rounded-xl border border-white/[0.06]">
        <button
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all text-center ${
            tab === 'mint'
              ? 'bg-zinc-800 text-zinc-100 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
          onClick={() => {
            setTab('mint');
            setAmount('');
          }}
        >
          Mint
        </button>
        <button
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all text-center ${
            tab === 'merge'
              ? 'bg-zinc-800 text-zinc-100 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
          onClick={() => {
            setTab('merge');
            setAmount('');
          }}
        >
          Merge
        </button>
      </div>

      <div className="flex flex-col gap-6">
        <p className="text-sm text-zinc-500 text-center">
          {tab === 'mint'
            ? 'Mint equal YES + NO tokens by depositing USDC'
            : 'Burn equal YES + NO tokens to recover USDC'}
        </p>

        {tab === 'merge' && (
          <div className="flex justify-between items-center px-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                YES Balance
              </span>
              <span className="text-sm font-medium text-zinc-300 tabular-nums">{yesFormatted}</span>
            </div>
            <div className="flex items-baseline gap-2 text-right">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                NO Balance
              </span>
              <span className="text-sm font-medium text-zinc-300 tabular-nums">{noFormatted}</span>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                {tab === 'mint' ? 'Amount (USDC)' : 'Amount (Shares)'}
              </label>
              <span className="text-[11px] text-zinc-500 font-mono tabular-nums">
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
                className="w-full bg-zinc-950 border border-white/[0.06] rounded-xl px-4 py-3 text-zinc-100 font-mono text-lg focus:outline-none focus:border-white/[0.12] transition-colors placeholder:text-zinc-600 pr-20"
                disabled={isPending}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <button
                  onClick={() => setAmount(tab === 'mint' ? usdcFormatted : maxMergeAmountStr)}
                  className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-2 py-1 rounded-xl transition-colors"
                  disabled={isPending}
                >
                  MAX
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2">
          {needsApproval ? (
            <button
              onClick={handleApprove}
              disabled={isPending}
              className="w-full py-3 rounded-xl bg-zinc-200 hover:bg-white text-zinc-900 font-semibold transition-transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Approve USDC'}
            </button>
          ) : (
            <button
              onClick={handleMintMerge}
              disabled={!canAction || isPending}
              className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-semibold transition-transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending ? (
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


      </div>
    </div>
  );
}

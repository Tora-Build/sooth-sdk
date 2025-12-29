/**
 * DynamicFeeDisplay - Shows fee breakdown from DynamicFeeHook
 *
 * V9 Architecture: Fees are dynamically calculated based on:
 * - Base fee (configurable per market)
 * - Volume discount (higher volume = lower fees)
 * - Volatility premium (high volatility = higher fees)
 */
import { Info, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { useDynamicFee } from '../../hooks/v9';
import { Tooltip } from '../ui/Tooltip';
import { cn } from '../../lib/utils';

interface DynamicFeeDisplayProps {
  marketKey: `0x${string}` | undefined;
  outcome?: 0 | 1;
  shares?: bigint;
  baseFee?: number;
  className?: string;
  compact?: boolean;
}

export const DynamicFeeDisplay = ({
  marketKey,
  outcome = 0,
  shares = 0n,
  baseFee = 50,
  className,
  compact = false,
}: DynamicFeeDisplayProps) => {
  const { fee, isLoading, error } = useDynamicFee(marketKey, outcome, shares, baseFee);

  if (!marketKey || isLoading || error || !fee) {
    return null;
  }

  // Determine if discount or premium is active
  const hasDiscount = fee.effectiveDiscount > 0;
  const hasPremium = fee.effectivePremium > 0;
  const isNetDiscount = fee.feeBps < fee.baseFee;
  const isNetPremium = fee.feeBps > fee.baseFee;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 text-xs', className)}>
        <span className="text-slate-500">Fee:</span>
        <span
          className={cn(
            'font-mono font-bold',
            isNetDiscount && 'text-emerald-400',
            isNetPremium && 'text-amber-400',
            !isNetDiscount && !isNetPremium && 'text-white'
          )}
        >
          {fee.feePercent}
        </span>
        {isNetDiscount && <TrendingDown size={10} className="text-emerald-400" />}
        {isNetPremium && <TrendingUp size={10} className="text-amber-400" />}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'p-3 rounded-lg bg-slate-950/50 border border-slate-800 space-y-2',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap size={12} className="text-indigo-400" />
          <span className="text-[9px] text-slate-500 font-bold uppercase">
            Dynamic Fee
          </span>
          <Tooltip
            content="Fees adjust based on market conditions: high volume earns discounts, high volatility adds premium."
            position="right"
          >
            <Info size={10} className="text-slate-600 cursor-help" />
          </Tooltip>
        </div>
        <span
          className={cn(
            'text-sm font-mono font-bold',
            isNetDiscount && 'text-emerald-400',
            isNetPremium && 'text-amber-400',
            !isNetDiscount && !isNetPremium && 'text-white'
          )}
        >
          {fee.feePercent}
        </span>
      </div>

      {/* Breakdown */}
      <div className="space-y-1 text-[10px]">
        <div className="flex justify-between">
          <span className="text-slate-600">Base Fee</span>
          <span className="font-mono text-slate-400">{fee.breakdown.base}</span>
        </div>

        {hasDiscount && (
          <div className="flex justify-between">
            <span className="text-emerald-600 flex items-center gap-1">
              <TrendingDown size={8} />
              Volume Discount
            </span>
            <span className="font-mono text-emerald-400">
              {fee.breakdown.discount}
            </span>
          </div>
        )}

        {hasPremium && (
          <div className="flex justify-between">
            <span className="text-amber-600 flex items-center gap-1">
              <TrendingUp size={8} />
              Volatility Premium
            </span>
            <span className="font-mono text-amber-400">
              {fee.breakdown.premium}
            </span>
          </div>
        )}

        <div className="flex justify-between pt-1 border-t border-slate-800/50">
          <span className="text-slate-500 font-bold">Effective Fee</span>
          <span
            className={cn(
              'font-mono font-bold',
              isNetDiscount && 'text-emerald-400',
              isNetPremium && 'text-amber-400',
              !isNetDiscount && !isNetPremium && 'text-white'
            )}
          >
            {fee.breakdown.final}
          </span>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="flex gap-2 pt-1">
        {isNetDiscount && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
            <TrendingDown size={8} className="text-emerald-400" />
            <span className="text-[8px] text-emerald-400 font-bold uppercase">
              Discounted
            </span>
          </div>
        )}
        {isNetPremium && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
            <TrendingUp size={8} className="text-amber-400" />
            <span className="text-[8px] text-amber-400 font-bold uppercase">
              Premium Active
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

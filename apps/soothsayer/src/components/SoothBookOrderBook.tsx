import { useMemo, useState, useCallback } from 'react';
import { BookOpen, TrendingUp, TrendingDown, Zap } from 'lucide-react';

export interface OrderLevel {
  tick: number;
  price: number;
  amount: bigint;
  count: number;
  cumulative?: bigint;
}

interface SoothBookOrderBookProps {
  yesBids: OrderLevel[];
  noBids: OrderLevel[];
  yesPrice: number;
  noPrice: number;
  maxLevels?: number;
  onTickSelect?: (side: 'yes' | 'no', tick: number) => void;
  compact?: boolean;
}

export function SoothBookOrderBook({
  yesBids,
  noBids,
  yesPrice,
  noPrice,
  maxLevels = 8,
  onTickSelect,
  compact = false,
}: SoothBookOrderBookProps) {
  const [hoveredLevel, setHoveredLevel] = useState<string | null>(null);

  const { yesLevels, noLevels, maxCumulative } = useMemo(() => {
    // YES bids: best (highest) first
    const sortedYes = [...yesBids].sort((a, b) => b.tick - a.tick).slice(0, maxLevels);
    // NO bids: best (highest) first
    const sortedNo = [...noBids].sort((a, b) => b.tick - a.tick).slice(0, maxLevels);

    // Cumulative amounts
    let yesCum = 0n;
    const yesWithCum = sortedYes.map(l => {
      yesCum += l.amount;
      return { ...l, cumulative: yesCum };
    });

    let noCum = 0n;
    const noWithCum = sortedNo.map(l => {
      noCum += l.amount;
      return { ...l, cumulative: noCum };
    });

    const maxCum = [...yesWithCum, ...noWithCum].reduce(
      (max, l) => (l.cumulative! > max ? l.cumulative! : max),
      1n
    );

    return { yesLevels: yesWithCum, noLevels: noWithCum, maxCumulative: maxCum };
  }, [yesBids, noBids, maxLevels]);

  const spread = yesPrice > 0 && noPrice > 0
    ? ((1 - yesPrice - noPrice) * 100).toFixed(1)
    : null;

  const canMatch = yesLevels[0] && noLevels[0] && (yesLevels[0].tick + noLevels[0].tick >= 1000);

  const handleClick = useCallback((side: 'yes' | 'no', tick: number) => {
    onTickSelect?.(side, tick);
  }, [onTickSelect]);

  return (
    <div className="bg-[#111113] rounded-2xl border border-[#2a2a2d] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2a2a2d] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#666]" />
          <span className="text-xs font-bold text-[#888] uppercase tracking-wider">Order Book</span>
        </div>
        <div className="flex items-center gap-3">
          {canMatch && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-[#00d4aa] bg-[#00d4aa]/10 px-2 py-1 rounded-full border border-[#00d4aa]/20">
              <Zap className="w-3 h-3" /> MATCHABLE
            </span>
          )}
          {spread !== null && (
            <span className="text-[10px] text-[#666] font-mono">
              spread {spread}%
            </span>
          )}
        </div>
      </div>

      {/* Mid price */}
      <div className="px-4 py-2 bg-[#0d0d0f] border-b border-[#2a2a2d] flex items-center justify-center gap-6">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-[#00d4aa]" />
          <span className="text-lg font-bold font-mono text-[#00d4aa]">
            {yesPrice > 0 ? (yesPrice * 100).toFixed(1) : '--'}¢
          </span>
          <span className="text-[10px] text-[#00d4aa]/50 uppercase">yes</span>
        </div>
        <div className="w-px h-5 bg-[#333]" />
        <div className="flex items-center gap-1.5">
          <TrendingDown className="w-3.5 h-3.5 text-[#e01b24]" />
          <span className="text-lg font-bold font-mono text-[#e01b24]">
            {noPrice > 0 ? (noPrice * 100).toFixed(1) : '--'}¢
          </span>
          <span className="text-[10px] text-[#e01b24]/50 uppercase">no</span>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_80px_80px_1fr] px-4 py-1.5 text-[10px] font-bold text-[#444] uppercase tracking-wider border-b border-[#1a1a1d]">
        <span>Cum.</span>
        <span className="text-right">Size</span>
        <span className="text-left pl-3">Size</span>
        <span className="text-right">Cum.</span>
      </div>

      {/* Dual-sided book */}
      <div className={compact ? 'max-h-[280px] overflow-y-auto' : ''}>
        {renderDualBook(yesLevels, noLevels, maxLevels, maxCumulative, hoveredLevel, setHoveredLevel, handleClick)}
      </div>

      {/* Footer */}
      {(yesLevels.length === 0 && noLevels.length === 0) && (
        <div className="px-4 py-8 text-center text-sm text-[#555]">
          No orders yet — be the first to set a price
        </div>
      )}
    </div>
  );
}

function renderDualBook(
  yesLevels: OrderLevel[],
  noLevels: OrderLevel[],
  maxLevels: number,
  maxCumulative: bigint,
  hoveredLevel: string | null,
  setHoveredLevel: (key: string | null) => void,
  onTickClick: (side: 'yes' | 'no', tick: number) => void,
) {
  const rows = Math.max(yesLevels.length, noLevels.length, 1);
  const elements: JSX.Element[] = [];

  for (let i = 0; i < Math.min(rows, maxLevels); i++) {
    const yes = yesLevels[i];
    const no = noLevels[i];
    const key = `row-${i}`;

    elements.push(
      <div
        key={key}
        className="grid grid-cols-[1fr_80px_80px_1fr] items-center relative group"
      >
        {/* YES side (left) */}
        {yes ? (
          <>
            {/* YES depth bar (grows right-to-left) */}
            <div className="absolute left-0 top-0 bottom-0 pointer-events-none" style={{ width: '50%' }}>
              <div
                className="absolute right-0 top-0 bottom-0 bg-[#00d4aa]/8 transition-all duration-200"
                style={{ width: `${(Number(yes.cumulative!) * 100) / Number(maxCumulative)}%` }}
              />
            </div>

            <button
              className={`relative px-4 py-1.5 text-left font-mono text-xs transition-colors cursor-pointer hover:bg-[#00d4aa]/10 ${hoveredLevel === `yes-${yes.tick}` ? 'bg-[#00d4aa]/15' : ''}`}
              onMouseEnter={() => setHoveredLevel(`yes-${yes.tick}`)}
              onMouseLeave={() => setHoveredLevel(null)}
              onClick={() => onTickClick('yes', yes.tick)}
            >
              <span className="text-[#00d4aa]/40">{fmtAmt(yes.cumulative!)}</span>
            </button>
            <button
              className={`relative px-2 py-1.5 text-right font-mono text-xs transition-colors cursor-pointer hover:bg-[#00d4aa]/10 ${hoveredLevel === `yes-${yes.tick}` ? 'bg-[#00d4aa]/15' : ''}`}
              onMouseEnter={() => setHoveredLevel(`yes-${yes.tick}`)}
              onMouseLeave={() => setHoveredLevel(null)}
              onClick={() => onTickClick('yes', yes.tick)}
            >
              <span className="text-[#00d4aa] font-bold">{fmtAmt(yes.amount)}</span>
              <div className="text-[10px] text-[#00d4aa]/50">{(yes.price * 100).toFixed(1)}¢</div>
            </button>
          </>
        ) : (
          <>
            <div className="px-4 py-1.5" />
            <div className="px-2 py-1.5" />
          </>
        )}

        {/* NO side (right) */}
        {no ? (
          <>
            {/* NO depth bar (grows left-to-right) */}
            <div className="absolute right-0 top-0 bottom-0 pointer-events-none" style={{ width: '50%' }}>
              <div
                className="absolute left-0 top-0 bottom-0 bg-[#e01b24]/8 transition-all duration-200"
                style={{ width: `${(Number(no.cumulative!) * 100) / Number(maxCumulative)}%` }}
              />
            </div>

            <button
              className={`relative px-2 py-1.5 pl-3 text-left font-mono text-xs transition-colors cursor-pointer hover:bg-[#e01b24]/10 ${hoveredLevel === `no-${no.tick}` ? 'bg-[#e01b24]/15' : ''}`}
              onMouseEnter={() => setHoveredLevel(`no-${no.tick}`)}
              onMouseLeave={() => setHoveredLevel(null)}
              onClick={() => onTickClick('no', no.tick)}
            >
              <span className="text-[#e01b24] font-bold">{fmtAmt(no.amount)}</span>
              <div className="text-[10px] text-[#e01b24]/50">{(no.price * 100).toFixed(1)}¢</div>
            </button>
            <button
              className={`relative px-4 py-1.5 text-right font-mono text-xs transition-colors cursor-pointer hover:bg-[#e01b24]/10 ${hoveredLevel === `no-${no.tick}` ? 'bg-[#e01b24]/15' : ''}`}
              onMouseEnter={() => setHoveredLevel(`no-${no.tick}`)}
              onMouseLeave={() => setHoveredLevel(null)}
              onClick={() => onTickClick('no', no.tick)}
            >
              <span className="text-[#e01b24]/40">{fmtAmt(no.cumulative!)}</span>
            </button>
          </>
        ) : (
          <>
            <div className="px-2 py-1.5" />
            <div className="px-4 py-1.5" />
          </>
        )}
      </div>
    );
  }

  return <>{elements}</>;
}

function fmtAmt(amount: bigint): string {
  const num = Number(amount) / 1e18;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  if (num >= 1) return num.toFixed(0);
  if (num >= 0.01) return num.toFixed(2);
  return num > 0 ? '<0.01' : '0';
}

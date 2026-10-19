import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { formatCents, formatChartTime, formatCompact, tokenAmountToNumber } from './format.js';
import type { SoothStrings } from './i18n.js';
import { Segmented } from './primitives.js';

/** Time range shown by the price chart. */
export type SoothChartRange = '5m' | '1h' | '1d' | 'all';

export interface SoothChartPoint {
  /** Unix seconds. */
  time: number;
  /** YES price 0..1. */
  yes: number;
}

export interface SoothChartDepthLevel {
  /** YES price 0..1. */
  price: number;
  tick: number;
  /** WAD shares. */
  shares: bigint;
}

const WIDTH = 320;
const HEIGHT = 140;
/** Same cap as Demo's HistoricalPriceCard: older points squash the visible window. */
const MAX_POINTS = 120;
const RANGES: readonly SoothChartRange[] = ['5m', '1h', '1d', 'all'];

export interface PriceChartProps {
  strings: SoothStrings;
  points: readonly SoothChartPoint[];
  range: SoothChartRange;
  onRangeChange: (range: SoothChartRange) => void;
  status: 'loading' | 'ready' | 'unavailable';
  /** Optional detail shown under the unavailable message. */
  reason?: string;
}

/** YES price line/area with range tabs and a pointer/keyboard crosshair. */
export function PriceChart({
  strings,
  points,
  range,
  onRangeChange,
  status,
  reason,
}: PriceChartProps) {
  const { t, locale } = strings;
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const visible = useMemo(
    () => (points.length > MAX_POINTS ? points.slice(-MAX_POINTS) : points),
    [points],
  );
  const geometry = useMemo(() => {
    if (visible.length < 2) return null;
    let min = 1;
    let max = 0;
    for (const point of visible) {
      min = Math.min(min, point.yes);
      max = Math.max(max, point.yes);
    }
    const low = Math.max(0, min - 0.05);
    const high = Math.min(1, max + 0.05);
    const span = Math.max(high - low, 0.01);
    // Index-based x keeps sparse, clustered history readable (Mobile PriceChart technique).
    const denom = visible.length - 1;
    const coords = visible.map((point, index) => ({
      x: (index / denom) * WIDTH,
      y: HEIGHT - ((point.yes - low) / span) * (HEIGHT - 8) - 4,
    }));
    const line = coords
      .map((c, index) => `${index === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ');
    return { coords, line, low, high };
  }, [visible]);

  const tabs = (
    <Segmented
      size="sm"
      label={t('chart.history')}
      value={range}
      onChange={(next) => {
        setHover(null);
        onRangeChange(next);
      }}
      options={RANGES.map((value) => ({
        value,
        label: t(
          value === '5m'
            ? 'chart.range5m'
            : value === '1h'
              ? 'chart.range1h'
              : value === '1d'
                ? 'chart.range1d'
                : 'chart.rangeAll',
        ),
      }))}
    />
  );

  const activeIndex = hover !== null && hover < visible.length ? hover : null;
  const shown = visible[activeIndex ?? visible.length - 1];
  const first = visible[0];
  const last = visible[visible.length - 1];
  const spanSeconds = first && last ? last.time - first.time : 0;

  const pickFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || visible.length < 2) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (visible.length - 1)));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (visible.length < 2) return;
    const current = activeIndex ?? visible.length - 1;
    let next: number | null = null;
    if (event.key === 'ArrowLeft') next = Math.max(0, current - 1);
    else if (event.key === 'ArrowRight') next = Math.min(visible.length - 1, current + 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = visible.length - 1;
    else if (event.key === 'Escape') next = null;
    else return;
    event.preventDefault();
    setHover(next);
  };

  let body: ReactNode;
  if (!geometry || !first || !last) {
    const message =
      status === 'loading'
        ? t('chart.loading')
        : status === 'unavailable'
          ? t('chart.unavailable')
          : visible.length === 0
            ? t('chart.empty')
            : t('chart.notEnough');
    body = (
      <div className="s-chart-empty" role={status === 'loading' ? undefined : 'status'}>
        <span>
          {message}
          {status === 'unavailable' && reason ? (
            <span className="s-small s-muted" style={{ display: 'block', marginTop: 4 }}>
              {reason}
            </span>
          ) : null}
        </span>
      </div>
    );
  } else {
    const point = activeIndex !== null ? geometry.coords[activeIndex] : undefined;
    const leftPct = point ? (point.x / WIDTH) * 100 : 0;
    body = (
      <>
        <div
          className="s-chart-plot"
          role="img"
          tabIndex={0}
          aria-label={t('chart.summary', {
            first: formatCents(first.yes),
            last: formatCents(last.yes),
            count: visible.length,
          })}
          onPointerMove={pickFromPointer}
          onPointerDown={pickFromPointer}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKeyDown}
          onBlur={() => setHover(null)}
        >
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((fraction) => (
              <line
                key={fraction}
                className="s-chart-grid"
                x1="0"
                x2={WIDTH}
                y1={HEIGHT * fraction}
                y2={HEIGHT * fraction}
              />
            ))}
            <path
              className="s-chart-area"
              d={`${geometry.line} L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`}
              fill={`url(#${gradientId})`}
            />
            <path className="s-chart-line" d={geometry.line} />
            {point && (
              <line className="s-chart-cross" x1={point.x} x2={point.x} y1="0" y2={HEIGHT} />
            )}
          </svg>
          {point && shown && (
            <>
              <span
                className="s-chart-dot"
                style={{ left: `${leftPct}%`, top: `${(point.y / HEIGHT) * 100}%` }}
              />
              <span
                className="s-chart-tip"
                data-testid="chart-crosshair"
                style={{ left: `${Math.min(85, Math.max(15, leftPct))}%` }}
              >
                {formatCents(shown.yes)} · {formatChartTime(shown.time, spanSeconds, locale)}
              </span>
            </>
          )}
        </div>
        <div className="s-chart-axis" aria-hidden="true">
          <span>{formatChartTime(first.time, spanSeconds, locale)}</span>
          <span>
            {formatCents(geometry.low, 0)}–{formatCents(geometry.high, 0)}
          </span>
          <span>{formatChartTime(last.time, spanSeconds, locale)}</span>
        </div>
      </>
    );
  }

  return (
    <section className="s-chart" aria-label={t('chart.history')}>
      <div className="s-chart-head">
        <div className="s-stack" style={{ gap: 0 }}>
          <span className="s-chart-title">{t('chart.price')}</span>
          <span className="s-chart-value" aria-live="off">
            {shown && geometry ? formatCents(shown.yes) : '—'}
          </span>
        </div>
        {tabs}
      </div>
      {body}
    </section>
  );
}

function formatSize(shares: bigint, locale: SoothStrings['locale']): string {
  const value = tokenAmountToNumber(shares, 18);
  if (value >= 1000) return formatCompact(value, locale);
  return value >= 1 ? value.toFixed(1) : value.toFixed(2);
}

export interface DepthLadderProps {
  strings: SoothStrings;
  bids: readonly SoothChartDepthLevel[];
  asks: readonly SoothChartDepthLevel[];
  /** Rows per side, clamped to 8..12. */
  rows?: number;
  loading?: boolean;
  /** False when the depth source returned a partial book. */
  complete?: boolean;
}

/** Bid/ask ladder with size bars, mid price and spread (Mobile OrderbookChart layout). */
export function DepthLadder({
  strings,
  bids,
  asks,
  rows = 10,
  loading = false,
  complete = true,
}: DepthLadderProps) {
  const { t, locale } = strings;
  const count = Math.min(12, Math.max(8, Math.floor(rows)));
  const { top, maxBid, maxAsk, mid, spread } = useMemo(() => {
    const topBids = bids
      .filter((level) => level.shares > 0n)
      .sort((a, b) => b.price - a.price)
      .slice(0, count);
    const topAsks = asks
      .filter((level) => level.shares > 0n)
      .sort((a, b) => a.price - b.price)
      .slice(0, count);
    let bidMax = 0n;
    let askMax = 0n;
    for (const level of topBids) if (level.shares > bidMax) bidMax = level.shares;
    for (const level of topAsks) if (level.shares > askMax) askMax = level.shares;
    const bestBid = topBids[0]?.price;
    const bestAsk = topAsks[0]?.price;
    return {
      top: { bids: topBids, asks: topAsks },
      maxBid: bidMax,
      maxAsk: askMax,
      mid: bestBid !== undefined && bestAsk !== undefined ? (bestBid + bestAsk) / 2 : null,
      spread: bestBid !== undefined && bestAsk !== undefined ? bestAsk - bestBid : null,
    };
  }, [bids, asks, count]);

  const header = (
    <div className="s-chart-head">
      <span className="s-chart-title">{t('chart.depth')}</span>
      <span className="s-legend" aria-hidden="true">
        <span data-side="bid">{t('chart.bid')}</span>
        <span data-side="ask">{t('chart.ask')}</span>
      </span>
    </div>
  );

  if (top.bids.length === 0 && top.asks.length === 0) {
    return (
      <section className="s-chart" aria-label={t('chart.depth')}>
        {header}
        <div className="s-chart-empty" role={loading ? undefined : 'status'}>
          {loading ? t('chart.depthLoading') : t('chart.noOrders')}
        </div>
      </section>
    );
  }

  const percent = (shares: bigint, max: bigint) =>
    max > 0n ? Number((shares * 1000n) / max) / 10 : 0;
  const lines = Array.from({ length: count }, (_, index) => ({
    bid: top.bids[index],
    ask: top.asks[index],
  }));

  return (
    <section className="s-chart" aria-label={t('chart.depth')}>
      {header}
      <div
        className="s-ladder"
        role="img"
        aria-label={t('chart.depthSummary', {
          bids: top.bids.length,
          asks: top.asks.length,
          mid: formatCents(mid),
          spread: formatCents(spread),
        })}
      >
        <div className="s-ladder-head" aria-hidden="true">
          <span>{t('chart.bids')}</span>
          <span>{t('chart.asks')}</span>
        </div>
        {lines.map(({ bid, ask }, index) => (
          <div className="s-ladder-row" key={index} aria-hidden="true">
            <div className="s-ladder-cell" data-side="bid" data-testid="ladder-bid">
              {bid && (
                <>
                  <span
                    className="s-ladder-bar"
                    style={{ width: `${percent(bid.shares, maxBid)}%` }}
                  />
                  <span className="s-ladder-size">{formatSize(bid.shares, locale)}</span>
                  <span className="s-ladder-price">{formatCents(bid.price)}</span>
                </>
              )}
            </div>
            <div className="s-ladder-cell" data-side="ask" data-testid="ladder-ask">
              {ask && (
                <>
                  <span
                    className="s-ladder-bar"
                    style={{ width: `${percent(ask.shares, maxAsk)}%` }}
                  />
                  <span className="s-ladder-price">{formatCents(ask.price)}</span>
                  <span className="s-ladder-size">{formatSize(ask.shares, locale)}</span>
                </>
              )}
            </div>
          </div>
        ))}
        <div className="s-ladder-mid" aria-hidden="true">
          <span>
            {t('chart.mid')} <strong data-testid="ladder-mid">{formatCents(mid)}</strong>
          </span>
          <span>
            {t('chart.spread')} <strong data-testid="ladder-spread">{formatCents(spread)}</strong>
          </span>
        </div>
      </div>
      {!complete && <span className="s-small s-muted">{t('chart.depthPartial')}</span>}
    </section>
  );
}

export interface LiquidityMapProps {
  strings: SoothStrings;
  bids: readonly SoothChartDepthLevel[];
  asks: readonly SoothChartDepthLevel[];
  /** Number of equal price buckets across 0..1 (default 20). */
  buckets?: number;
  loading?: boolean;
}

/** Resting liquidity summed into equal YES-price buckets (Demo LiquidityMap technique). */
export function LiquidityMap({
  strings,
  bids,
  asks,
  buckets = 20,
  loading = false,
}: LiquidityMapProps) {
  const { t, locale } = strings;
  const size = Math.min(50, Math.max(4, Math.floor(buckets)));
  const bars = useMemo(() => {
    const sums = Array.from({ length: size }, () => ({ bid: 0n, ask: 0n }));
    const add = (levels: readonly SoothChartDepthLevel[], side: 'bid' | 'ask') => {
      for (const level of levels) {
        if (level.shares <= 0n || !Number.isFinite(level.price)) continue;
        const index = Math.min(size - 1, Math.max(0, Math.floor(level.price * size)));
        const bucket = sums[index];
        if (bucket) bucket[side] += level.shares;
      }
    };
    add(bids, 'bid');
    add(asks, 'ask');
    let max = 0n;
    for (const bucket of sums) {
      const total = bucket.bid + bucket.ask;
      if (total > max) max = total;
    }
    return { sums, max };
  }, [bids, asks, size]);

  const header = (
    <div className="s-chart-head">
      <span className="s-chart-title">{t('chart.liquidity')}</span>
      <span className="s-legend" aria-hidden="true">
        <span data-side="bid">{t('chart.bids')}</span>
        <span data-side="ask">{t('chart.asks')}</span>
      </span>
    </div>
  );

  if (bars.max === 0n) {
    return (
      <section className="s-chart" aria-label={t('chart.liquidity')}>
        {header}
        <div className="s-chart-empty" role={loading ? undefined : 'status'}>
          {loading ? t('chart.depthLoading') : t('chart.noLiquidity')}
        </div>
      </section>
    );
  }

  return (
    <section className="s-chart" aria-label={t('chart.liquidity')}>
      {header}
      <div
        className="s-liq"
        role="img"
        aria-label={t('chart.liquiditySummary', {
          count: bars.sums.filter((bucket) => bucket.bid + bucket.ask > 0n).length,
        })}
      >
        {bars.sums.map((bucket, index) => {
          const total = bucket.bid + bucket.ask;
          const side = total === 0n ? 'empty' : bucket.bid >= bucket.ask ? 'bid' : 'ask';
          const height = total === 0n ? 2 : Math.max(4, Number((total * 1000n) / bars.max) / 10);
          return (
            <span
              key={index}
              className="s-liq-bar"
              data-side={side}
              title={`${formatCents(index / size, 0)}–${formatCents((index + 1) / size, 0)}: ${formatSize(total, locale)}`}
              style={{ height: total === 0n ? `${height}px` : `${height}%` }}
            />
          );
        })}
      </div>
      <div className="s-chart-axis" aria-hidden="true">
        <span>0¢</span>
        <span>50¢</span>
        <span>100¢</span>
      </div>
    </section>
  );
}

export interface ChartSlide {
  id: string;
  label: string;
  content: ReactNode;
}

export interface ChartCarouselProps {
  label: string;
  slides: readonly ChartSlide[];
  initial?: string;
}

/** Tabbed switcher between chart views (Mobile ChartCarousel, as accessible tabs). */
export function ChartCarousel({ label, slides, initial }: ChartCarouselProps) {
  const baseId = useId();
  const [selected, setSelected] = useState(initial ?? slides[0]?.id ?? '');
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(
    0,
    slides.findIndex((slide) => slide.id === selected),
  );
  const active = slides[activeIndex];
  if (!active) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (activeIndex + 1) % slides.length;
    else if (event.key === 'ArrowLeft') next = (activeIndex - 1 + slides.length) % slides.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = slides.length - 1;
    const slide = next === null ? undefined : slides[next];
    if (next === null || !slide) return;
    event.preventDefault();
    setSelected(slide.id);
    tabs.current[next]?.focus();
  };

  return (
    <div className="s-chart">
      {slides.length > 1 && (
        <div role="tablist" aria-label={label} className="s-seg s-seg-sm" onKeyDown={onKeyDown}>
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              ref={(node) => {
                tabs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${index}`}
              aria-controls={`${baseId}-panel`}
              aria-selected={index === activeIndex}
              tabIndex={index === activeIndex ? 0 : -1}
              className="s-seg-btn"
              onClick={() => setSelected(slide.id)}
            >
              {slide.label}
            </button>
          ))}
        </div>
      )}
      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${activeIndex}`}
        className="s-carousel-panel"
      >
        {active.content}
      </div>
    </div>
  );
}

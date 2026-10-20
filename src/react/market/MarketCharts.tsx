import { useState } from 'react';
import type { SoothDepth } from '../data.js';
import { useSoothPriceHistory, type SoothDataState } from '../dataHooks.js';
import type { SoothResolvedMarket } from '../runtime.js';
import {
  ChartCarousel,
  DepthLadder,
  LiquidityMap,
  PriceChart,
  type ChartSlide,
  type SoothChartRange,
} from '../ui/charts.js';
import type { SoothStrings } from '../ui/i18n.js';

export interface MarketChartsProps {
  strings: SoothStrings;
  resolved: SoothResolvedMarket;
  /** Book depth read once by the market view; null on the AMM venue. */
  depth: SoothDataState<SoothDepth> | null;
}

/** Price history for both venues; the book adds ladder and liquidity views (Mobile ChartCarousel). */
export function MarketCharts({ strings, resolved, depth }: MarketChartsProps) {
  const { t } = strings;
  const [range, setRange] = useState<SoothChartRange>('1d');
  const history = useSoothPriceHistory(resolved, range);
  const status = history.data
    ? history.data.source === 'unavailable'
      ? 'unavailable'
      : 'ready'
    : history.error
      ? 'unavailable'
      : 'loading';
  const slides: ChartSlide[] = [
    {
      id: 'price',
      label: t('chart.history'),
      content: (
        <PriceChart
          strings={strings}
          points={history.data?.points ?? []}
          range={range}
          onRangeChange={setRange}
          status={status}
          reason={history.data?.reason ?? history.error ?? undefined}
        />
      ),
    },
  ];
  if (depth) {
    const loading = !depth.data && !depth.error;
    const failed = depth.error && (
      <p className="s-small s-muted">
        {t('common.unavailable')}: {depth.error}
      </p>
    );
    slides.push(
      {
        id: 'depth',
        label: t('chart.depth'),
        content: (
          <>
            <DepthLadder
              strings={strings}
              bids={depth.data?.bids ?? []}
              asks={depth.data?.asks ?? []}
              loading={loading}
              complete={depth.data?.complete ?? true}
            />
            {failed}
          </>
        ),
      },
      {
        id: 'liquidity',
        label: t('chart.liquidity'),
        content: (
          <>
            <LiquidityMap
              strings={strings}
              bids={depth.data?.bids ?? []}
              asks={depth.data?.asks ?? []}
              loading={loading}
            />
            {failed}
          </>
        ),
      },
    );
  }
  return (
    <section className="s-card" aria-label={t('chart.history')}>
      <ChartCarousel label={t('chart.views')} slides={slides} />
    </section>
  );
}

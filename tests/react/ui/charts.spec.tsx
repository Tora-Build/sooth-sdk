// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DepthLadder,
  LiquidityMap,
  PriceChart,
  type SoothChartDepthLevel,
} from '../../../src/react/ui/charts.js';
import { soothText } from '../../../src/react/ui/i18n.js';

afterEach(cleanup);
// jsdom has no PointerEvent; without it fireEvent drops clientX from pointer events.
if (typeof window.PointerEvent === 'undefined') {
  Object.defineProperty(window, 'PointerEvent', { value: window.MouseEvent });
}

const strings = soothText('en');
const WAD = 10n ** 18n;
const level = (price: number, shares: bigint): SoothChartDepthLevel => ({
  price,
  tick: Math.round(price * 1000),
  shares: shares * WAD,
});
const noop = () => undefined;

describe('PriceChart', () => {
  it('shows loading, unavailable and empty states', () => {
    const { rerender } = render(
      <PriceChart strings={strings} points={[]} range="1h" onRangeChange={noop} status="loading" />,
    );
    expect(screen.getByText('Loading chart…')).toBeTruthy();

    rerender(
      <PriceChart
        strings={strings}
        points={[]}
        range="1h"
        onRangeChange={noop}
        status="unavailable"
        reason="No indexer configured"
      />,
    );
    expect(screen.getByRole('status').textContent).toBe(
      'Price history unavailableNo indexer configured',
    );

    rerender(
      <PriceChart strings={strings} points={[]} range="1h" onRangeChange={noop} status="ready" />,
    );
    expect(screen.getByRole('status').textContent).toBe('No price history yet');

    rerender(
      <PriceChart
        strings={strings}
        points={[{ time: 1, yes: 0.4 }]}
        range="1h"
        onRangeChange={noop}
        status="ready"
      />,
    );
    expect(screen.getByRole('status').textContent).toBe('Not enough data for this range yet');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('reports the crosshair value under the pointer and by keyboard', () => {
    const points = [
      { time: 1_700_000_000, yes: 0.2 },
      { time: 1_700_000_060, yes: 0.5 },
      { time: 1_700_000_120, yes: 0.8 },
    ];
    render(
      <PriceChart strings={strings} points={points} range="1h" onRangeChange={noop} status="ready" />,
    );
    const plot = screen.getByRole('img');
    expect(plot.getAttribute('aria-label')).toBe('YES price from 20.0¢ to 80.0¢ over 3 points');
    vi.spyOn(plot, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 300,
      height: 160,
      right: 300,
      bottom: 160,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(plot, { clientX: 140 });
    expect(screen.getByTestId('chart-crosshair').textContent).toMatch(/^50\.0¢ · /);

    fireEvent.keyDown(plot, { key: 'Home' });
    expect(screen.getByTestId('chart-crosshair').textContent).toMatch(/^20\.0¢ · /);

    fireEvent.pointerLeave(plot);
    expect(screen.queryByTestId('chart-crosshair')).toBeNull();
  });

  it('switches range through the tabs', () => {
    const onRangeChange = vi.fn();
    render(
      <PriceChart strings={strings} points={[]} range="1h" onRangeChange={onRangeChange} status="ready" />,
    );
    fireEvent.click(screen.getByRole('radio', { name: '1d' }));
    expect(onRangeChange).toHaveBeenCalledWith('1d');
  });
});

describe('DepthLadder', () => {
  it('orders bids high to low and asks low to high with mid and spread', () => {
    render(
      <DepthLadder
        strings={strings}
        bids={[level(0.4, 5n), level(0.45, 10n), level(0.3, 2n), level(0.2, 0n)]}
        asks={[level(0.6, 3n), level(0.55, 8n)]}
        rows={8}
      />,
    );
    const bids = screen.getAllByTestId('ladder-bid').map((cell) => cell.textContent);
    const asks = screen.getAllByTestId('ladder-ask').map((cell) => cell.textContent);
    expect(bids).toHaveLength(8);
    expect(bids.slice(0, 4)).toEqual(['10.045.0¢', '5.040.0¢', '2.030.0¢', '']);
    expect(asks.slice(0, 3)).toEqual(['55.0¢8.0', '60.0¢3.0', '']);
    expect(screen.getByTestId('ladder-mid').textContent).toBe('50.0¢');
    expect(screen.getByTestId('ladder-spread').textContent).toBe('10.0¢');
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      '3 bid levels and 2 ask levels; mid 50.0¢, spread 10.0¢',
    );
  });

  it('shows a dash for mid and spread when one side is empty', () => {
    render(<DepthLadder strings={strings} bids={[level(0.4, 1n)]} asks={[]} />);
    expect(screen.getAllByTestId('ladder-bid')).toHaveLength(10);
    expect(screen.getByTestId('ladder-mid').textContent).toBe('—');
    expect(screen.getByTestId('ladder-spread').textContent).toBe('—');
  });

  it('shows loading and empty states and flags partial depth', () => {
    const { rerender } = render(<DepthLadder strings={strings} bids={[]} asks={[]} loading />);
    expect(screen.getByText('Loading order book…')).toBeTruthy();
    rerender(<DepthLadder strings={strings} bids={[]} asks={[]} />);
    expect(screen.getByRole('status').textContent).toBe('No orders yet');
    rerender(<DepthLadder strings={strings} bids={[level(0.4, 1n)]} asks={[]} complete={false} />);
    expect(screen.getByText('Showing partial depth')).toBeTruthy();
  });
});

describe('LiquidityMap', () => {
  it('buckets resting liquidity by price', () => {
    const { container } = render(
      <LiquidityMap
        strings={strings}
        buckets={10}
        bids={[level(0.41, 4n), level(0.44, 4n)]}
        asks={[level(0.62, 2n), level(1, 1n)]}
      />,
    );
    const bars = [...container.querySelectorAll('.s-liq-bar')];
    expect(bars).toHaveLength(10);
    expect(bars[4]?.getAttribute('data-side')).toBe('bid');
    expect((bars[4] as HTMLElement).style.height).toBe('100%');
    expect(bars[6]?.getAttribute('data-side')).toBe('ask');
    expect((bars[6] as HTMLElement).style.height).toBe('25%');
    expect(bars[9]?.getAttribute('data-side')).toBe('ask');
    expect(bars[0]?.getAttribute('data-side')).toBe('empty');
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Resting liquidity across 3 price buckets',
    );
  });

  it('shows an empty state without liquidity', () => {
    render(<LiquidityMap strings={strings} bids={[]} asks={[]} />);
    expect(screen.getByRole('status').textContent).toBe('No resting liquidity');
  });
});

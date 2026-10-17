// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address, Hash } from 'viem';
import { SoothNode, type SoothNodeProps } from '../../src/react/SoothNode.js';
import { SoothProvider } from '../../src/react/hooks.js';
import type { SoothResolvedNode, SoothRuntime } from '../../src/react/runtime.js';
import type { FactoryCatalogMarket } from '../../src/factory/schema.js';
import type { SoothMarketProps } from '../../src/react/SoothMarket.js';
import type { SoothCreateMarketProps } from '../../src/react/SoothCreateMarket.js';

const children = vi.hoisted(() => ({ market: vi.fn(), create: vi.fn() }));
vi.mock('../../src/react/SoothMarket.js', () => ({ SoothMarket: (props: SoothMarketProps) => {
  children.market(props);
  return <div data-testid="market-detail">Trading {props.market && typeof props.market !== 'string' ? props.market.venue : ''}</div>;
} }));
vi.mock('../../src/react/SoothCreateMarket.js', () => ({ SoothCreateMarket: (props: SoothCreateMarketProps) => {
  children.create(props);
  return <div><h3>Create a prediction</h3><button onClick={props.onCancel}>Cancel creation</button><button onClick={() => props.onCreated(`0x${'9'.repeat(40)}`)}>Confirm creation</button></div>;
} }));
const address = (digit: string) => `0x${digit.repeat(40)}` as Address;
const hash = (digit: string) => `0x${digit.repeat(64)}` as Hash;
const reference = { chainId: 46630, factory: address('1'), nodeId: hash('2'), releaseId: hash('3') };
function market(digit: string, question: string, settled = false): FactoryCatalogMarket {
  return {
    key: digit, address: address(digit), identity: reference, question, tokenA: address('8'),
    deadline: '2000000000', tradingOpen: !settled,
    state: { phase: settled ? 'settled' : 'live', outcome: settled ? 1 : null },
    listing: { state: 'listed' },
  } as FactoryCatalogMarket;
}
function fixture() {
  const catalog = { items: [market('4', 'Will the launch happen?'), market('5', 'Did the vote pass?', true)], facts: { source: 'live', ageSeconds: 0 }, indexed: { blockNumber: 123 } } as SoothResolvedNode['catalog'];
  const resolved = {
    reference, context: { ...reference, release: { releaseId: reference.releaseId } },
    node: { node: reference, metadata: { label: 'Community forecasts', description: 'Markets chosen by this community' } },
    catalog, refreshCatalog: vi.fn().mockResolvedValue(catalog),
  } as unknown as SoothResolvedNode;
  const runtime: SoothRuntime = { resolveNode: vi.fn().mockResolvedValue(resolved), resolve: vi.fn() };
  return { resolved, runtime };
}
async function mount(props: Partial<SoothNodeProps> = {}) {
  const { runtime, resolved } = fixture();
  const view = render(<SoothNode node={reference} runtime={runtime} {...props} />);
  const root = view.container.querySelector('[data-sooth-node]')!.shadowRoot!;
  const ui = within(root as unknown as HTMLElement);
  await ui.findByRole('heading', { name: 'Community forecasts' });
  return { ...view, ui, root, runtime, resolved };
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: vi.fn(function(this: HTMLDialogElement) { this.setAttribute('open', ''); }) });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: vi.fn(function(this: HTMLDialogElement) { this.removeAttribute('open'); }) });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('SoothNode browsing and scope', () => {
  it('browses catalog facts without invented prices, then opens AMM and returns to the same search', async () => {
    const onMarketChange = vi.fn();
    const { ui } = await mount({ initialVenue: 'book', onMarketChange });
    expect(ui.queryByText('50%')).toBeNull();
    expect(ui.queryByRole('button', { name: 'Create market' })).toBeNull();
    fireEvent.change(ui.getByRole('searchbox'), { target: { value: 'launch' } });
    fireEvent.click(ui.getByRole('button', { name: /Will the launch happen/ }));
    await ui.findByTestId('market-detail');
    expect(children.market.mock.lastCall?.[0].market).toEqual({ ...reference, market: address('4'), venue: 'amm' });
    expect(ui.queryByRole('button', { name: 'Order book' })).toBeNull();
    expect(onMarketChange).toHaveBeenLastCalledWith({ ...reference, market: address('4'), venue: 'amm' });
    fireEvent.click(ui.getByRole('button', { name: /All markets/ }));
    expect((ui.getByRole('searchbox') as HTMLInputElement).value).toBe('launch');
    expect(onMarketChange).toHaveBeenLastCalledWith(undefined);
  });
  it('filters settled outcomes and handles empty search without losing the catalog', async () => {
    const { ui } = await mount();
    fireEvent.click(ui.getByRole('button', { name: 'Resolved' }));
    expect(ui.getByText('YES won')).toBeTruthy();
    expect(ui.queryByText('Will the launch happen?')).toBeNull();
    fireEvent.change(ui.getByRole('searchbox'), { target: { value: 'missing' } });
    expect(ui.getByRole('heading', { name: 'No matching markets' })).toBeTruthy();
    fireEvent.click(ui.getByRole('button', { name: 'Clear search' }));
    expect(ui.getByText('YES won')).toBeTruthy();
  });
  it('gates creation and CLOB explicitly and falls back when CLOB is disabled', async () => {
    const { ui, rerender, runtime } = await mount({ features: { create: true, clob: true }, initialMarket: address('4'), initialVenue: 'book' });
    expect(children.market.mock.lastCall?.[0].market.venue).toBe('book');
    fireEvent.click(ui.getByRole('button', { name: 'AMM' }));
    expect(children.market.mock.lastCall?.[0].market.venue).toBe('amm');
    fireEvent.click(ui.getByRole('button', { name: 'Order book' }));
    rerender(<SoothNode node={reference} runtime={runtime} features={{ create: true }} initialMarket={address('4')} initialVenue="book" />);
    expect(children.market.mock.lastCall?.[0].market.venue).toBe('amm');
    fireEvent.click(ui.getByRole('button', { name: /All markets/ }));
    fireEvent.click(ui.getByRole('button', { name: 'Create market' }));
    expect(ui.getByRole('heading', { name: 'Create a prediction' })).toBeTruthy();
    fireEvent.click(ui.getByRole('button', { name: 'Cancel creation' }));
    expect(ui.getByRole('searchbox')).toBeTruthy();
  });
  it('does not honor a disabled creation deep link or an unlisted initial market address', async () => {
    const { ui } = await mount({ initialView: 'create', initialMarket: address('7') });
    expect(children.create).not.toHaveBeenCalled();
    expect(children.market).not.toHaveBeenCalled();
    expect(ui.getByRole('heading', { name: 'Market unavailable in this node' })).toBeTruthy();
  });
  it('rejects catalog responses containing a foreign node before showing any market', async () => {
    const { runtime, resolved } = fixture();
    resolved.catalog.items[0].identity = { ...reference, nodeId: hash('7') };
    const view = render(<SoothNode node={reference} runtime={runtime} />);
    const ui = within(view.container.querySelector('[data-sooth-node]')!.shadowRoot as unknown as HTMLElement);
    expect((await ui.findByRole('alert')).textContent).toContain('does not belong');
    expect(ui.queryByText('Will the launch happen?')).toBeNull();
  });
  it('refuses a child market request outside the node before calling its runtime', async () => {
    const { runtime } = await mount({ initialMarket: address('4') });
    const child = children.market.mock.lastCall![0] as SoothMarketProps;
    await expect(child.runtime!.resolve({ ...reference, nodeId: hash('7'), market: address('4'), venue: 'amm' })).rejects.toThrow('outside');
    await expect(child.runtime!.resolve({ ...reference, market: address('4'), venue: 'book' })).rejects.toThrow('outside');
    expect(runtime.resolve).not.toHaveBeenCalled();
  });
  it('ignores a previous node response after the host switches identity', async () => {
    const first = fixture(), second = fixture();
    const nextReference = { ...reference, nodeId: hash('6') };
    second.resolved.reference = nextReference;
    second.resolved.context.nodeId = nextReference.nodeId;
    second.resolved.node.node = { ...second.resolved.node.node, ...nextReference };
    second.resolved.catalog.items = [];
    let finish!: (value: SoothResolvedNode) => void;
    first.runtime.resolveNode = vi.fn().mockReturnValue(new Promise<SoothResolvedNode>((done) => { finish = done; }));
    const view = render(<SoothNode node={reference} runtime={first.runtime} />);
    view.rerender(<SoothNode node={nextReference} runtime={second.runtime} />);
    const ui = within(view.container.querySelector('[data-sooth-node]')!.shadowRoot as unknown as HTMLElement);
    await ui.findByRole('heading', { name: 'No open markets right now' });
    await act(async () => { finish(first.resolved); });
    expect(ui.queryByText('Will the launch happen?')).toBeNull();
  });
  it('uses provider runtime and recovers a loading error with retry', async () => {
    const { runtime, resolved } = fixture();
    runtime.resolveNode = vi.fn().mockRejectedValueOnce(new Error('Catalog temporarily offline')).mockResolvedValue(resolved);
    const view = render(<SoothProvider runtime={runtime}><SoothNode node={reference} /></SoothProvider>);
    const ui = within(view.container.querySelector('[data-sooth-node]')!.shadowRoot as unknown as HTMLElement);
    await ui.findByText('Catalog temporarily offline');
    fireEvent.click(ui.getByRole('button', { name: 'Try again' }));
    await ui.findByRole('button', { name: /Will the launch happen/ });
  });
  it('shows confirmed creation while waiting for indexing, then opens the exact returned address', async () => {
    const { ui, resolved } = await mount({ features: { create: true }, initialView: 'create' });
    const created = market('9', 'New market');
    vi.mocked(resolved.refreshCatalog).mockResolvedValueOnce({ ...resolved.catalog, items: [...resolved.catalog.items, created] });
    fireEvent.click(ui.getByRole('button', { name: 'Confirm creation' }));
    expect(ui.getByRole('heading', { name: 'Your market is created' })).toBeTruthy();
    await ui.findByTestId('market-detail');
    expect(children.market.mock.lastCall?.[0].market.market).toBe(address('9'));
  });
});

describe('SoothNode dialog lifecycle', () => {
  it('does not fetch or mount trading controls until a closed embed opens', async () => {
    const { runtime } = fixture();
    const view = render(<SoothNode node={reference} runtime={runtime} presentation="drawer" open={false} initialMarket={address('4')} />);
    expect(runtime.resolveNode).not.toHaveBeenCalled();
    expect(children.market).not.toHaveBeenCalled();
    view.rerender(<SoothNode node={reference} runtime={runtime} presentation="drawer" open initialMarket={address('4')} />);
    const root = view.container.querySelector('[data-sooth-node]')!.shadowRoot!;
    const ui = within(root as unknown as HTMLElement);
    await ui.findByTestId('market-detail');
    view.rerender(<SoothNode node={reference} runtime={runtime} presentation="drawer" open={false} initialMarket={address('4')} />);
    expect(ui.queryByTestId('market-detail')).toBeNull();
    view.rerender(<SoothNode node={reference} runtime={runtime} presentation="drawer" open initialMarket={address('4')} />);
    await ui.findByTestId('market-detail');
    expect(runtime.resolveNode).toHaveBeenCalledTimes(2);
  });
  it.each(['drawer', 'modal'] as const)('opens %s modally, forwards Escape, closes and restores host focus, then reopens', async (presentation) => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger); trigger.focus();
    const onClose = vi.fn();
    const { root, rerender, runtime } = await mount({ presentation, open: true, onClose });
    const dialog = root.querySelector('dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.dataset.presentation).toBe(presentation);
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledOnce();
    rerender(<SoothNode node={reference} runtime={runtime} presentation={presentation} open={false} onClose={onClose} />);
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
    rerender(<SoothNode node={reference} runtime={runtime} presentation={presentation} open onClose={onClose} />);
    await waitFor(() => expect(dialog.open).toBe(true));
    trigger.remove();
  });
  it('closes its default-open dialog without requiring a controlled host', async () => {
    const { ui, root } = await mount({ presentation: 'modal' });
    fireEvent.click(ui.getByRole('button', { name: 'Close markets' }));
    expect(root.querySelector('dialog')!.open).toBe(false);
  });
});

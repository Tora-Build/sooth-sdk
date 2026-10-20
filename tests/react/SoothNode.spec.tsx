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
import { readSoothNodeMarkets, type SoothMarketSummary } from '../../src/react/data.js';

vi.mock('../../src/react/data.js', () => ({ readSoothNodeMarkets: vi.fn() }));
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
function market(digit: string, question: string, settled = false, options: { at?: Address; deadline?: number; block?: number } = {}): FactoryCatalogMarket {
  const at = options.at ?? address(digit);
  return {
    key: at, address: at, identity: reference, question, tokenA: address('8'),
    deadline: String(options.deadline ?? 2_000_000_000), tradingOpen: !settled,
    creation: { blockNumber: options.block ?? 1 },
    state: { phase: settled ? 'settled' : 'live', outcome: settled ? 1 : null },
    listing: { state: 'listed' },
  } as FactoryCatalogMarket;
}
const numbered = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Address;
const sqf = (question: string, category: string) => `§question\n${question}\n§category\n${category}`;
const summary = (yes: number | null, liquidity: bigint | null = 1_000_000n): SoothMarketSummary => ({
  yes, tradingOpen: true, deadline: 2_000_000_000n, liquidityNative: liquidity, tokenDecimals: 6, tokenSymbol: 'USDC',
});
const cardTitles = (root: ShadowRoot) => [...root.querySelectorAll('.s-node-card h3')].map((node) => node.textContent);
function fixture(items: FactoryCatalogMarket[] = [market('4', 'Will the launch happen?'), market('5', 'Did the vote pass?', true)]) {
  const catalog = { items, facts: { source: 'live', ageSeconds: 0 }, indexed: { blockNumber: 123 } } as SoothResolvedNode['catalog'];
  const resolved = {
    reference, context: { ...reference, release: { releaseId: reference.releaseId } },
    node: { node: reference, metadata: { label: 'Community forecasts', description: 'Markets chosen by this community' } },
    catalog, refreshCatalog: vi.fn().mockResolvedValue(catalog),
  } as unknown as SoothResolvedNode;
  const runtime: SoothRuntime = { resolveNode: vi.fn().mockResolvedValue(resolved), resolve: vi.fn() };
  return { resolved, runtime };
}
async function mount(props: Partial<SoothNodeProps> = {}, items?: FactoryCatalogMarket[]) {
  const { runtime, resolved } = fixture(items);
  const view = render(<SoothNode node={reference} runtime={runtime} {...props} />);
  const root = view.container.querySelector('[data-sooth-node]')!.shadowRoot!;
  const ui = within(root as unknown as HTMLElement);
  await ui.findByRole('heading', { name: 'Community forecasts' });
  return { ...view, ui, root, runtime, resolved };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readSoothNodeMarkets).mockResolvedValue(new Map());
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
    expect(ui.queryByRole('radio', { name: 'Order book' })).toBeNull();
    expect(onMarketChange).toHaveBeenLastCalledWith({ ...reference, market: address('4'), venue: 'amm' });
    fireEvent.click(ui.getByRole('button', { name: /All markets/ }));
    expect((ui.getByRole('searchbox') as HTMLInputElement).value).toBe('launch');
    expect(onMarketChange).toHaveBeenLastCalledWith(undefined);
  });
  it('filters settled outcomes and handles empty search without losing the catalog', async () => {
    const { ui } = await mount();
    fireEvent.click(ui.getByRole('radio', { name: 'Resolved' }));
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
    fireEvent.click(ui.getByRole('radio', { name: 'AMM' }));
    expect(children.market.mock.lastCall?.[0].market.venue).toBe('amm');
    fireEvent.click(ui.getByRole('radio', { name: 'Order book' }));
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

describe('SoothNode market list', () => {
  it('derives category chips with counts from SQF and filters within the status and search', async () => {
    const items = [
      market('4', sqf('Will the final be played?', 'Sports')),
      market('5', sqf('Will the derby sell out?', 'sports')),
      market('6', sqf('Will BTC close above 100k?', 'Crypto')),
      market('7', 'Will it rain tomorrow?'),
      market('9', sqf('Was the cup awarded?', 'Sports'), true),
    ];
    const { ui, root } = await mount({}, items);
    const rail = ui.getByRole('group', { name: 'Categories' });
    expect(within(rail).getAllByRole('button').map((chip) => chip.textContent)).toEqual(['All 4', 'Sports 2', 'Crypto 1', 'Other 1']);
    expect(cardTitles(root)).toHaveLength(4);
    fireEvent.click(within(rail).getByRole('button', { name: 'Sports 2' }));
    expect(cardTitles(root).sort()).toEqual(['Will the derby sell out?', 'Will the final be played?']);
    expect(within(ui.getByRole('article', { name: 'Will the derby sell out?' })).getByText('Sports')).toBeTruthy();
    fireEvent.change(ui.getByRole('searchbox'), { target: { value: 'derby' } });
    expect(within(rail).getByRole('button', { name: 'Sports 1' }).getAttribute('aria-pressed')).toBe('true');
    expect(cardTitles(root)).toEqual(['Will the derby sell out?']);
    fireEvent.change(ui.getByRole('searchbox'), { target: { value: '' } });
    fireEvent.click(ui.getByRole('radio', { name: 'All' }));
    expect(within(rail).getAllByRole('button').map((chip) => chip.textContent)).toEqual(['All 5', 'Sports 3', 'Crypto 1', 'Other 1']);
    expect(cardTitles(root)).toHaveLength(3);
    fireEvent.click(within(rail).getByRole('button', { name: 'Other 1' }));
    expect(cardTitles(root)).toEqual(['Will it rain tomorrow?']);
  });
  it('sorts by closing soon, newest and live liquidity', async () => {
    const now = Math.floor(Date.now() / 1000);
    const items = [
      market('4', 'Closes in a week', false, { deadline: now + 7 * 86_400, block: 30 }),
      market('5', 'Closes tomorrow', false, { deadline: now + 86_400, block: 10 }),
      market('6', 'Closes next month', false, { deadline: now + 30 * 86_400, block: 20 }),
    ];
    const liquidity = new Map([[address('4'), 5_000_000n], [address('5'), 1_000_000n], [address('6'), 9_000_000n]]);
    vi.mocked(readSoothNodeMarkets).mockImplementation(async (_node, addresses) =>
      new Map(addresses.map((at) => [at, summary(0.5, liquidity.get(at)!)])));
    const { ui, root } = await mount({}, items);
    expect(cardTitles(root)).toEqual(['Closes tomorrow', 'Closes in a week', 'Closes next month']);
    await ui.findByText('9.00 USDC');
    const sort = ui.getByRole('combobox', { name: 'Sort by' });
    fireEvent.change(sort, { target: { value: 'newest' } });
    expect(cardTitles(root)).toEqual(['Closes in a week', 'Closes next month', 'Closes tomorrow']);
    fireEvent.change(sort, { target: { value: 'liquidity' } });
    expect(cardTitles(root)).toEqual(['Closes next month', 'Closes in a week', 'Closes tomorrow']);
  });
  it('opens the market from YES/NO with that outcome preselected and degrades without a summary', async () => {
    vi.mocked(readSoothNodeMarkets).mockImplementation(async (_node, addresses) =>
      new Map(addresses.filter((at) => at === address('4')).map((at) => [at, summary(0.62)])));
    const onMarketChange = vi.fn();
    const { ui } = await mount({ onMarketChange }, [market('4', 'Will the launch happen?'), market('6', 'Will the bridge open?')]);
    const card = ui.getByRole('article', { name: 'Will the launch happen?' });
    await within(card).findByText('62%');
    expect(within(card).getByRole('button', { name: 'YES 62¢' })).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'NO 38¢' }));
    await ui.findByTestId('market-detail');
    expect(children.market.mock.lastCall?.[0].market).toEqual({ ...reference, market: address('4'), venue: 'amm' });
    expect(children.market.mock.lastCall?.[0].initialIntent).toEqual({ side: 'buy', outcome: 0, shares: '', price: '38' });
    expect(onMarketChange).toHaveBeenLastCalledWith({ ...reference, market: address('4'), venue: 'amm' });

    fireEvent.click(ui.getByRole('button', { name: /All markets/ }));
    const other = ui.getByRole('article', { name: 'Will the bridge open?' });
    await within(other).findByText('Probability unavailable');
    fireEvent.click(within(other).getByRole('button', { name: 'YES —' }));
    expect(children.market.mock.lastCall?.[0].market.market).toBe(address('6'));
    expect(children.market.mock.lastCall?.[0].initialIntent).toEqual({ side: 'buy', outcome: 1, shares: '', price: '50' });

    fireEvent.click(ui.getByRole('button', { name: /All markets/ }));
    fireEvent.click(ui.getByRole('button', { name: /Will the launch happen/ }));
    expect(children.market.mock.lastCall?.[0].initialIntent).toBeUndefined();
  });
  it('renders 20 cards at a time and reads summaries only for rendered cards', async () => {
    const items = Array.from({ length: 45 }, (_, index) =>
      market('0', `Market number ${index + 1}?`, false, { at: numbered(0x100 + index), deadline: 2_000_000_000 + index }));
    const { ui, root } = await mount({}, items);
    const requested = () => [...vi.mocked(readSoothNodeMarkets).mock.lastCall![1]].sort();
    await waitFor(() => expect(readSoothNodeMarkets).toHaveBeenCalled());
    expect(cardTitles(root)).toHaveLength(20);
    expect(requested()).toEqual(items.slice(0, 20).map((item) => item.address).sort());
    expect(ui.getByText('Showing 20 of 45')).toBeTruthy();
    fireEvent.click(ui.getByRole('button', { name: 'Show more' }));
    expect(cardTitles(root)).toHaveLength(40);
    await waitFor(() => expect(requested()).toEqual(items.slice(0, 40).map((item) => item.address).sort()));
    fireEvent.click(ui.getByRole('button', { name: 'Show more' }));
    expect(cardTitles(root)).toHaveLength(45);
    expect(ui.queryByRole('button', { name: 'Show more' })).toBeNull();
    await waitFor(() => expect(requested()).toHaveLength(45));
    expect(vi.mocked(readSoothNodeMarkets).mock.calls.map(([, addresses]) => addresses.length)).toEqual([20, 40, 45]);
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

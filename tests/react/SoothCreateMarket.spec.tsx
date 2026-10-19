// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address, Hex, TransactionReceipt } from 'viem';
import { SoothCreateMarket, type SoothCreateMarketProps } from '../../src/react/SoothCreateMarket.js';
import {
  planSoothCreation, readSoothCreationOptions, sendSoothCreation,
  type SoothCreationIntent, type SoothCreationOptions, type SoothCreationPreview, type SoothSubmittedCreation,
} from '../../src/react/creation.js';
import {
  loadSoothPendingCreations, reconcileSoothCreation, removeSoothPendingCreation,
  type SoothPendingCreation,
} from '../../src/react/creationRecovery.js';
import { SoothProvider } from '../../src/react/hooks.js';
import { formatSoothNodeReference } from '../../src/react/node.js';
import type { SoothResolvedNode } from '../../src/react/runtime.js';
import type { SoothWalletAdapter } from '../../src/react/wallet.js';

vi.mock('../../src/react/creation.js', () => ({
  planSoothCreation: vi.fn(),
  readSoothCreationOptions: vi.fn(),
  sendSoothCreation: vi.fn(),
}));
vi.mock('../../src/react/creationRecovery.js', () => ({
  loadSoothPendingCreations: vi.fn(),
  reconcileSoothCreation: vi.fn(),
  removeSoothPendingCreation: vi.fn(),
}));

const address = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Address;
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex;
const account = address(4);
// The component consumes only identity; all chain operations are mocked at helper boundaries.
const node = {
  reference: { chainId: 46630, factory: address(1), releaseId: hash(1), nodeId: hash(2) },
  context: { contracts: { marketFactory: address(5) } },
} as SoothResolvedNode;
const reference = formatSoothNodeReference(node.reference);
const wallet: SoothWalletAdapter = {
  connect: vi.fn(), getSession: vi.fn(), switchChain: vi.fn(), sendTransaction: vi.fn(),
};
const options: SoothCreationOptions = {
  context: node.context,
  paused: false,
  walletMayCreate: true,
  tokens: [{ address: address(6), decimals: 6, symbol: 'TEST' }],
  profiles: [{
    binding: {
      kind: 'manual', chainId: node.reference.chainId, address: address(7),
      marketFactory: address(5), profileHash: hash(7), abiBundleHash: hash(8),
    },
    resolvers: [address(8)], vetoPeriod: 3600, earlyResolution: false,
  }],
  unavailable: [],
};
const intent: SoothCreationIntent = {
  question: 'Will the proposal pass?',
  rules: 'YES if the proposal passes before the deadline; NO if rejected; INVALID if withdrawn.',
  deadline: BigInt(Date.parse('2035-01-01T12:00:00Z') / 1000),
  token: address(6), adjudicator: address(7), resolver: address(8),
  liquidity: '100', budget: '100', probability: '50', resolution: { kind: 'manual' },
};
const request: Parameters<SoothWalletAdapter['sendTransaction']>[0] = {
  account, chainId: node.reference.chainId, to: address(5), data: '0x1234', value: 0n,
};
const onCreated = vi.fn();
const onCancel = vi.fn();
const onEvent = vi.fn();
let records: SoothPendingCreation[];

function preview(approveNative: bigint | null, draft = intent): SoothCreationPreview {
  return {
    node: reference, account, intent: { ...draft }, context: node.context,
    profile: options.profiles[0]!, token: options.tokens[0]!,
    balance: 500_000_000n, allowance: approveNative === null ? 100_000_000n : 0n, approveNative,
    params: {
      question: draft.question, startTime: 0n, deadline: draft.deadline,
      adjudicator: draft.adjudicator, tokenA: draft.token, bBase: 100n * 10n ** 18n,
      initialProbabilityWad: 5n * 10n ** 17n, adjudicatorConfig: '0x1234',
      maxInputNative: 100_000_000n, quoteDeadline: draft.deadline - 120n,
      expectedAmmVersion: 1, expectedBookVersion: 1,
      expectedAmmHash: hash(10), expectedBookHash: hash(11), resolutionTermsHash: hash(12),
      expectedProfileHash: options.profiles[0]!.binding.profileHash, expectedInvalidationBuffer: 3600n,
    },
    ammConfig: {
      feeBps: 100, capitalBps: 2500, lpBps: 2500, resolutionBps: 2500,
      operatorBps: 2500, operatorRecipient: address(9),
    },
    bookConfig: { feeBps: 100, resolutionBps: 5000, protocolBps: 5000, protocolRecipient: address(9) },
  };
}

function submitted(kind: SoothPendingCreation['kind']): SoothSubmittedCreation {
  return {
    version: 1, node: reference, account, chainId: node.reference.chainId,
    hash: hash(kind === 'approveCreation' ? 20 : 21), to: address(5), data: '0x1234', kind,
    submittedAt: 1_800_000_000_000, storageAvailable: true,
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

async function click(button: HTMLElement) {
  await act(async () => { fireEvent.click(button); });
}

async function renderCreation(overrides: Partial<SoothCreateMarketProps> = {}, providerWallet?: SoothWalletAdapter) {
  const component = <SoothCreateMarket node={node} wallet={wallet} onCreated={onCreated}
    onCancel={onCancel} onEvent={onEvent} {...overrides} />;
  const rendered = render(providerWallet ? <SoothProvider wallet={providerWallet}>{component}</SoothProvider> : component);
  await act(async () => {});
  const root = rendered.container.querySelector('[data-sooth-create]')!.shadowRoot!;
  const view = Object.assign(within(root as unknown as HTMLElement), { root, unmount: rendered.unmount });
  fireEvent.change(view.getByRole('textbox', { name: 'Market question' }), { target: { value: intent.question } });
  fireEvent.change(view.getByRole('textbox', { name: 'Resolution rules' }), { target: { value: intent.rules } });
  fireEvent.change(view.getByLabelText('Trading deadline (UTC)'), { target: { value: '2035-01-01T12:00' } });
  return view;
}

beforeEach(() => {
  vi.resetAllMocks();
  records = [];
  vi.mocked(wallet.getSession).mockResolvedValue({ account, chainId: node.reference.chainId });
  vi.mocked(wallet.sendTransaction).mockResolvedValue(hash(21));
  vi.mocked(readSoothCreationOptions).mockResolvedValue(options);
  vi.mocked(loadSoothPendingCreations).mockImplementation(() => [...records]);
  vi.mocked(reconcileSoothCreation).mockResolvedValue({ status: 'pending' });
  vi.mocked(removeSoothPendingCreation).mockImplementation((_node, txHash) => {
    records = records.filter(record => record.hash !== txHash);
  });
  vi.mocked(sendSoothCreation).mockResolvedValue(submitted('createMarket'));
});
afterEach(cleanup);

describe('SoothCreateMarket review and wallet boundaries', () => {
  it.each([
    { label: 'Market question', key: 'question', value: 'Will the amended proposal pass?' },
    { label: 'Resolution rules', key: 'rules', value: 'YES if the amended proposal passes; NO if rejected; INVALID if withdrawn.' },
    { label: 'Maximum initial collateral budget', key: 'budget', value: '200' },
  ] as const)('discards a delayed review after $label changes and reviews the edited draft explicitly', async ({ label, key, value }) => {
    const pendingPlan = deferred<SoothCreationPreview>();
    const edited = { ...intent, [key]: value };
    vi.mocked(planSoothCreation).mockReturnValueOnce(pendingPlan.promise).mockResolvedValueOnce(preview(null, edited));
    const view = await renderCreation();
    await click(view.getByRole('button', { name: 'Review creation' }));
    expect(planSoothCreation).toHaveBeenCalledOnce();
    expect(planSoothCreation).toHaveBeenCalledWith(node, account, intent);
    expect(view.queryByRole('region', { name: 'Creation review' })).toBeNull();

    // Exercise the revision guard with a queued change even while the fieldset is disabled.
    fireEvent.change(view.getByRole('textbox', { name: label }), { target: { value } });
    await act(async () => { pendingPlan.resolve(preview(null)); });

    expect((view.getByRole('textbox', { name: label }) as HTMLInputElement).value).toBe(value);
    expect(view.queryByRole('region', { name: 'Creation review' })).toBeNull();
    expect(view.queryByRole('button', { name: 'Confirm market creation' })).toBeNull();
    expect((view.getByRole('button', { name: 'Review creation' }) as HTMLButtonElement).disabled).toBe(false);
    expect(sendSoothCreation).not.toHaveBeenCalled();
    expect(wallet.sendTransaction).not.toHaveBeenCalled();

    await click(view.getByRole('button', { name: 'Review creation' }));
    expect(planSoothCreation).toHaveBeenCalledTimes(2);
    expect(planSoothCreation).toHaveBeenLastCalledWith(node, account, edited);
    expect(view.getByRole('region', { name: 'Creation review' }).textContent).toContain(edited.question);
    expect(view.getByRole('button', { name: 'Confirm market creation' })).toBeTruthy();
    expect(sendSoothCreation).not.toHaveBeenCalled();
  });

  it.each([
    { kind: 'approveCreation' as const, approveNative: 100_000_000n, button: 'Approve collateral budget' },
    { kind: 'createMarket' as const, approveNative: null, button: 'Confirm market creation' },
  ])('rejects the final $kind wallet dispatch when unmounted during an awaited helper step', async ({ kind, approveNative, button }) => {
    const gate = deferred<void>();
    const attemptedDispatch = vi.fn();
    let sending!: Promise<SoothSubmittedCreation>;
    const reviewed = preview(approveNative);
    vi.mocked(planSoothCreation).mockResolvedValue(reviewed);
    vi.mocked(sendSoothCreation).mockImplementationOnce((_node, adapter, _preview, action, onPending) => {
      sending = (async () => {
        await gate.promise;
        attemptedDispatch();
        const txHash = await adapter.sendTransaction(request);
        const record = { ...submitted(action), hash: txHash };
        onPending(record);
        return record;
      })();
      return sending;
    });
    const view = await renderCreation();
    await click(view.getByRole('button', { name: 'Review creation' }));
    await click(view.getByRole('button', { name: button }));
    expect(sendSoothCreation).toHaveBeenCalledOnce();
    expect(sendSoothCreation).toHaveBeenCalledWith(node,
      expect.objectContaining({ sendTransaction: expect.any(Function) }), reviewed, kind, expect.any(Function));
    expect(attemptedDispatch).not.toHaveBeenCalled();
    expect(wallet.sendTransaction).not.toHaveBeenCalled();

    view.unmount();
    await act(async () => {
      gate.resolve();
      await expect(sending).rejects.toThrow('The creation view or wallet changed. Reopen and review before signing.');
    });

    expect(attemptedDispatch).toHaveBeenCalledOnce();
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
    expect(onEvent).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('forwards the exact reviewed wallet request while the view remains mounted', async () => {
    vi.mocked(planSoothCreation).mockResolvedValue(preview(null));
    vi.mocked(sendSoothCreation).mockImplementationOnce(async (_node, adapter, _preview, kind, onPending) => {
      const txHash = await adapter.sendTransaction(request);
      const record = { ...submitted(kind), hash: txHash };
      onPending(record);
      return record;
    });
    const view = await renderCreation();
    await click(view.getByRole('button', { name: 'Review creation' }));
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
    await click(view.getByRole('button', { name: 'Confirm market creation' }));

    expect(wallet.sendTransaction).toHaveBeenCalledOnce();
    expect(wallet.sendTransaction).toHaveBeenCalledWith(request);
    expect(onEvent).toHaveBeenCalledOnce();
    expect(onEvent).toHaveBeenCalledWith({
      type: 'transaction-submitted', hash: hash(21), chainId: node.reference.chainId,
    });
    expect(view.queryByRole('region', { name: 'Creation review' })).toBeNull();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('invalidates approval review in the submission callback and requires another review and click after confirmation', async () => {
    const approval = submitted('approveCreation');
    const pendingSend = deferred<SoothSubmittedCreation>();
    const approvalPreview = preview(100_000_000n);
    const creationPreview = preview(null);
    vi.mocked(planSoothCreation).mockResolvedValueOnce(approvalPreview).mockResolvedValueOnce(creationPreview);
    vi.mocked(sendSoothCreation).mockImplementationOnce((_node, _wallet, _preview, _kind, onPending) => {
      records = [approval];
      onPending(approval);
      return pendingSend.promise;
    });
    const view = await renderCreation();
    await click(view.getByRole('button', { name: 'Review creation' }));
    await click(view.getByRole('button', { name: 'Approve collateral budget' }));

    // The callback must consume the review before the send helper itself finishes.
    expect(view.queryByRole('region', { name: 'Creation review' })).toBeNull();
    expect(view.queryByRole('button', { name: 'Approve collateral budget' })).toBeNull();
    expect(view.queryByRole('button', { name: 'Confirm market creation' })).toBeNull();
    expect(view.getByLabelText('Pending creation transactions').textContent).toContain(approval.hash);
    expect(onEvent).toHaveBeenCalledOnce();
    expect(onEvent).toHaveBeenCalledWith({
      type: 'transaction-submitted', hash: approval.hash, chainId: node.reference.chainId,
    });
    await act(async () => { pendingSend.resolve(approval); });
    expect((view.getByRole('button', { name: 'Review creation' }) as HTMLButtonElement).disabled).toBe(true);

    vi.mocked(reconcileSoothCreation).mockResolvedValueOnce({
      status: 'confirmed', receipt: { transactionHash: approval.hash } as TransactionReceipt,
    });
    await act(async () => { window.dispatchEvent(new Event('storage')); });

    expect(reconcileSoothCreation).toHaveBeenCalledWith(node, approval);
    expect(removeSoothPendingCreation).toHaveBeenCalledOnce();
    expect(removeSoothPendingCreation).toHaveBeenCalledWith(reference, approval.hash);
    expect(onEvent).toHaveBeenLastCalledWith({
      type: 'transaction-confirmed', hash: approval.hash, chainId: node.reference.chainId,
    });
    expect(within(view.getByRole('status')).getByText('Approval confirmed. Review the updated creation before signing the next action.')).toBeTruthy();
    expect(view.queryByLabelText('Pending creation transactions')).toBeNull();
    expect(view.queryByRole('region', { name: 'Creation review' })).toBeNull();
    expect(view.queryByRole('button', { name: 'Confirm market creation' })).toBeNull();
    expect((view.getByRole('button', { name: 'Review creation' }) as HTMLButtonElement).disabled).toBe(false);
    expect(planSoothCreation).toHaveBeenCalledTimes(1);
    expect(sendSoothCreation).toHaveBeenCalledTimes(1);
    expect(onCreated).not.toHaveBeenCalled();

    await click(view.getByRole('button', { name: 'Review creation' }));
    expect(planSoothCreation).toHaveBeenCalledTimes(2);
    expect(sendSoothCreation).toHaveBeenCalledTimes(1);
    await click(view.getByRole('button', { name: 'Confirm market creation' }));
    expect(sendSoothCreation).toHaveBeenCalledTimes(2);
    expect(sendSoothCreation).toHaveBeenNthCalledWith(1, node, expect.any(Object), approvalPreview, 'approveCreation', expect.any(Function));
    expect(sendSoothCreation).toHaveBeenLastCalledWith(node, expect.any(Object), creationPreview, 'createMarket', expect.any(Function));
  });

  it('asks the host for a wallet only when the no-wallet connection action is clicked', async () => {
    const onWalletUnavailable = vi.fn();
    const view = await renderCreation({ wallet: undefined, onWalletUnavailable });
    expect(readSoothCreationOptions).toHaveBeenCalledOnce();
    expect(readSoothCreationOptions).toHaveBeenCalledWith(node, undefined);
    expect(onWalletUnavailable).not.toHaveBeenCalled();
    expect((view.getByRole('button', { name: 'Review creation' }) as HTMLButtonElement).disabled).toBe(true);
    await click(view.getByRole('button', { name: 'Connect wallet to create' }));

    expect(onWalletUnavailable).toHaveBeenCalledOnce();
    expect(wallet.connect).not.toHaveBeenCalled();
    expect(planSoothCreation).not.toHaveBeenCalled();
    expect(sendSoothCreation).not.toHaveBeenCalled();
    expect(view.queryByRole('alert')).toBeNull();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('uses the provider wallet without a direct wallet prop and preserves adapter method receivers', async () => {
    const onWalletUnavailable = vi.fn();
    const session = { account, chainId: node.reference.chainId };
    vi.mocked(wallet.getSession).mockImplementation(function (this: SoothWalletAdapter) {
      expect(this).toBe(wallet);
      return Promise.resolve(session);
    });
    vi.mocked(wallet.sendTransaction).mockImplementation(function (this: SoothWalletAdapter) {
      expect(this).toBe(wallet);
      return Promise.resolve(hash(21));
    });
    vi.mocked(planSoothCreation).mockResolvedValue(preview(null));
    vi.mocked(sendSoothCreation).mockImplementationOnce(async (_node, adapter, _preview, kind, onPending) => {
      expect(await adapter.getSession()).toEqual(session);
      const txHash = await adapter.sendTransaction(request);
      const record = { ...submitted(kind), hash: txHash };
      onPending(record);
      return record;
    });
    const view = await renderCreation({ wallet: undefined, onWalletUnavailable }, wallet);
    expect(readSoothCreationOptions).toHaveBeenCalledOnce();
    expect(readSoothCreationOptions).toHaveBeenCalledWith(node, account);
    expect(view.queryByRole('button', { name: 'Connect wallet to create' })).toBeNull();
    expect((view.getByRole('button', { name: 'Review creation' }) as HTMLButtonElement).disabled).toBe(false);

    await click(view.getByRole('button', { name: 'Review creation' }));
    expect(planSoothCreation).toHaveBeenCalledOnce();
    expect(planSoothCreation).toHaveBeenCalledWith(node, account, intent);
    await click(view.getByRole('button', { name: 'Confirm market creation' }));

    expect(wallet.sendTransaction).toHaveBeenCalledOnce();
    expect(wallet.sendTransaction).toHaveBeenCalledWith(request);
    expect(onWalletUnavailable).not.toHaveBeenCalled();
    expect(view.queryByRole('alert')).toBeNull();
  });

  it('explains how to connect when neither a wallet nor a host callback is available', async () => {
    const view = await renderCreation({ wallet: undefined });
    await click(view.getByRole('button', { name: 'Connect wallet to create' }));
    expect(within(view.getByRole('alert')).getByText('Connect a wallet through the host application to create a market.')).toBeTruthy();
    expect(planSoothCreation).not.toHaveBeenCalled();
    expect(sendSoothCreation).not.toHaveBeenCalled();
  });

  it('previews the exact SQF terms and summarizes costs before and after review', async () => {
    vi.mocked(planSoothCreation).mockResolvedValue(preview(null));
    const view = await renderCreation();
    const summary = view.getByRole('complementary', { name: 'Costs and risks' });
    expect(within(summary).getByText(intent.question)).toBeTruthy();
    expect(summary.querySelector('pre')!.textContent).toBe(`§question\n${intent.question}\n§rule\n${intent.rules}`);
    expect(within(summary).getByText('Shown at review')).toBeTruthy();
    expect(within(summary).getByText('50% YES · 50% NO')).toBeTruthy();
    expect(within(summary).getByText('100 TEST')).toBeTruthy();
    expect(within(summary).queryByText(/Lines starting with §/)).toBeNull();

    await click(view.getByRole('button', { name: 'Review creation' }));
    expect(within(summary).getByText('AMM 1% · Order book 1%')).toBeTruthy();
    fireEvent.change(view.getByRole('textbox', { name: 'Resolution rules' }), { target: { value: `${intent.rules}\n§meta` } });
    expect(within(summary).getByText(/Lines starting with §/)).toBeTruthy();
    expect(view.queryByRole('region', { name: 'Creation review' })).toBeNull();
    expect(sendSoothCreation).not.toHaveBeenCalled();
  });
});

import { supportedRelease } from './fixtures/release.js';
import { describe, expect, it, vi } from 'vitest';
import { decodeFunctionData, erc20Abi, type Address, type Hex } from 'viem';
import { assertMarketBinding, buildFactoryTransaction, discoverFactoryLpPositions, readFactoryBookInventory, readFactoryBookOrders, readFactoryNodeBookOrders, readFactoryConsumerEntitlements, readFactoryEntitlements, readFactoryPositions, verifyFactoryNode, type BindingRead, type FactoryNodeContext, type FactoryReadClient } from '../../src/factory/factoryClient.js';
import { anchorReader, deriveNodeChildren, noteReceipt, freshReceiptBlock, forgetReceipt, planAmmTrade, planBookOrder, wadToNativeCeil, wadToNativeFloor } from '../../src/factory/factoryTrade.js';

const addr = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Address;
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex;
const release = { ...supportedRelease, startBlock: 10 };
const identity = { chainId: release.chainId, factory: release.factory, nodeId: hash(1) };
const deployer = addr(2), market = addr(3), account = addr(4), tokenA = addr(5), bookToken = addr(6), adjudicator = addr(7);
const contracts = { ...deriveNodeChildren(deployer), deployer };
const context: FactoryNodeContext = { ...identity, release, contracts, startBlock: 10n, blockNumber: 100n };
const WAD = 10n ** 18n;
const boundAnswer = (call: BindingRead): unknown => {
  switch (call.functionName) {
    case 'nodeDeployer': return deployer;
    case 'releaseId': return release.releaseId;
    case 'marketFactory': return contracts.marketFactory;
    case 'ammEngine': case 'engine': return contracts.amm;
    case 'orderEngine': return contracts.book;
    case 'feeVault': return call.address === contracts.amm ? contracts.ammVault : contracts.bookVault;
    case 'positionManager': return contracts.positionManager;
    case 'vault': return contracts.ammVault;
    case 'roles': return contracts.roles;
    case 'adjudicator': return adjudicator;
    case 'tokenAOf': return tokenA;
    case 'baseToken': return bookToken;
    case 'approve': return true;
    case 'transfer': return undefined;
    default: throw new Error(`Unexpected read ${call.functionName}`);
  }
};
function client(answer = boundAnswer): FactoryReadClient {
  return { getChainId: async () => identity.chainId, getBlockNumber: async () => 100n, readContract: vi.fn(async call => answer(call)) };
}
function endpoints(answer = boundAnswer) { return [{ url: 'https://one.example', reader: client(answer) }, { url: 'https://two.example', reader: client(answer) }]; }

describe('selected venue consumer claims', () => {
  it.each(['amm', 'book'] as const)('reads only %s trader entitlements without LP discovery or simulation', async venue => {
    const reads = {
      ...client(call => {
        switch (call.functionName) {
          case 'floorEntitlementOf': return WAD;
          case 'refundableResolutionOf': return 2n;
          case 'deferredOf': return 3n;
          default: return boundAnswer(call);
        }
      }),
      getLogs: vi.fn(async () => []),
      simulateContract: vi.fn(async () => { throw new Error('Trader entitlements must not simulate LP claims'); }),
      simulateSequence: vi.fn(async () => { throw new Error('Trader entitlements must not simulate LP checkpoints'); }),
    };
    const result = await readFactoryConsumerEntitlements({ context, client: reads, market, account, venue });
    expect(result).toEqual(venue === 'amm'
      ? { blockNumber: 100n, floorWad: WAD, bookTimeoutRefundNative: null, bookDeferredNative: null }
      : { blockNumber: 100n, floorWad: null, bookTimeoutRefundNative: 2n, bookDeferredNative: 3n });
    const calls = vi.mocked(reads.readContract).mock.calls.map(([call]) => ({
      address: call.address, functionName: call.functionName, args: call.args, blockNumber: call.blockNumber,
    }));
    const binding = { address: market, functionName: 'marketFactory', args: [], blockNumber: 100n };
    expect(calls).toEqual(venue === 'amm'
      ? [binding, { address: contracts.amm, functionName: 'floorEntitlementOf', args: [market, account], blockNumber: 100n }]
      : [binding,
        { address: contracts.bookVault, functionName: 'refundableResolutionOf', args: [market, account], blockNumber: 100n },
        { address: contracts.book, functionName: 'deferredOf', args: [account], blockNumber: 100n }]);
    expect(reads.getLogs).not.toHaveBeenCalled();
    expect(reads.simulateContract).not.toHaveBeenCalled();
    expect(reads.simulateSequence).not.toHaveBeenCalled();
  });
});

describe('Factory binding and transaction targets', () => {
  it('binds all children and exact release at a pinned block through two endpoints', async () => {
    const eps = endpoints();
    const result = await verifyFactoryNode({ identity, release, endpoints: eps, catalog: contracts });
    expect(result.contracts).toEqual(contracts);
    for (const endpoint of eps) for (const [call] of vi.mocked(endpoint.reader.readContract).mock.calls) expect(call.blockNumber).toBe(100n);
  });
  it('refuses a release from another factory on the same chain', async () => {
    await expect(verifyFactoryNode({ identity, release: { ...release, factory: addr(90) }, endpoints: endpoints() })).rejects.toThrow();
  });
  it('refuses the wrong release even when children agree', async () => {
    await expect(verifyFactoryNode({ identity, release, endpoints: endpoints(call => call.functionName === 'releaseId' ? hash(90) : boundAnswer(call)) })).rejects.toThrow();
  });
  it('refuses catalog substitution', async () => {
    await expect(verifyFactoryNode({ identity, release, endpoints: endpoints(), catalog: { book: addr(90) } })).rejects.toThrow();
  });
  it('refuses a substituted truth implementation', async () => {
    const eps = endpoints(call => call.functionName === 'truthMarketImpl' ? addr(91) : boundAnswer(call));
    await expect(verifyFactoryNode({ identity, release, endpoints: eps, catalog: { truthImplementation: addr(90) } })).rejects.toThrow();
  });
  it.each([
    [contracts.amm, 'marketFactory'],
    [contracts.book, 'marketFactory'],
    [contracts.marketFactory, 'ammEngine'],
    [contracts.marketFactory, 'orderEngine'],
    [contracts.amm, 'feeVault'],
    [contracts.book, 'feeVault'],
    [contracts.amm, 'positionManager'],
    [contracts.positionManager, 'engine'],
    [contracts.positionManager, 'vault'],
    [contracts.ammVault, 'roles'],
    [contracts.bookVault, 'roles'],
  ] as const)('refuses a mismatched node binding at %s.%s', async (address, functionName) => {
    const eps = endpoints(call => call.address === address && call.functionName === functionName ? addr(90) : boundAnswer(call));
    await expect(buildFactoryTransaction({ context, endpoints: eps, market, account, action: { kind: 'approve', venue: 'amm', amountNative: 123n } })).rejects.toThrow();
    for (const endpoint of eps) expect(vi.mocked(endpoint.reader.readContract).mock.calls.some(([call]) => call.address === market || call.functionName === 'tokenAOf')).toBe(false);
  });
  it('refuses another market factory', async () => {
    await expect(assertMarketBinding({ identity, release, market, endpoints: endpoints(call => call.address === market && call.functionName === 'marketFactory' ? addr(90) : boundAnswer(call)) })).rejects.toThrow();
  });
  it('refuses disagreement on every read, not only the deployer', async () => {
    const eps = endpoints(); eps[1]!.reader = client(call => call.functionName === 'releaseId' ? hash(90) : boundAnswer(call));
    await expect(verifyFactoryNode({ identity, release, endpoints: eps })).rejects.toThrow();
  });
  it('refuses one dissenting responder despite two matching answers', async () => {
    const eps = [...endpoints(), { url: 'https://three.example', reader: client(call => call.functionName === 'feeVault' && call.address === contracts.amm ? addr(90) : boundAnswer(call)) }];
    await expect(verifyFactoryNode({ identity, release, endpoints: eps })).rejects.toThrow();
  });
  it('refuses concurrent reads with no endpoint that answered the whole binding', async () => {
    const failures = ['releaseId', 'ammEngine', 'orderEngine'];
    const eps = failures.map((failure, i) => ({ url: `https://endpoint${i}.example`, reader: client(call => {
      if (call.functionName === failure) throw new Error('RPC unavailable');
      return boundAnswer(call);
    }) }));
    await expect(buildFactoryTransaction({ context, endpoints: eps, market, account, action: { kind: 'approve', venue: 'amm', amountNative: 123n } })).rejects.toThrow();
    for (const endpoint of eps) expect(vi.mocked(endpoint.reader.readContract).mock.calls.some(([call]) => call.address === market)).toBe(false);
  });
  it('retains an endpoint that answers every concurrent binding read', async () => {
    const failures = ['', 'releaseId', 'ammEngine'];
    const eps = failures.map((failure, i) => ({ url: `https://endpoint${i}.example`, reader: client(call => {
      if (call.functionName === failure) throw new Error('RPC unavailable');
      return boundAnswer(call);
    }) }));
    expect((await verifyFactoryNode({ identity, release, endpoints: eps })).contracts).toEqual(contracts);
  });
  it('refuses a concurrent binding read without two answers', async () => {
    const eps = endpoints(call => {
      if (call.address === contracts.bookVault && call.functionName === 'roles') throw new Error('RPC unavailable');
      return boundAnswer(call);
    });
    await expect(buildFactoryTransaction({ context, endpoints: eps, market, account, action: { kind: 'approve', venue: 'amm', amountNative: 123n } })).rejects.toThrow();
    for (const endpoint of eps) expect(vi.mocked(endpoint.reader.readContract).mock.calls.some(([call]) => call.functionName === 'tokenAOf')).toBe(false);
  });
  it('waits for a pending binding answer and refuses its disagreement before market reads', async () => {
    let answerBinding!: (value: unknown) => void;
    let bindingStarted!: () => void;
    const pendingBinding = new Promise<unknown>(resolve => { answerBinding = resolve; });
    const started = new Promise<void>(resolve => { bindingStarted = resolve; });
    const eps = endpoints();
    eps[1]!.reader = client(call => {
      if (call.address === contracts.bookVault && call.functionName === 'roles') {
        bindingStarted();
        return pendingBinding;
      }
      return boundAnswer(call);
    });
    const request = buildFactoryTransaction({ context, endpoints: eps, market, account, action: { kind: 'approve', venue: 'amm', amountNative: 123n } });
    const refusal = expect(request).rejects.toThrow();
    await started;
    for (const endpoint of eps) expect(vi.mocked(endpoint.reader.readContract).mock.calls.some(([call]) => call.address === market)).toBe(false);
    answerBinding(addr(90));
    await refusal;
    for (const endpoint of eps) expect(vi.mocked(endpoint.reader.readContract).mock.calls.some(([call]) => call.functionName === 'tokenAOf')).toBe(false);
  });
  it('does not permit one endpoint, duplicate endpoints or a weaker quorum', () => {
    expect(() => anchorReader(46630, endpoints().slice(0, 1))).toThrow();
    expect(() => anchorReader(46630, [endpoints()[0]!, endpoints()[0]!])).toThrow();
    expect(() => anchorReader(46630, [endpoints()[0]!, { ...endpoints()[1]!, url: 'https://one.example#secondary' }])).toThrow();
    expect(() => anchorReader(46630, endpoints(), { minAnswers: 1 })).toThrow();
  });
  it('refuses an endpoint on another chain', async () => {
    const eps = endpoints(); eps[1]!.reader.getChainId = async () => 1;
    await expect(verifyFactoryNode({ identity, release, endpoints: eps })).rejects.toThrow();
  });
  it('uses market tokenA for AMM approval and node bookToken for book approval', async () => {
    const amm = await buildFactoryTransaction({ context, endpoints: endpoints(), market, account, action: { kind: 'approve', venue: 'amm', amountNative: 123n } });
    const book = await buildFactoryTransaction({ context, endpoints: endpoints(), market, account, action: { kind: 'approve', venue: 'book', amountNative: 123n } });
    expect(amm.to).toBe(tokenA); expect(book.to).toBe(bookToken);
    const decoded = decodeFunctionData({ abi: erc20Abi, data: book.data });
    expect(String(decoded.args![0]).toLowerCase()).toBe(contracts.book);
    expect(decoded.args![1]).toBe(123n);
  });
  it('pins the exact market, approval target and returned context to one fresh head', async () => {
    const eps = [...endpoints(), { url: 'https://three.example', reader: client() }];
    for (const [i, endpoint] of eps.entries()) {
      let head = 100n + BigInt(i);
      endpoint.reader.getBlockNumber = async () => head++;
    }
    const result = await buildFactoryTransaction({ context: { ...context, blockNumber: 50n }, endpoints: eps, market, account, action: { kind: 'approve', venue: 'amm', amountNative: 123n } });
    expect(result.verifiedContext).toEqual(context);
    expect(result.verifiedBlockNumber).toBe(result.verifiedContext.blockNumber);
    expect(result.to).toBe(tokenA);
    expect(result.args).toEqual([contracts.amm, 123n]);
    for (const endpoint of eps) {
      const calls = vi.mocked(endpoint.reader.readContract).mock.calls.map(([call]) => call);
      expect(calls.every(call => call.blockNumber === result.verifiedBlockNumber)).toBe(true);
      expect(calls).toEqual(expect.arrayContaining([
        expect.objectContaining({ address: identity.factory, functionName: 'nodeDeployer', args: [identity.nodeId] }),
        expect.objectContaining({ address: market, functionName: 'marketFactory' }),
        expect.objectContaining({ address: market, functionName: 'adjudicator' }),
        expect.objectContaining({ address: contracts.amm, functionName: 'tokenAOf', args: [market] }),
      ]));
    }
  });
  it('verifies each operation afresh even when given its previous verified context', async () => {
    let actualRelease: Hex = release.releaseId;
    let head = 100n;
    const eps = endpoints(call => call.functionName === 'releaseId' ? actualRelease : boundAnswer(call));
    for (const endpoint of eps) endpoint.reader.getBlockNumber = async () => head;
    const input = { context, endpoints: eps, market, account, action: { kind: 'approve' as const, venue: 'amm' as const, amountNative: 123n } };
    const first = await buildFactoryTransaction(input);
    head = 101n;
    const second = await buildFactoryTransaction({ ...input, context: first.verifiedContext });
    expect(second.verifiedContext.blockNumber).toBe(101n);
    actualRelease = hash(90);
    await expect(buildFactoryTransaction({ ...input, context: second.verifiedContext })).rejects.toThrow();
    await expect(verifyFactoryNode({ identity, release, endpoints: eps })).rejects.toThrow();
    await expect(assertMarketBinding({ identity, release, endpoints: eps, market })).rejects.toThrow();
  });
  it('refuses disagreement in the market adjudicator before building an approval', async () => {
    const eps = endpoints();
    eps[1]!.reader = client(call => call.functionName === 'adjudicator' ? addr(90) : boundAnswer(call));
    await expect(buildFactoryTransaction({ context, endpoints: eps, market, account, action: { kind: 'approve', venue: 'amm', amountNative: 123n } })).rejects.toThrow();
    for (const endpoint of eps) expect(vi.mocked(endpoint.reader.readContract).mock.calls.some(([call]) => call.functionName === 'tokenAOf')).toBe(false);
  });
  it('retains the binding endpoint intersection through the approval token read', async () => {
    const failures = ['releaseId', 'adjudicator', 'tokenAOf'];
    const eps = failures.map((failure, i) => ({ url: `https://endpoint${i}.example`, reader: client(call => {
      if (call.functionName === failure) throw new Error('RPC unavailable');
      return boundAnswer(call);
    }) }));
    await expect(buildFactoryTransaction({ context, endpoints: eps, market, account, action: { kind: 'approve', venue: 'amm', amountNative: 123n } })).rejects.toThrow();
  });
  it('cannot construct an approval after failed binding', async () => {
    await expect(buildFactoryTransaction({ context, endpoints: endpoints(call => call.functionName === 'nodeDeployer' ? addr(0) : boundAnswer(call)), market, account, action: { kind: 'approve', venue: 'amm', amountNative: 123n } })).rejects.toThrow();
  });
  it('checks LP receipt ownership and market before a transfer request', async () => {
    const answer = (call: BindingRead) => call.functionName === 'positionMarket' ? market : call.functionName === 'balanceOf' ? 5n : boundAnswer(call);
    const input = { context, endpoints: endpoints(answer), market, account, action: { kind: 'transferLP' as const, receiver: addr(8), positionId: 2n, units: 6n } };
    await expect(buildFactoryTransaction(input)).rejects.toThrow();
    expect((await buildFactoryTransaction({ ...input, action: { ...input.action, units: 5n } })).to).toBe(contracts.positionManager);
  });
  it('runs real caller simulation for policy authorization and refuses reverts', async () => {
    const calls: BindingRead[] = [];
    const answer = (call: BindingRead) => { calls.push(call); if (call.functionName === 'setCreationPaused') throw new Error('NotNodeAdmin'); return boundAnswer(call); };
    await expect(buildFactoryTransaction({ context, endpoints: endpoints(answer), market, account, action: { kind: 'setCreationPaused', paused: true } })).rejects.toThrow();
    expect(calls.filter(c => c.functionName === 'setCreationPaused').every(c => c.account === account && c.address === contracts.marketFactory)).toBe(true);
  });
  it('builds authorized policy setup on an empty node without a market', async () => {
    const answer = (call: BindingRead) => call.functionName === 'setTokenAllowed' ? undefined : boundAnswer(call);
    const result = await buildFactoryTransaction({ context, endpoints: endpoints(answer), account, action: { kind: 'setTokenAllowed', token: tokenA, allowed: true } });
    expect(result).toMatchObject({ address: contracts.marketFactory, functionName: 'setTokenAllowed', args: [tokenA, true] });
  });
});

describe('financial units and strict portfolios', () => {
  it('rounds six-decimal approval up and payout down', () => {
    expect(wadToNativeCeil(WAD + 1n, 6)).toBe(1_000_001n);
    expect(wadToNativeFloor(WAD + 1n, 6)).toBe(1_000_000n);
    expect(() => wadToNativeCeil(1n, -1)).toThrow();
    expect(() => wadToNativeFloor(-1n, 6)).toThrow();
  });
  it('bounds AMM buys in WAD and approves exact native collateral', () => {
    const result = planAmmTrade({ side: 'buy', outcome: 1, sharesWad: WAD, quote: { costWad: WAD, feeWad: 0n, netWad: WAD, newPriceWad: WAD / 2n }, token: { address: tokenA, decimals: 6, symbol: 'USD' }, balance: 2_000_000n, allowance: 0n, held: { yes: 0n, no: 0n } });
    expect(result).toMatchObject({ ok: true, boundWad: 1_010_000_000_000_000_000n, requiredNative: 1_010_000n, approveNative: 1_010_000n });
  });
  it('does not spend reserved book inventory or accept out-of-range ticks', () => {
    const input = { action: 1 as const, outcome: 0 as const, priceTick: 500, sharesWad: WAD, shareUnit: 10n ** 12n, feeBps: 20, token: { address: bookToken, decimals: 6, symbol: 'USD' }, balance: 0n, allowance: 0n, inventory: { yesOwned: 0n, noOwned: WAD, yesReserved: 0n, noReserved: WAD }, postOnly: false };
    expect(planBookOrder(input).ok).toBe(false);
    expect(planBookOrder({ ...input, priceTick: 1000 }).ok).toBe(false);
  });
  it('throws failed positions and balance reads rather than showing zero', async () => {
    await expect(readFactoryPositions({ context, client: client(), markets: [market], account })).rejects.toThrow();
    await expect(readFactoryBookInventory({ context, client: client(call => call.functionName === 'getInventory' ? [0n, 0n, 0n, 0n, 0n] : boundAnswer(call)), market, account })).rejects.toThrow();
  });
  it('discovers bootstrap, additions and transferred LP receipt classes', async () => {
    const reads = client(call => {
      switch (call.functionName) {
        case 'nextPositionId': return 4n;
        case 'positionMarket': return market;
        case 'balanceOf': return call.args![1] === 1n ? 0n : 5n;
        case 'totalSupply': return 10n;
        case 'residual': return 20n;
        default: return boundAnswer(call);
      }
    });
    const result = await discoverFactoryLpPositions({ context, client: reads, account });
    expect(result.positions.map(p => p.positionId)).toEqual([2n, 3n]);
    expect(result.complete).toBe(true);
    await expect(discoverFactoryLpPositions({ context, client: reads, account, maxPositions: 2 })).rejects.toThrow();
  });
  it('skips cleared cancelled orders and never truncates bounded discovery', async () => {
    const reads = { ...client(call => call.functionName === 'getOrder' ? { amount: 0n, market: addr(0), maker: addr(0) } : boundAnswer(call)), getLogs: async () => [{ args: { orderId: 1n } }] };
    expect((await readFactoryBookOrders({ context, client: reads, market, account })).orders).toEqual([]);
    await expect(readFactoryBookOrders({ context, client: reads, market, account, chunkSize: 1n, maxChunks: 2 })).rejects.toThrow();
    await expect(readFactoryBookOrders({ context, client: reads, market, account, fromBlock: 50n })).rejects.toThrow();
  });
  it('scans maker history once across markets and pins canonical orders and bindings', async () => {
    const otherMarket = addr(8);
    const reads = { ...client(call => call.functionName === 'getOrder'
      ? { market: call.args![0] === 1n ? market : otherMarket, maker: account, amount: WAD }
      : boundAnswer(call)), getLogs: vi.fn(async () => [{ args: { orderId: 1n } }, { args: { orderId: 2n } }, { args: { orderId: 1n } }]) };
    const result = await readFactoryNodeBookOrders({ context, client: reads, account, blockNumber: 100n, chunkSize: 50n });
    expect(result.orders.map(o => o.orderId)).toEqual([1n, 2n]);
    expect(reads.getLogs).toHaveBeenCalledTimes(2);
    expect(reads.getLogs).toHaveBeenNthCalledWith(1, expect.objectContaining({ args: { maker: account }, fromBlock: 10n, toBlock: 59n }));
    expect(reads.getLogs).toHaveBeenNthCalledWith(2, expect.objectContaining({ args: { maker: account }, fromBlock: 60n, toBlock: 100n }));
    for (const [call] of vi.mocked(reads.readContract).mock.calls) expect(call.blockNumber).toBe(100n);
    expect(vi.mocked(reads.readContract).mock.calls.filter(([c]) => c.functionName === 'getOrder')).toHaveLength(2);
    expect(vi.mocked(reads.readContract).mock.calls.filter(([c]) => c.functionName === 'marketFactory')).toHaveLength(2);
  });
  it('refuses a different maker or node and skips cleared node orders', async () => {
    const input = (maker: Address, amount = WAD, foreign = false) => ({ context, account, client: {
      ...client(call => call.functionName === 'getOrder' ? { market, maker, amount }
        : foreign && call.functionName === 'marketFactory' ? addr(99) : boundAnswer(call)),
      getLogs: async () => [{ args: { orderId: 1n } }],
    } });
    await expect(readFactoryNodeBookOrders(input(addr(99)))).rejects.toThrow();
    await expect(readFactoryNodeBookOrders(input(account, WAD, true))).rejects.toThrow();
    expect((await readFactoryNodeBookOrders(input(addr(0), 0n))).orders).toEqual([]);
  });
  it('never returns partial node discovery or skips release history', async () => {
    const reads = { ...client(), getLogs: vi.fn(async () => [{ args: { orderId: 1n } }]) };
    await expect(readFactoryNodeBookOrders({ context, client: reads, account, fromBlock: 50n })).rejects.toThrow();
    await expect(readFactoryNodeBookOrders({ context, client: reads, account, chunkSize: 1n, maxChunks: 2 })).rejects.toThrow();
    reads.getLogs.mockResolvedValueOnce([{ args: { orderId: 1n } }]).mockRejectedValueOnce(new Error('log range unavailable'));
    await expect(readFactoryNodeBookOrders({ context, client: reads, account, chunkSize: 50n })).rejects.toThrow();
    expect(vi.mocked(reads.readContract)).not.toHaveBeenCalled();
  });
  it('values residuals against immutable deposits after partial burns', async () => {
    const reads = { ...client(call => {
      switch (call.functionName) {
        case 'nextPositionId': return 2n;
        case 'positionMarket': return market;
        case 'balanceOf': return 25n;
        case 'totalSupply': return 50n;
        case 'residual': return 200n;
        default: return boundAnswer(call);
      }
    }), getLogs: async () => [{ args: { market, positionId: 1n, deposit: 100n } }] };
    const result = await discoverFactoryLpPositions({ context, client: reads, account });
    expect(result.positions[0]).toMatchObject({ units: 25n, totalSupply: 50n, initialSupplyWad: 100n, valueIfYesWad: 50n, valuationComplete: true });
  });
  it('bounds original-deposit logs without hiding receipt ownership or inventing valuations', async () => {
    const reads = { ...client(call => {
      switch (call.functionName) {
        case 'nextPositionId': return 3n;
        case 'positionMarket': return market;
        case 'balanceOf': return 25n;
        case 'totalSupply': return 50n;
        case 'residual': return 203n;
        default: return boundAnswer(call);
      }
    }), getLogs: vi.fn(async () => [{ args: { market, positionId: 1n, deposit: 100n } }]) };
    const result = await discoverFactoryLpPositions({ context, client: reads, account, fromBlock: 90n, chunkSize: 11n, maxChunks: 1 });
    expect(reads.getLogs).toHaveBeenCalledWith(expect.objectContaining({ fromBlock: 90n, toBlock: 100n }));
    expect(result.complete).toBe(true);
    expect(result.positions).toHaveLength(2);
    expect(result.positions[0]).toMatchObject({ valueIfYesWad: 50n, valuationComplete: true });
    expect(result.positions[1]).toMatchObject({ initialSupplyWad: null, valueIfYesWad: null, valuationComplete: false });
    for (const maxItems of [NaN, Infinity, 0, -1, 1.5]) {
      const invalid = await discoverFactoryLpPositions({ context, client: reads, account, maxItems });
      expect(invalid.positions.every(position => !position.valuationComplete)).toBe(true);
    }
  });
  it('rejects duplicate or inconsistent original-deposit evidence', async () => {
    const reads = { ...client(call => {
      switch (call.functionName) {
        case 'nextPositionId': return 2n;
        case 'positionMarket': return market;
        case 'balanceOf': return 25n;
        case 'totalSupply': return 50n;
        case 'residual': return 200n;
        default: return boundAnswer(call);
      }
    }), getLogs: vi.fn(async () => [{ args: { market, positionId: 1n, deposit: 100n } }, { args: { market, positionId: 1n, deposit: 100n } }]) };
    expect((await discoverFactoryLpPositions({ context, client: reads, account })).positions[0]!.valuationComplete).toBe(false);
    reads.getLogs.mockResolvedValue([{ args: { market, positionId: 1n, deposit: 40n } }]);
    expect((await discoverFactoryLpPositions({ context, client: reads, account })).positions[0]!.valuationComplete).toBe(false);
  });
  it('uses sequential fee checkpoints to preserve cross-position rounding', async () => {
    const reads = client(call => {
      switch (call.functionName) {
        case 'floorEntitlementOf': return WAD;
        case 'lpEntitlementOf': case 'claimableFees': return 100n;
        case 'refundableResolutionOf': case 'deferredOf': return 2n;
        case 'isSettled': return true;
        case 'nextPositionId': return 3n;
        case 'positionMarket': return market;
        case 'balanceOf': case 'totalSupply': return 5n;
        case 'residual': return 10n;
        default: return boundAnswer(call);
      }
    });
    reads.simulateContract = async call => ({ result: call.functionName === 'claimLPDividend' ? 100n : call.args![1] === 1n ? 110n : 120n });
    reads.simulateSequence = vi.fn(async () => [undefined, undefined, 131n]);
    const result = await readFactoryEntitlements({ context, client: reads, market, account });
    expect(result).toMatchObject({ floorWad: WAD, checkpointedLpFeesNative: 100n, simulatedLpFeesNative: 131n, lpFeesComplete: true });
    expect(reads.simulateSequence).toHaveBeenCalledWith(expect.objectContaining({ blockNumber: 100n, calls: expect.arrayContaining([expect.objectContaining({ functionName: 'checkpointFees', args: [1n, account] }), expect.objectContaining({ functionName: 'checkpointFees', args: [2n, account] })]) }));
    reads.simulateSequence = async () => { throw new Error('RPC offline'); };
    expect(await readFactoryEntitlements({ context, client: reads, market, account })).toMatchObject({ simulatedLpFeesNative: null, lpFeesComplete: false, lpFeesGap: 'RPC offline' });
    delete reads.simulateSequence;
    expect(await readFactoryEntitlements({ context, client: reads, market, account })).toMatchObject({ simulatedLpFeesNative: null, lpFeesComplete: false });
  });
  it('keeps transferred-away checkpointed fees and rejects malformed single claim results', async () => {
    const reads = client(call => {
      switch (call.functionName) {
        case 'floorEntitlementOf': return 0n;
        case 'lpEntitlementOf': case 'claimableFees': return 100n;
        case 'refundableResolutionOf': case 'deferredOf': return 0n;
        case 'isSettled': return true;
        case 'nextPositionId': return 2n;
        case 'positionMarket': return market;
        case 'balanceOf': return 0n;
        default: return boundAnswer(call);
      }
    });
    reads.simulateContract = vi.fn(async () => ({ result: 100n }));
    expect(await readFactoryEntitlements({ context, client: reads, market, account })).toMatchObject({ lpDividendNative: 100n, checkpointedLpFeesNative: 100n, simulatedLpFeesNative: 100n, lpFeesComplete: true });
    expect(reads.simulateContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'claimLPDividend' }));
    reads.simulateContract = async () => ({ result: undefined });
    expect(await readFactoryEntitlements({ context, client: reads, market, account })).toMatchObject({ simulatedLpFeesNative: null, lpFeesComplete: false, lpFeesGap: expect.any(String) });
  });
  it('does not let one node receipt pin another chain or node', () => {
    noteReceipt(identity, 200n, 1_000);
    expect(freshReceiptBlock(identity, 1_001)).toBe(200n);
    expect(freshReceiptBlock({ ...identity, nodeId: hash(88) }, 1_001)).toBeUndefined();
    expect(freshReceiptBlock({ ...identity, chainId: 1 }, 1_001)).toBeUndefined();
    expect(freshReceiptBlock(identity, 61_001)).toBeUndefined();
    forgetReceipt(identity);
  });
});

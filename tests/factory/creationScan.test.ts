import { describe, expect, it, vi } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, type Address, type Hex, type TransactionReceipt } from 'viem';
import { getFactoryAbis } from '../../src/factory/factoryAbi/index.js';
import { SUPPORTED_FACTORY_RELEASES } from '../../src/factory/releases.js';
import { deriveNodeChildren } from '../../src/factory/factoryTrade/nodeChildren.js';
import { readFactoryBookOrders, type FactoryEventClient } from '../../src/factory/factoryPortfolio.js';
import type { FactoryNodeContext } from '../../src/factory/factoryClient.js';

const address = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Address;
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex;
const market = address(2), account = address(3), deployer = address(4);
const release = { ...SUPPORTED_FACTORY_RELEASES[1], startBlock: 10 };
const context: FactoryNodeContext = { chainId: release.chainId, factory: release.factory, nodeId: hash(1), release, contracts: { ...deriveNodeChildren(deployer), deployer }, startBlock: 10n, blockNumber: 100n };
const creation = { blockNumber: 80, blockHash: hash(80), transactionHash: hash(81), logIndex: 2 };
function fixture(eventMarket = market) {
  const { MarketFactoryAbi } = getFactoryAbis(release);
  const event = MarketFactoryAbi.find(item => item.type === 'event' && item.name === 'MarketCreated');
  if (!event || event.type !== 'event') throw new Error('Missing MarketCreated event');
  const log = { address: context.contracts.marketFactory, topics: encodeEventTopics({ abi: MarketFactoryAbi, eventName: 'MarketCreated', args: { market: eventMarket, creator: account } }), data: encodeAbiParameters(event.inputs.filter(input => !input.indexed), ['Question?', 1n, 1000n, address(5), 6, 10n ** 18n, address(6), 1n, 0n]), blockNumber: 80n, blockHash: creation.blockHash, transactionHash: creation.transactionHash, logIndex: 2, transactionIndex: 0, removed: false };
  const receipt = { status: 'success', transactionHash: creation.transactionHash, blockHash: creation.blockHash, blockNumber: 80n, logs: [log] } as TransactionReceipt;
  const client: FactoryEventClient = {
    getChainId: async () => context.chainId,
    getBlockNumber: async () => 100n,
    readContract: async call => {
      if (call.functionName === 'marketFactory') return context.contracts.marketFactory;
      if (call.functionName === 'getOrder') return { market, maker: account, amount: 1n };
      throw new Error(`Unexpected read ${call.functionName}`);
    },
    getTransactionReceipt: async () => receipt,
    getCanonicalBlock: async () => ({ number: 80n, hash: creation.blockHash }),
    getLogs: vi.fn(async () => [{ args: { orderId: 1n } }]),
  };
  return { client, receipt, log };
}

describe('authenticated market creation scan floor', () => {
  it('scans the complete market lifetime and reconciles orders at the current block', async () => {
    const { client } = fixture();
    const result = await readFactoryBookOrders({ context, client, market, account, marketCreation: creation });
    expect(result.orders.map(order => order.orderId)).toEqual([1n]);
    expect(client.getLogs).toHaveBeenCalledWith(expect.objectContaining({ fromBlock: 80n, toBlock: 100n }));
  });
  it.each(['wrong-market', 'reorg', 'reverted', 'foreign-emitter', 'removed', 'wrong-log-index'])(
    'refuses %s evidence before scanning any orders', async failure => {
      const { client, receipt, log } = fixture(failure === 'wrong-market' ? address(99) : market);
      if (failure === 'reorg') client.getCanonicalBlock = async () => ({ number: 80n, hash: hash(99) });
      if (failure === 'reverted') receipt.status = 'reverted';
      if (failure === 'foreign-emitter') log.address = address(99);
      if (failure === 'removed') log.removed = true;
      await expect(readFactoryBookOrders({ context, client, market, account, marketCreation: { ...creation, logIndex: failure === 'wrong-log-index' ? 99 : creation.logIndex } })).rejects.toThrow();
      expect(client.getLogs).not.toHaveBeenCalled();
    },
  );
  it('cannot skip history after creation or use an unauthenticated later floor', async () => {
    const { client } = fixture();
    await expect(readFactoryBookOrders({ context, client, market, account, marketCreation: creation, fromBlock: 81n })).rejects.toThrow();
    await expect(readFactoryBookOrders({ context, client, market, account, fromBlock: 80n })).rejects.toThrow();
    expect(client.getLogs).not.toHaveBeenCalled();
  });
});

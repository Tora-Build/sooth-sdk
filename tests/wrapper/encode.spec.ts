/**
 * Encode-level regression tests for the public SoothClient wrapper.
 *
 * Each wrapper call is run through viem's encodeFunctionData against the ABI
 * the wrapper actually passes — so any drift between a wrapper call and the
 * canonical ABI (wrong param type/count/name → different selector) throws here
 * instead of reverting on-chain. This is the guard that was missing when the
 * Orderbook wrapper shipped a stale inline ABI (issue #19: W1–W3).
 */

import { describe, it, expect } from 'vitest';
import { decodeFunctionData, encodeFunctionData, type Abi } from 'viem';
import { Markets } from '../../src/market';
import { Orderbook } from '../../src/orderbook';
import type { SoothClient } from '../../src/client';

const addr = (n: number) => `0x${n.toString(16).padStart(2, '0').repeat(20)}` as `0x${string}`;

const CONTRACTS = {
  launchpadEngine: addr(0x11),
  soothBook: addr(0x22),
  ammEngine: addr(0x33),
  orderEngine: addr(0x44),
  truthMarket: addr(0x55),
  feeRouter: addr(0x66),
  adjudicatorRegistry: addr(0x77),
  baseToken: addr(0x88),
};
const ACCOUNT = addr(0x99);
const DEFAULT_ADJ = addr(0xaa);
const MARKET = addr(0xbc);
const MARKET_KEY = `0x${'cd'.repeat(32)}` as `0x${string}`;

// Plausible return shapes so read wrappers don't crash while destructuring.
const READ_RETURNS: Record<string, unknown> = {
  getMarkets: [MARKET],
  getMarketCount: 3n,
  markets: [addr(0x01), addr(0x02), 1000n, 693n, 0n],
  isGraduated: false,
  getPosition: [10n, 20n],
  registeredMarkets: true,
  getBestTick: 500,
  getImpliedPrice: [5n, 5n],
  getImpliedPriceByKey: [5n, 5n],
  getBalance: [1n, 2n],
  getOrdersAtTick: [7n, 2n],
};

interface Captured {
  functionName: string;
  data: `0x${string}`;
  abi: Abi;
}

function makeClient(node?: { adjudicators?: { default?: `0x${string}` } }) {
  const calls: Captured[] = [];
  const client = {
    contracts: CONTRACTS,
    account: ACCOUNT,
    node: node ?? { adjudicators: { default: DEFAULT_ADJ } },
    publicClient: {
      // Encoding here throws if the read args don't match the ABI.
      readContract: async ({
        abi,
        functionName,
        args,
      }: {
        abi: Abi;
        functionName: string;
        args?: readonly unknown[];
      }) => {
        encodeFunctionData({ abi, functionName, args } as never);
        return READ_RETURNS[functionName];
      },
    },
    writeContract: async ({
      abi,
      functionName,
      args,
    }: {
      abi: Abi;
      functionName: string;
      args?: readonly unknown[];
    }) => {
      const data = encodeFunctionData({ abi, functionName, args } as never);
      calls.push({ functionName, data, abi });
      return '0xhash' as `0x${string}`;
    },
  };
  return { client: client as unknown as SoothClient, calls };
}

describe('Markets wrapper — canonical ABI encoding', () => {
  it('reads (list/count/getInfo/getPosition) encode and shape correctly', async () => {
    const { client } = makeClient();
    const markets = new Markets(client);
    expect(await markets.list()).toEqual([MARKET]);
    expect(await markets.count()).toBe(3);
    const info = await markets.getInfo(MARKET);
    expect(info.bBase).toBe(1000n);
    expect(info.creatorDeposit).toBe(693n);
    expect(info.isGraduated).toBe(false);
    const pos = await markets.getPosition(MARKET, ACCOUNT);
    expect(pos).toEqual({ yesShares: 10n, noShares: 20n });
  });

  it('trade(buy) encodes a positive deltaShares (W2)', async () => {
    const { client, calls } = makeClient();
    await new Markets(client).trade(MARKET, { outcome: 'yes', shares: '5', maxCost: '10' });
    const { args } = decodeFunctionData({ abi: calls[0].abi, data: calls[0].data });
    // tradePositions(market, outcome, deltaShares, limit)
    expect((args as unknown[])[2]).toBe(5n * 10n ** 18n);
  });

  it('trade(sell) encodes a NEGATIVE deltaShares — selling now works (W2)', async () => {
    const { client, calls } = makeClient();
    await new Markets(client).trade(MARKET, { outcome: 'no', side: 'sell', shares: '5' });
    const { args } = decodeFunctionData({ abi: calls[0].abi, data: calls[0].data });
    expect((args as unknown[])[2]).toBe(-(5n * 10n ** 18n));
    expect((args as unknown[])[3]).toBe(0n); // default minProceeds
  });

  it('trade(buy) without maxCost throws', async () => {
    const { client } = makeClient();
    await expect(
      new Markets(client).trade(MARKET, { outcome: 'yes', shares: '5' }),
    ).rejects.toThrow(/maxCost/);
  });

  it('create() uses the node adjudicator default, never the caller EOA (W3)', async () => {
    const { client, calls } = makeClient();
    await new Markets(client).create({ question: 'Q?', initialLiquidity: '20' });
    const { args } = decodeFunctionData({ abi: calls[0].abi, data: calls[0].data });
    // createMarket(question, startTime, deadline, adjudicator, bBase, prob, config)
    // viem returns EIP-55 checksummed addresses — compare case-insensitively.
    const adjudicator = ((args as unknown[])[3] as string).toLowerCase();
    expect(adjudicator).toBe(DEFAULT_ADJ.toLowerCase());
    expect(adjudicator).not.toBe(ACCOUNT.toLowerCase());
    expect((args as unknown[])[5]).toBe(500000000000000000n); // default 0.5e18
  });

  it('create() throws when no adjudicator is available (no EOA fallback) (W3)', async () => {
    const { client } = makeClient({ adjudicators: {} });
    await expect(
      new Markets(client).create({ question: 'Q?', initialLiquidity: '20' }),
    ).rejects.toThrow(/adjudicator/i);
  });

  it('create() rejects out-of-range probability', async () => {
    const { client } = makeClient();
    await expect(
      new Markets(client).create({
        question: 'Q?',
        initialLiquidity: '20',
        initialProbabilityWad: 0n,
      }),
    ).rejects.toThrow(/0 < p < 1e18/);
  });
});

describe('Orderbook wrapper — canonical SoothBook ABI (W1)', () => {
  it('buyYes encodes matchLimit as uint32 (not the old maxCost uint256)', async () => {
    const { client, calls } = makeClient();
    await new Orderbook(client).buyYes(MARKET_KEY, { tick: 600, amount: '1' });
    const { functionName, args } = decodeFunctionData({ abi: calls[0].abi, data: calls[0].data });
    expect(functionName).toBe('buyYes');
    // 5th arg is matchLimit (default 100), a small uint32 — NOT a WAD maxCost.
    expect((args as unknown[])[4]).toBe(100);
  });

  it('buyNo + cancel + cancelById encode cleanly against the canonical ABI', async () => {
    const { client, calls } = makeClient();
    const ob = new Orderbook(client);
    await ob.buyNo(MARKET_KEY, { tick: 400, amount: '2', escrow: true, matchLimit: 50 });
    await ob.cancel(MARKET_KEY, 'yes', 600);
    await ob.cancelById(42n);
    expect(calls.map((c) => c.functionName)).toEqual(['buyNo', 'cancel', 'cancelById']);
    const buyNo = decodeFunctionData({ abi: calls[0].abi, data: calls[0].data });
    expect((buyNo.args as unknown[])[4]).toBe(50);
  });

  it('reads (isRegistered/getImpliedPrice/getBestTick/getBalance) encode & return', async () => {
    const { client } = makeClient();
    const ob = new Orderbook(client);
    expect(await ob.isRegistered(MARKET_KEY)).toBe(true);
    expect(await ob.getBestTick(MARKET_KEY, 'yes')).toBe(500);
    expect(await ob.getImpliedPrice(MARKET_KEY)).toEqual({ yesPrice: 5n, noPrice: 5n });
    expect(await ob.getImpliedPriceByMarket(MARKET)).toEqual({ yesPrice: 5n, noPrice: 5n });
    expect(await ob.getBalance(MARKET_KEY, ACCOUNT)).toEqual({ yes: 1n, no: 2n });
  });
});

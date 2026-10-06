import { describe, expect, it, vi } from 'vitest';
import { encodeFunctionData, type Address, type PublicClient } from 'viem';
import {
  buildApprovalRequest,
  computeSoothBookQuote,
  preflightTrade,
  readSoothBookMarketSnapshot,
  type SoothCoreSnapshot,
} from '../../src/core/contracts/soothCore.js';

const MARKET = `0x${'11'.repeat(20)}` as Address;
const BOOK = `0x${'22'.repeat(20)}` as Address;
const ORDER = `0x${'33'.repeat(20)}` as Address;
const VAULT = `0x${'44'.repeat(20)}` as Address;
const USER = `0x${'55'.repeat(20)}` as Address;
const ROUTER = `0x${'66'.repeat(20)}` as Address;
const WAD = 10n ** 18n;

function clientFor(
  options: {
    legacy?: boolean;
    feeError?: string;
    discoveryError?: string;
    fee?: number;
    settled?: boolean;
  } = {},
) {
  const readContract = vi.fn(async ({ address, abi, functionName, args }) => {
    // Catch ABI omissions even when the mock happens to recognize a getter name.
    encodeFunctionData({ abi, functionName, args });
    switch (functionName) {
      case 'registeredMarkets':
        return true;
      case 'getImpliedPriceByKey':
        return [(WAD * 6n) / 10n, (WAD * 4n) / 10n];
      case 'getBestTick':
        return 600;
      case 'getCollateralBacking':
        return 100n * WAD;
      case 'getBalance':
        return [10n * WAD, 0n];
      case 'isSettled':
        expect(address).toBe(MARKET);
        return options.settled ?? false;
      case 'winningOutcome':
        expect(address).toBe(MARKET);
        return 1;
      case 'orderEngine':
        expect(address).toBe(BOOK);
        return ORDER;
      case 'feeVault':
        expect(address).toBe(ORDER);
        if (options.discoveryError) throw new Error(options.discoveryError);
        if (options.legacy) throw new Error('execution reverted: selector not recognized');
        return VAULT;
      case 'feeBpsOf':
        expect(address).toBe(VAULT);
        expect(args).toEqual([MARKET]);
        if (options.feeError) throw new Error(options.feeError);
        return options.fee ?? 100;
      case 'feeRouter':
        expect(address).toBe(BOOK);
        if (!options.legacy) throw new Error('removed getter');
        return ROUTER;
      case 'postGradFeeBps':
        expect(address).toBe(ROUTER);
        return 75;
      default:
        throw new Error(`Unexpected getter: ${functionName}`);
    }
  });
  return { client: { readContract } as unknown as PublicClient, readContract };
}

describe('SoothBook FeeVault fees and balance requirements', () => {
  it('returns null for an unregistered empty book without requiring a FeeVault market config', async () => {
    const readContract = vi.fn(async ({ functionName }) => {
      if (functionName === 'registeredMarkets' || functionName === 'isSettled') return false;
      if (functionName === 'getCollateralBacking') return 0n;
      if (functionName === 'getImpliedPriceByKey') return [0n, 0n];
      if (functionName === 'getBestTick') return 1000;
      if (functionName === 'winningOutcome') return 2;
      throw new Error(`Unexpected getter: ${functionName}`);
    });
    expect(
      await readSoothBookMarketSnapshot({ readContract } as unknown as PublicClient, BOOK, MARKET),
    ).toBeNull();
    expect(readContract.mock.calls.some(([call]) => call.functionName === 'feeBpsOf')).toBe(false);
  });
  it('reads the market-specific 100 bps fee through OrderEngine without removed v0.4 getters', async () => {
    const { client, readContract } = clientFor();
    const book = (await readSoothBookMarketSnapshot(client, BOOK, MARKET, USER))!;
    expect(book.feeBps).toBe(100n);
    expect(readContract.mock.calls.some(([call]) => call.functionName === 'feeRouter')).toBe(false);
    const quote = computeSoothBookQuote(book, { action: 'buy', outcome: 1, shares: 10n * WAD });
    expect(quote).toMatchObject({
      rawQuote: 6n * WAD,
      fee: (6n * WAD) / 100n,
      total: (606n * WAD) / 100n,
    });
    const state = {
      tradingVenue: 'soothbook',
      soothBook: book,
      truth: { isSettled: false, isFinalized: false },
      launchpadAmm: { launchpad: { isDismissed: false } },
    } as SoothCoreSnapshot;
    const input = {
      action: 'buy' as const,
      outcome: 1,
      shares: quote.shares,
      maxCostOrMinProceeds: quote.rawQuote,
      quotedTotal: quote.total,
    };
    expect(preflightTrade(state, { ...input, userBalance: quote.rawQuote })).toEqual({
      canTrade: false,
      reason: 'insufficient_balance',
      required: quote.total,
      available: quote.rawQuote,
    });
    expect(preflightTrade(state, { ...input, userBalance: quote.total })).toEqual({
      canTrade: true,
    });
    expect(
      buildApprovalRequest({
        tokenAddress: VAULT,
        spender: ORDER,
        amount: quote.total,
        allowance: quote.rawQuote,
      })?.requiredAmount,
    ).toBe(quote.total);
    expect(
      buildApprovalRequest({
        tokenAddress: VAULT,
        spender: ORDER,
        amount: quote.total,
        allowance: quote.total,
      }),
    ).toBeNull();
    expect(
      computeSoothBookQuote(book, { action: 'sell', outcome: 1, shares: 10n * WAD }).proceeds,
    ).toBe((594n * WAD) / 100n);
  });

  it('preserves an explicit zero fee from FeeVault', async () => {
    const { client } = clientFor({ fee: 0 });
    expect((await readSoothBookMarketSnapshot(client, BOOK, MARKET))?.feeBps).toBe(0n);
  });

  it('uses FeeRouter.postGradFeeBps for legacy engines without feeVault', async () => {
    const { client } = clientFor({ legacy: true });
    expect((await readSoothBookMarketSnapshot(client, BOOK, MARKET))?.feeBps).toBe(75n);
  });

  it.each([
    { discoveryError: 'network timeout' },
    { feeError: 'network timeout' },
    { feeError: 'execution reverted: NotRegistered' },
  ])('surfaces fee failures instead of quoting a free trade: %j', async (options) => {
    const { client, readContract } = clientFor(options);
    await expect(readSoothBookMarketSnapshot(client, BOOK, MARKET)).rejects.toThrow();
    expect(readContract.mock.calls.some(([call]) => call.functionName === 'feeRouter')).toBe(false);
  });

  it('reads settled state from TruthMarket while preserving registered book holdings', async () => {
    const { client } = clientFor({ settled: true });
    expect(await readSoothBookMarketSnapshot(client, BOOK, MARKET, USER)).toMatchObject({
      exists: true,
      isActive: false,
      isFinalized: true,
      outcome: 1,
      userYesBalance: 10n * WAD,
    });
  });
});

import { describe, expect, it } from 'vitest';
import type { Address, PublicClient } from 'viem';
import {
  readLaunchpadAmmSnapshot,
  readSoothBookMarketSnapshot,
} from '../../src/core/contracts/index.js';

const address = (byte: string) => `0x${byte.repeat(40)}` as Address;

const AMM_ENGINE = address('1');
const LAUNCHPAD_ENGINE = address('2');
const FEE_ROUTER = address('3');
const MARKET = address('4');
const USER = address('5');
const CREATOR = address('6');
const LP_TOKEN = address('7');
const SOOTH_BOOK = address('8');

type ReadCall = {
  address: Address;
  functionName: string;
  args?: readonly unknown[];
};

function makePublicClient(returns: Record<string, unknown>) {
  const calls: ReadCall[] = [];
  const client = {
    readContract: async (request: ReadCall) => {
      calls.push(request);
      const value = returns[request.functionName];
      if (value === undefined) throw new Error(`unexpected read: ${request.functionName}`);
      return typeof value === 'function'
        ? (value as (request: ReadCall) => unknown)(request)
        : value;
    },
  } as unknown as PublicClient;

  return { client, calls };
}

describe('readLaunchpadAmmSnapshot economics', () => {
  it('reads authoritative AMM, FeeRouter, and LP-token values without synthetic zeroes', async () => {
    const { client, calls } = makePublicClient({
      getLiquidity: 1_000n,
      markets: [CREATOR, LP_TOKEN, 500n, 800n, 0n] as const,
      isGraduated: false,
      getPosition: [11n, 22n] as const,
      feeRouter: FEE_ROUTER,
      getMarketState: [30n, 20n, 600_000_000_000_000_000n] as const,
      getFeeState: [650n, 200n, 75n, false] as const,
      getGraduationProgress: [200n, 400n, 5_000n] as const,
      preGradFeeBps: 450,
      postGradFeeBps: 90,
      totalSupply: 9_000n,
      trialEndTimes: 2_000n,
    });

    const snapshot = await readLaunchpadAmmSnapshot(
      client,
      { ammEngine: AMM_ENGINE, launchpadEngine: LAUNCHPAD_ENGINE },
      MARKET,
      { userAddress: USER, nowSeconds: 1_500n },
    );

    expect(snapshot.launchpad).toMatchObject({
      bCurrent: 650n,
      feesAccrued: 200n,
      graduationThreshold: 400n,
      graduationProgressBps: 5_000n,
      totalLPSupply: 9_000n,
      lpYieldPool: 75n,
      preGradFeeBps: 450n,
      postGradFeeBps: 90n,
      currentFeeBps: 450n,
      floorValue: null,
      createdAt: null,
      isInTrialPeriod: true,
      trialTimeRemainingSeconds: 500,
    });
    expect(snapshot.amm).toMatchObject({
      liquidity: 1_000n,
      userYesShares: 11n,
      userNoShares: 22n,
    });

    expect(calls.find((call) => call.functionName === 'getFeeState')?.address).toBe(FEE_ROUTER);
    expect(calls.find((call) => call.functionName === 'totalSupply')?.address).toBe(LP_TOKEN);
  });

  it('reads FeeVault economics when AMMEngine.feeRouter() is gone', async () => {
    const feeVault = address('9');
    const ammToken = address('a');
    const { client, calls } = makePublicClient({
      getLiquidity: 1_000n,
      markets: [CREATOR, LP_TOKEN, 500n, 800n, 0n] as const,
      isGraduated: false,
      getPosition: [11n, 22n] as const,
      feeRouter: () => {
        throw new Error('execution reverted');
      },
      feeVault,
      configOf: {
        preGradFeeBps: 450,
        postGradFeeBps: 90,
        ammToken,
      },
      graduationProgress: [200n, 400n] as const,
      accountOf: 75n,
      getMarketState: [30n, 20n, 600_000_000_000_000_000n] as const,
      totalSupply: 9_000n,
      trialEndTimes: 2_000n,
    });

    const snapshot = await readLaunchpadAmmSnapshot(
      client,
      { ammEngine: AMM_ENGINE, launchpadEngine: LAUNCHPAD_ENGINE },
      MARKET,
      { userAddress: USER, nowSeconds: 1_500n },
    );

    expect(snapshot.launchpad).toMatchObject({
      bCurrent: 500n,
      feesAccrued: 200n,
      graduationThreshold: 400n,
      graduationProgressBps: 5_000n,
      lpYieldPool: 75n,
      preGradFeeBps: 450n,
      postGradFeeBps: 90n,
      currentFeeBps: 450n,
    });
    expect(calls.find((call) => call.functionName === 'configOf')?.address).toBe(feeVault);
    expect(calls.find((call) => call.functionName === 'accountOf')?.args).toEqual([
      MARKET,
      1,
      ammToken,
    ]);
    expect(calls.some((call) => call.functionName === 'getFeeState')).toBe(false);
  });
});

describe('readSoothBookMarketSnapshot fee source', () => {
  it('reads post-graduation fee bps through SoothBook.feeRouter()', async () => {
    const { client, calls } = makePublicClient({
      registeredMarkets: true,
      getImpliedPriceByKey: [550_000_000_000_000_000n, 450_000_000_000_000_000n] as const,
      getBestTick: ({ args }: ReadCall) => (args?.[1] === 1 ? 550 : 450),
      getCollateralBacking: 1_000n,
      feeRouter: FEE_ROUTER,
      postGradFeeBps: 90,
      getBalance: [12n, 8n] as const,
    });

    const snapshot = await readSoothBookMarketSnapshot(client, SOOTH_BOOK, MARKET, USER);

    expect(snapshot?.feeBps).toBe(90n);
    expect(calls.some((call) => call.functionName === 'feeBps')).toBe(false);
    expect(calls.find((call) => call.functionName === 'postGradFeeBps')?.address).toBe(FEE_ROUTER);
  });
});

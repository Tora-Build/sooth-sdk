import { describe, expect, it, vi } from 'vitest';
import { decodeFunctionData, encodeFunctionData, type Address, type PublicClient } from 'viem';
import {
  buildClaimRequest,
  getClaimAbiForRequest,
  readCollateralizerSnapshot,
  type SoothCoreSnapshot,
} from '../../src/core/contracts/soothCore.js';
import { AMMEngineABI } from '../../src/core/abis/v040/AMMEngine.js';
import { OrderEngineABI } from '../../src/core/abis/v040/OrderEngine.js';

const MARKET = `0x${'11'.repeat(20)}` as Address;
const USER = `0x${'22'.repeat(20)}` as Address;
const AMM = `0x${'33'.repeat(20)}` as Address;
const ORDER = `0x${'44'.repeat(20)}` as Address;
const contracts = { launchpadEngine: AMM, ammEngine: AMM, orderEngine: ORDER };

function snapshot(ammYes = 0n, bookYes = 0n, collateralYes = 0n): SoothCoreSnapshot {
  return {
    marketAddress: MARKET,
    truth: { isSettled: true, isFinalized: false, winningOutcome: 1 },
    launchpadAmm: {
      launchpad: { isGraduated: true },
      amm: { userYesShares: ammYes, userNoShares: 0n },
    },
    soothBook: { isFinalized: false, userYesBalance: bookYes, userNoBalance: 0n },
    collateralizer: { userYesBalance: collateralYes, userNoBalance: 0n },
  } as SoothCoreSnapshot;
}

describe('settled claims across independent engine custody', () => {
  it.each([
    [10n, 0n, 0n, 'amm_settle', [AMM]],
    [0n, 10n, 0n, 'order_settle', [ORDER]],
    [10n, 10n, 0n, 'mixed_settle', [ORDER, AMM]],
    [10n, 10n, 10n, 'mixed_settle', [ORDER, AMM]],
    [0n, 0n, 10n, 'order_settle', [ORDER]],
  ] as const)('plans balances AMM=%s book=%s order=%s', (amm, book, collateral, route, targets) => {
    const plan = buildClaimRequest(snapshot(amm, book, collateral), contracts)!;
    expect(plan.route).toBe(route);
    expect(plan.requests.map((request) => request.contract)).toEqual(targets);
    for (const request of plan.requests) {
      const data = encodeFunctionData({
        abi: getClaimAbiForRequest(request),
        functionName: request.functionName,
        args: request.args,
      });
      // Both pinned v0.4 engines pay msg.sender; the sole argument is the market address.
      expect(
        decodeFunctionData({
          abi: request.route === 'amm_settle' ? AMMEngineABI : OrderEngineABI,
          data,
        }),
      ).toEqual({ functionName: 'settlePosition', args: [MARKET] });
    }
  });

  it('preserves pre-graduation and finalized legacy AMM claims', () => {
    const state = snapshot(10n);
    state.launchpadAmm.launchpad.isGraduated = false;
    state.truth.isSettled = false;
    state.truth.isFinalized = true;
    expect(buildClaimRequest(state, contracts)?.route).toBe('amm_settle');
  });

  it('does not offer empty, unsettled, or losing-only claims', () => {
    expect(buildClaimRequest(snapshot(), contracts)).toBeNull();
    const state = snapshot(10n, 10n);
    state.truth.isSettled = false;
    expect(buildClaimRequest(state, contracts)).toBeNull();
    state.truth.isSettled = true;
    state.truth.winningOutcome = 0;
    expect(buildClaimRequest(state, contracts)).toBeNull();
  });

  it('claims NO winners and invalid refunds from both engines', () => {
    const state = snapshot();
    state.launchpadAmm.amm.userNoShares = 10n;
    state.soothBook!.userNoBalance = 20n;
    state.truth.winningOutcome = 0;
    expect(buildClaimRequest(state, contracts)?.route).toBe('mixed_settle');
    state.truth.winningOutcome = 2;
    expect(buildClaimRequest(state, contracts)?.requests).toHaveLength(2);
  });

  it('does not lose an AMM claim when no collateralizer or book snapshot exists', () => {
    const state = snapshot(10n);
    state.collateralizer = null;
    state.soothBook = null;
    expect(buildClaimRequest(state, contracts)?.route).toBe('amm_settle');
  });

  it('rejects missing custody addresses instead of emitting an unusable transaction', () => {
    expect(() =>
      buildClaimRequest(snapshot(0n, 10n), { ...contracts, orderEngine: undefined }),
    ).toThrow('orderEngine is not configured');
  });

  it('reads OrderEngine custody with deployed getters, including positions without a book', async () => {
    const readContract = vi.fn(async ({ address, functionName, args, abi }) => {
      encodeFunctionData({ abi, functionName, args });
      if (functionName === 'isSettled') {
        expect(address).toBe(MARKET);
        return true;
      }
      expect(address).toBe(ORDER);
      if (functionName === 'isMarketRegistered') return true;
      if (functionName === 'getCollateralBacking') return 1000n;
      if (functionName === 'getPosition') {
        expect(args).toEqual([MARKET, USER]);
        return [10n, 20n];
      }
      throw new Error(`Unexpected getter: ${functionName}`);
    });
    const custody = await readCollateralizerSnapshot(
      { readContract } as unknown as PublicClient,
      ORDER,
      MARKET,
      USER,
    );
    expect(custody).toMatchObject({
      isRegistered: true,
      isSettled: true,
      totalCollateral: 1000n,
      userYesBalance: 10n,
      userNoBalance: 20n,
    });
    const state = snapshot();
    state.soothBook = null;
    state.collateralizer = custody;
    expect(buildClaimRequest(state, contracts)?.route).toBe('order_settle');
  });
});

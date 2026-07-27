/**
 * Regression tests for the settlement/claim path (#20, S1/S2).
 *
 * The claim builder used to emit `redeem` (SoothBook) and `redeemOutcome`
 * (OrderEngine) — neither exists on the deployed v0.2.1 contracts, so encoding
 * threw / calls reverted. Redemption is now a single OrderEngine.settlePosition
 * (unified custody) or AMMEngine.settlePosition (LMSR). These tests encode each
 * claim route against the ABI the SDK resolves for it, and assert the resolved
 * ABIs actually expose the function (and no longer the removed ones).
 */

import { describe, it, expect } from 'vitest';
import { encodeFunctionData, type Abi, type AbiFunction } from 'viem';
import { getClaimAbiForRequest } from '../../src/core/contracts/soothCore';
import type { ClaimTxRequest } from '../../src/core/contracts/soothCore';

const MARKET = `0x${'bc'.repeat(20)}` as `0x${string}`;

const REQUESTS: ClaimTxRequest[] = [
  { route: 'order_settle', contract: MARKET, functionName: 'settlePosition', args: [MARKET] },
  { route: 'amm_settle', contract: MARKET, functionName: 'settlePosition', args: [MARKET] },
];

const fnNames = (abi: Abi) =>
  abi.filter((e): e is AbiFunction => e.type === 'function').map((e) => e.name);

describe('claim path — routes encode against the resolved ABI (#20)', () => {
  for (const req of REQUESTS) {
    it(`${req.route} → ${req.functionName} encodes cleanly`, () => {
      const abi = getClaimAbiForRequest(req);
      const data = encodeFunctionData({
        abi,
        functionName: req.functionName,
        args: req.args,
      } as never);
      expect(data.startsWith('0x')).toBe(true);
      expect(fnNames(abi)).toContain(req.functionName);
    });
  }

  it('order_settle resolves to an ABI with settlePosition and NOT the removed redeem/redeemOutcome (S1/S2)', () => {
    const abi = getClaimAbiForRequest({
      route: 'order_settle',
      contract: MARKET,
      functionName: 'settlePosition',
      args: [MARKET],
    });
    const names = fnNames(abi);
    expect(names).toContain('settlePosition');
    expect(names).not.toContain('redeem');
    expect(names).not.toContain('redeemOutcome');
  });

  it('getClaimAbiForRequest is exhaustive (returns an ABI for every route)', () => {
    for (const req of REQUESTS) {
      expect(getClaimAbiForRequest(req)).toBeDefined();
    }
  });
});

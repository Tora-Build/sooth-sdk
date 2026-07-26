import { describe, expect, it } from 'vitest';
import { encodeFunctionData } from 'viem';
import { ABIS, AMMEngineABI, ManualAdjudicatorABI } from '../../src/core/abis/index.js';

type AbiItem = {
  type: string;
  name?: string;
  inputs?: readonly { type: string }[];
};

const functionSignatures = (abi: readonly unknown[]) =>
  (abi as readonly AbiItem[])
    .filter((item) => item.type === 'function')
    .map((item) => `${item.name}(${(item.inputs ?? []).map((input) => input.type).join(',')})`)
    .sort();

const countByType = (abi: readonly unknown[], type: string) =>
  (abi as readonly AbiItem[]).filter((item) => item.type === type).length;

describe('AMMEngine ABI v0.2.1 deployed surface', () => {
  it('matches all 35 deployed function signatures', () => {
    expect(functionSignatures(AMMEngineABI)).toEqual([
      'baseToken()',
      'claimAdjudicatorFees(address)',
      'claimProtocolFees(address)',
      'claimUnlocked(uint256)',
      'feeRouter()',
      'getClaimableAmount(address)',
      'getLiquidity(address)',
      'getLockQueue(address)',
      'getMarketCollateral(address)',
      'getMarketLockedLiability(address)',
      'getMarketState(address)',
      'getPendingLocks(address)',
      'getPosition(address,address)',
      'getPositionQuote(address,uint8,int256)',
      'increaseLiquidity(address,uint256)',
      'increaseLiquidityFromCreator(address,uint256)',
      'initializeMarket(address,uint256,uint256,uint256,uint256)',
      'launchpadEngine()',
      'lockDuration()',
      'lpTokens(address)',
      'mintLPTokens(address,address,uint256)',
      'orderEngine()',
      'owner()',
      'postSettlementRoot(address,bytes32)',
      'protocolTreasury()',
      'recordOrderEngineFeeRevenue(address,uint256)',
      'redeemLP(address,uint256)',
      'renounceOwnership()',
      'setLPToken(address,address)',
      'setProtocolTreasury(address)',
      'settlePosition(address)',
      'settlePositionRetroactive(address,uint256,bytes32[])',
      'settlementRoots(address)',
      'tradePositions(address,uint8,int256,uint256)',
      'transferOwnership(address)',
    ]);
  });

  it('vendors the complete deployed constructor, event, and error surface', () => {
    expect(AMMEngineABI).toHaveLength(100);
    expect(countByType(AMMEngineABI, 'constructor')).toBe(1);
    expect(countByType(AMMEngineABI, 'event')).toBe(18);
    expect(countByType(AMMEngineABI, 'error')).toBe(46);
  });

  it('encodes the T-star settlement writes used by integrators', () => {
    const market = `0x${'11'.repeat(20)}` as const;
    const root = `0x${'22'.repeat(32)}` as const;

    expect(() =>
      encodeFunctionData({
        abi: AMMEngineABI,
        functionName: 'postSettlementRoot',
        args: [market, root],
      }),
    ).not.toThrow();

    expect(() =>
      encodeFunctionData({
        abi: AMMEngineABI,
        functionName: 'settlePositionRetroactive',
        args: [market, 1n, [root]],
      }),
    ).not.toThrow();
  });
});

describe('ManualAdjudicator ABI v0.2.1 deployed surface', () => {
  it('matches all 31 deployed function signatures', () => {
    expect(functionSignatures(ManualAdjudicatorABI)).toEqual([
      'OUTCOME_INVALID()',
      'OUTCOME_NO()',
      'OUTCOME_YES()',
      'PHASE_ACTIVE()',
      'PHASE_ATTESTED()',
      'PHASE_DISPUTED()',
      'PHASE_IDLE()',
      'PHASE_RESOLVED()',
      'PHASE_SETTLED()',
      'adjudicatorType()',
      'ammEngine()',
      'approveGuardian(address)',
      'attest(address,bytes)',
      'batchUpdateGuardians(address[],address[])',
      'canSettle(address)',
      'configureMarket(address,bytes)',
      'dispute(address)',
      'getMarketState(address)',
      'getOutcome(address)',
      'getPhase(address)',
      'isGuardian(address)',
      'launchpadEngine()',
      'owner()',
      'postSettlementRoot(address,bytes32)',
      'renounceOwnership()',
      'resolve(address,uint8,bytes32,uint64)',
      'revokeGuardian(address)',
      'settle(address)',
      'supportsTStar()',
      'transferOwnership(address)',
      'vetoPeriod()',
    ]);
  });

  it('vendors the complete deployed constructor, event, and error surface', () => {
    expect(ManualAdjudicatorABI).toHaveLength(53);
    expect(countByType(ManualAdjudicatorABI, 'constructor')).toBe(1);
    expect(countByType(ManualAdjudicatorABI, 'event')).toBe(8);
    expect(countByType(ManualAdjudicatorABI, 'error')).toBe(13);
    expect(ABIS.ManualAdjudicator).toBe(ManualAdjudicatorABI);
  });

  it('encodes the XAPP phase and outcome reads', () => {
    const market = `0x${'11'.repeat(20)}` as const;

    for (const functionName of ['getPhase', 'getOutcome'] as const) {
      expect(() =>
        encodeFunctionData({
          abi: ManualAdjudicatorABI,
          functionName,
          args: [market],
        }),
      ).not.toThrow();
    }
  });
});

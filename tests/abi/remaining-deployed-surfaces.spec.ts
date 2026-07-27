import { describe, expect, it } from 'vitest';
import { LaunchpadEngineABI, SoothBookABI, TruthMarketABI } from '../../src/core/abis/index.js';

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

describe('LaunchpadEngine ABI v0.2.1 deployed surface', () => {
  it('matches all 28 deployed function signatures', () => {
    expect(functionSignatures(LaunchpadEngineABI)).toEqual([
      'adjudicatorRegistry()',
      'allMarkets(uint256)',
      'ammEngine()',
      'baseToken()',
      'createMarket(string,uint64,uint64,address,uint256,uint256,bytes)',
      'creatorNonce(address)',
      'defaultTrialPeriod()',
      'feeRouter()',
      'getLPToken(address)',
      'getMarketCount()',
      'getMarkets()',
      'invalidationBuffer()',
      'isGraduated(address)',
      'isPaused()',
      'isTrialExpiredWithoutGraduation(address)',
      'markets(address)',
      'notifyGraduation(address)',
      'orderEngine()',
      'owner()',
      'pause()',
      'predictMarketAddress(address,address,string,uint256,uint64,uint64)',
      'renounceOwnership()',
      'setDefaultTrialPeriod(uint64)',
      'setInvalidationBuffer(uint64)',
      'transferOwnership(address)',
      'trialEndTimes(address)',
      'truthMarketImpl()',
      'unpause()',
    ]);
  });

  it('vendors the complete constructor, event, and error surface', () => {
    expect(LaunchpadEngineABI).toHaveLength(63);
    expect(countByType(LaunchpadEngineABI, 'constructor')).toBe(1);
    expect(countByType(LaunchpadEngineABI, 'event')).toBe(8);
    expect(countByType(LaunchpadEngineABI, 'error')).toBe(26);
  });
});

describe('SoothBook ABI v0.2.1 deployed surface', () => {
  it('matches all 25 deployed function signatures', () => {
    expect(functionSignatures(SoothBookABI)).toEqual([
      'buyNo(bytes32,uint16,uint128,bool,uint32)',
      'buyYes(bytes32,uint16,uint128,bool,uint32)',
      'cancel(bytes32,uint8,uint16)',
      'cancelById(uint64)',
      'feeRouter()',
      'getBalance(bytes32,address)',
      'getBestTick(bytes32,uint8)',
      'getCollateralBacking(bytes32)',
      'getImpliedPrice(address)',
      'getImpliedPriceByKey(bytes32)',
      'getMinRestingOrder(uint16)',
      'getOrdersAtTick(bytes32,uint8,uint16)',
      'getPosition(address,address)',
      'isMarketRegistered(address)',
      'marketAddresses(bytes32)',
      'marketKeys(address)',
      'merge(bytes32,uint256)',
      'mint(bytes32,uint256)',
      'orderEngine()',
      'owner()',
      'registerMarketFromEngine(address,address,uint256)',
      'registeredMarkets(bytes32)',
      'registrar()',
      'renounceOwnership()',
      'transferOwnership(address)',
    ]);
  });

  it('vendors the complete constructor, event, and error surface', () => {
    expect(SoothBookABI).toHaveLength(48);
    expect(countByType(SoothBookABI, 'constructor')).toBe(1);
    expect(countByType(SoothBookABI, 'event')).toBe(7);
    expect(countByType(SoothBookABI, 'error')).toBe(15);
  });
});

describe('TruthMarket ABI v0.2.1 deployed surface', () => {
  it('matches all 20 deployed function signatures', () => {
    expect(functionSignatures(TruthMarketABI)).toEqual([
      'adjudicator()',
      'attest()',
      'creator()',
      'deadline()',
      'getRedemptionValue(uint8)',
      'invalidate()',
      'invalidationBuffer()',
      'isAttested()',
      'isLive()',
      'isResolving()',
      'isSettled()',
      'launchpadEngine()',
      'questionHash()',
      'resolve(uint8,uint64)',
      'settle()',
      'startTime()',
      'state()',
      'tStar()',
      'veto()',
      'winningOutcome()',
    ]);
  });

  it('vendors the complete event and error surface', () => {
    expect(TruthMarketABI).toHaveLength(38);
    expect(countByType(TruthMarketABI, 'constructor')).toBe(0);
    expect(countByType(TruthMarketABI, 'event')).toBe(6);
    expect(countByType(TruthMarketABI, 'error')).toBe(12);
  });
});

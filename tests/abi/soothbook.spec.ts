import { describe, expect, it } from 'vitest';
import { toEventSelector, toFunctionSelector, type AbiEvent } from 'viem';
import { encodeFunctionData } from 'viem';
import { SoothBookABI } from '../../src/core/abis/SoothBook';

const marketKey = `0x${'00'.repeat(32)}` as const;

function functionAbi(name: string) {
  return SoothBookABI.find((item) => item.type === 'function' && item.name === name);
}

describe('SoothBook ABI v0.2.1 surface', () => {
  it('removes dead functions', () => {
    expect(functionAbi('resolveMarket')).toBeUndefined();
    expect(functionAbi('markets')).toBeUndefined();
    expect(functionAbi('redeem')).toBeUndefined();
  });

  it('contains v0.2.1 registration and price functions', () => {
    expect(functionAbi('registeredMarkets')).toMatchObject({
      inputs: [{ type: 'bytes32' }],
      outputs: [{ type: 'bool' }],
    });
    expect(functionAbi('isMarketRegistered')).toMatchObject({
      inputs: [{ type: 'address' }],
      outputs: [{ type: 'bool' }],
    });
    expect(functionAbi('getImpliedPriceByKey')).toMatchObject({
      inputs: [{ type: 'bytes32' }],
      outputs: [{ type: 'uint256' }, { type: 'uint256' }],
    });
    expect(functionAbi('getImpliedPrice')).toMatchObject({
      inputs: [{ type: 'address' }],
      outputs: [{ type: 'uint256' }, { type: 'uint256' }],
    });
  });

  it('encodes keyed implied-price reads and rejects removed resolve', () => {
    expect(() =>
      encodeFunctionData({
        abi: SoothBookABI,
        functionName: 'getImpliedPriceByKey',
        args: [marketKey],
      }),
    ).not.toThrow();

    expect(() =>
      encodeFunctionData({
        abi: SoothBookABI,
        functionName: 'resolveMarket',
        args: [marketKey, 1],
      } as never),
    ).toThrow();
  });
});

describe('SoothBook events + custom errors', () => {
  const event = (name: string) => SoothBookABI.find((i) => i.type === 'event' && i.name === name);
  const error = (name: string) => SoothBookABI.find((i) => i.type === 'error' && i.name === name);

  it('carries the v0.2.1 7-field OrderPlaced (verified on-chain in alpha PR #121)', () => {
    expect(toEventSelector(event('OrderPlaced') as AbiEvent)).toBe(
      toEventSelector(
        'event OrderPlaced(bytes32 indexed marketKey, uint8 side, uint16 tick, address indexed maker, uint128 amount, bool escrow, uint64 orderId)',
      ),
    );
  });

  it('carries the maker/taker fill and cancel events', () => {
    expect(toEventSelector(event('OrderFilled') as AbiEvent)).toBe(
      toEventSelector(
        'event OrderFilled(bytes32 indexed marketKey, uint8 takerSide, uint16 yesTick, uint16 noTick, address indexed taker, address indexed maker, uint128 amount, uint256 surplus, uint64 makerOrderId)',
      ),
    );
    expect(toEventSelector(event('OrderCancelled') as AbiEvent)).toBe(
      toEventSelector(
        'event OrderCancelled(bytes32 indexed marketKey, uint8 side, uint16 tick, address indexed maker, uint128 amount, uint64 orderId)',
      ),
    );
    for (const name of ['Minted', 'Merged', 'Redeemed', 'MarketResolved']) {
      expect(event(name), `missing event ${name}`).toBeDefined();
    }
  });

  it('carries the custom errors so viem can decode reverts (OrderNotActive = 0x1d4ecc5b)', () => {
    expect(toFunctionSelector('OrderNotActive()')).toBe('0x1d4ecc5b');
    for (const name of [
      'InvalidTick',
      'ZeroAmount',
      'MarketNotActive',
      'MarketAlreadyExists',
      'OrderNotActive',
      'ZeroAddress',
      'UnsupportedBaseTokenDecimals',
      'AmountTooSmallForBaseTokenDecimals',
      'InsufficientShares',
      'NotAuthorized',
    ]) {
      expect(error(name), `missing error ${name}`).toBeDefined();
    }
  });
});

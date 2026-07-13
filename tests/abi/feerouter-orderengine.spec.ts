import { describe, expect, it } from 'vitest';
import { toEventSelector, toFunctionSelector, type AbiEvent, type AbiError } from 'viem';
import { encodeFunctionData } from 'viem';
import { FeeRouterABI } from '../../src/core/abis/FeeRouter';
import { OrderEngineABI } from '../../src/core/abis/OrderEngine';

// Selector/topic pins computed from a fresh forge build of sooth-core at the
// commit alpha's contracts-core submodule records (5617de2, solc 0.8.33) and
// verified against the deployed v0.2.1 bytecode at the CREATE3 addresses
// (FeeRouter 0x7007c321…, OrderEngine 0x14941AA5…) on Ethereum Sepolia,
// 2026-07-13: every function selector and emitted event topic below appears
// in the on-chain code.

const fn = (abi: readonly unknown[], name: string) =>
  (abi as { type: string; name?: string }[]).find(
    (item) => item.type === 'function' && item.name === name,
  );
const event = (abi: readonly unknown[], name: string) =>
  (abi as { type: string; name?: string }[]).find(
    (item) => item.type === 'event' && item.name === name,
  ) as AbiEvent | undefined;
const error = (abi: readonly unknown[], name: string) =>
  (abi as { type: string; name?: string }[]).find(
    (item) => item.type === 'error' && item.name === name,
  ) as AbiError | undefined;
// Error selector = first 4 bytes of keccak("Name(types)") — the same
// construction as a function selector. toFunctionSelector must see a
// function-shaped item; feeding it the raw error object hashes the wrong
// signature string (verified against deployed bytecode).
const errorSelector = (abi: readonly unknown[], name: string) =>
  toFunctionSelector({ ...error(abi, name)!, type: 'function', outputs: [] } as never);

describe('FeeRouter ABI v0.2.1 surface', () => {
  it('pins the fee-read selectors the apps depend on', () => {
    expect(toFunctionSelector(fn(FeeRouterABI, 'getGraduationProgress') as never)).toBe(
      '0xb79f644b',
    );
    expect(toFunctionSelector(fn(FeeRouterABI, 'quoteFee') as never)).toBe('0x7a9753e5');
    expect(toFunctionSelector(fn(FeeRouterABI, 'preGradFeeBps') as never)).toBe('0xd8321a38');
    expect(toFunctionSelector(fn(FeeRouterABI, 'postGradFeeBps') as never)).toBe('0x57aefe3d');
  });

  it('carries the 4-way split share reads (50/30/10/10 post-grad)', () => {
    for (const name of [
      'bBaseShareBps',
      'lpYieldShareBps',
      'adjudicatorShareBps',
      'protocolShareBps',
    ]) {
      expect(fn(FeeRouterABI, name), name).toBeDefined();
    }
  });

  it('pins the indexer-critical event topics', () => {
    expect(toEventSelector(event(FeeRouterABI, 'FeeDistributedPostGrad')!)).toBe(
      '0x260b72d7b6d4633780609b51a3da512980f2e0375983dc16ead1653d6d487d90',
    );
    expect(toEventSelector(event(FeeRouterABI, 'FeeDistributedPreGrad')!)).toBe(
      '0x0d3ff035e4539340f89e78a2fcb43dfbd31a714b95c5244e3347ce3d9b019b11',
    );
    expect(toEventSelector(event(FeeRouterABI, 'GraduationTriggered')!)).toBe(
      '0xbb00277448ed2809994104443b72235926e562f752aa44d8655c5fef73f36969',
    );
  });

  it('keeps custom errors decodable', () => {
    expect(errorSelector(FeeRouterABI, 'FeeTooHigh')).toBe('0xcd4e6167');
    expect(errorSelector(FeeRouterABI, 'NotRegistered')).toBe('0xaba47339');
  });
});

describe('OrderEngine ABI v0.2.1 surface', () => {
  it('pins the custody read/write selectors the apps depend on', () => {
    expect(toFunctionSelector(fn(OrderEngineABI, 'getPosition') as never)).toBe('0xb33dc190');
    expect(toFunctionSelector(fn(OrderEngineABI, 'mint') as never)).toBe('0x40c10f19');
    expect(toFunctionSelector(fn(OrderEngineABI, 'merge') as never)).toBe('0x17a4cf49');
    expect(toFunctionSelector(fn(OrderEngineABI, 'settlePosition') as never)).toBe('0x36405257');
    expect(toFunctionSelector(fn(OrderEngineABI, 'getCollateralBacking') as never)).toBe(
      '0xe17c9bc0',
    );
  });

  it('carries the signed-order struct surface (hand-transcription bait)', () => {
    // Tuple components must be present and exact for this selector to match.
    expect(toFunctionSelector(fn(OrderEngineABI, 'matchSignedOrders') as never)).toBe('0x090f080a');
  });

  it('pins the indexer-critical event topics', () => {
    expect(toEventSelector(event(OrderEngineABI, 'FillRecorded')!)).toBe(
      '0xf8cc66560cd3d825ea663c82b26035081429766b3c040e51de86b397c3faaa3d',
    );
    expect(toEventSelector(event(OrderEngineABI, 'Minted')!)).toBe(
      '0x9d228d69b5fdb8d273a2336f8fb8612d039631024ea9bf09c424a9503aa078f0',
    );
    expect(toEventSelector(event(OrderEngineABI, 'PositionSettled')!)).toBe(
      '0xba70e8457921bdd49042182753cb6259c62f923e2b64216b68372cd85ec3af6c',
    );
  });

  it('keeps FillRecorded decodable with its three indexed topics', () => {
    const fill = event(OrderEngineABI, 'FillRecorded')!;
    expect(fill.inputs.filter((i) => i.indexed).map((i) => i.name)).toEqual([
      'market',
      'taker',
      'maker',
    ]);
  });

  it('keeps custom errors decodable', () => {
    expect(errorSelector(OrderEngineABI, 'NotOperator')).toBe('0x7c214f04');
    expect(errorSelector(OrderEngineABI, 'TicksDontCross')).toBe('0x75021be1');
    expect(errorSelector(OrderEngineABI, 'OrderOverfilled')).toBe('0xbe42226b');
  });

  it('encodes a getPosition read', () => {
    expect(() =>
      encodeFunctionData({
        abi: OrderEngineABI,
        functionName: 'getPosition',
        args: [`0x${'11'.repeat(20)}`, `0x${'22'.repeat(20)}`],
      }),
    ).not.toThrow();
  });
});

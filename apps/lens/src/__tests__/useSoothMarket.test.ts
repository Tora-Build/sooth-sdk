import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Address } from 'viem';

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  readContract: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
}));

vi.mock('../lib/soothAction', () => ({
  lensPublicClient: { readContract: mocks.readContract },
  SOOTH_POST_ACTION_ADDRESS: '0x7ADCc784b192Ea376820aAa28E358f156E458f84',
  SoothPostActionABI: [],
}));

import { useSoothMarket, type SoothMarketData } from '../hooks/useSoothMarket';

const MOCK_FEED: Address = '0x1234567890123456789012345678901234567890';
const MOCK_POST_ID = 42n;

function getQueryOptions() {
  return mocks.useQuery.mock.calls[0][0] as {
    queryKey: unknown[];
    queryFn: () => Promise<SoothMarketData>;
    enabled: boolean;
    staleTime: number;
    refetchInterval: number;
  };
}

describe('useSoothMarket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('constructs queryKey with feed and stringified postId', () => {
    useSoothMarket(MOCK_FEED, MOCK_POST_ID);
    const options = getQueryOptions();
    expect(options.queryKey).toEqual(['sooth-market', MOCK_FEED, '42']);
  });

  it('sets enabled=true when both feed and postId provided', () => {
    useSoothMarket(MOCK_FEED, MOCK_POST_ID);
    const options = getQueryOptions();
    expect(options.enabled).toBe(true);
  });

  it('sets enabled=false when feed is undefined', () => {
    useSoothMarket(undefined, MOCK_POST_ID);
    const options = getQueryOptions();
    expect(options.enabled).toBe(false);
  });

  it('sets enabled=false when postId is undefined', () => {
    useSoothMarket(MOCK_FEED, undefined);
    const options = getQueryOptions();
    expect(options.enabled).toBe(false);
  });

  it('queryFn parses market tuple and computes 0.5 probability for equal q values', async () => {
    useSoothMarket(MOCK_FEED, MOCK_POST_ID);
    const options = getQueryOptions();

    const b = 1000000000000000000n;
    mocks.readContract.mockResolvedValueOnce([
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      1700000000n,
      b,
      b, // qYes = b
      b, // qNo = b → equal → 0.5
      5000000000000000000n,
      0,
      false,
      false,
      100,
    ]);

    const result = await options.queryFn();
    expect(result).toMatchObject({
      resolver: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      deadline: 1700000000n,
      b,
      qYes: b,
      qNo: b,
      totalCollateral: 5000000000000000000n,
      winningOutcome: 0,
      resolved: false,
      paused: false,
      feeBps: 100,
    });
    expect(result.yesProbability).toBeCloseTo(0.5, 5);
  });

  it('queryFn computes probability > 0.5 when qYes > qNo', async () => {
    useSoothMarket(MOCK_FEED, MOCK_POST_ID);
    const options = getQueryOptions();

    const b = 1000000000000000000n;
    mocks.readContract.mockResolvedValueOnce([
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      1700000000n,
      b,
      2000000000000000000n, // qYes = 2e18
      1000000000000000000n, // qNo = 1e18
      5000000000000000000n,
      0,
      false,
      false,
      100,
    ]);

    const result = await options.queryFn();
    expect(result.yesProbability).toBeGreaterThan(0.5);
  });

  it('queryFn returns 0.5 probability when b = 0', async () => {
    useSoothMarket(MOCK_FEED, MOCK_POST_ID);
    const options = getQueryOptions();

    mocks.readContract.mockResolvedValueOnce([
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      1700000000n,
      0n, // b = 0 → fallback 0.5
      1000000000000000000n,
      500000000000000000n,
      5000000000000000000n,
      0,
      false,
      false,
      100,
    ]);

    const result = await options.queryFn();
    expect(result.yesProbability).toBe(0.5);
  });

  it('queryFn throws when feed is missing', async () => {
    useSoothMarket(undefined, MOCK_POST_ID);
    const options = getQueryOptions();
    await expect(options.queryFn()).rejects.toThrow('Missing feed or postId');
  });
});

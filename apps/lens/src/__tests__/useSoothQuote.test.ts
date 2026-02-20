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

import { useSoothQuote, type SoothQuoteData } from '../hooks/useSoothQuote';

const MOCK_FEED: Address = '0x1234567890123456789012345678901234567890';
const MOCK_POST_ID = 42n;

function getQueryOptions() {
  return mocks.useQuery.mock.calls[0][0] as {
    queryKey: unknown[];
    queryFn: () => Promise<SoothQuoteData>;
    enabled: boolean;
  };
}

describe('useSoothQuote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('constructs queryKey with action, outcome, and stringified shares', () => {
    useSoothQuote(MOCK_FEED, MOCK_POST_ID, 'buy', 1, 1000n);
    const options = getQueryOptions();
    expect(options.queryKey).toEqual([
      'sooth-quote',
      MOCK_FEED,
      '42',
      'buy',
      1,
      '1000',
    ]);
  });

  it('sets enabled=true when feed, postId, and shares > 0n', () => {
    useSoothQuote(MOCK_FEED, MOCK_POST_ID, 'buy', 1, 1000n);
    const options = getQueryOptions();
    expect(options.enabled).toBe(true);
  });

  it('sets enabled=false when shares = 0n', () => {
    useSoothQuote(MOCK_FEED, MOCK_POST_ID, 'buy', 1, 0n);
    const options = getQueryOptions();
    expect(options.enabled).toBe(false);
  });

  it('sets enabled=false when feed is undefined', () => {
    useSoothQuote(undefined, MOCK_POST_ID, 'buy', 1, 1000n);
    const options = getQueryOptions();
    expect(options.enabled).toBe(false);
  });

  it('buy queryFn calls quoteBuy and returns cost/fee/total', async () => {
    useSoothQuote(MOCK_FEED, MOCK_POST_ID, 'buy', 1, 1000n);
    const options = getQueryOptions();

    mocks.readContract.mockResolvedValueOnce([
      500000000000000000n,
      25000000000000000n,
      525000000000000000n,
    ]);

    const result = await options.queryFn();
    expect(result).toEqual({
      action: 'buy',
      cost: 500000000000000000n,
      fee: 25000000000000000n,
      total: 525000000000000000n,
    });

    expect(mocks.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'quoteBuy' }),
    );
  });

  it('sell queryFn calls quoteSell and returns proceeds/fee/total', async () => {
    useSoothQuote(MOCK_FEED, MOCK_POST_ID, 'sell', 0, 500n);
    const options = getQueryOptions();

    mocks.readContract.mockResolvedValueOnce([
      400000000000000000n,
      20000000000000000n,
      380000000000000000n,
    ]);

    const result = await options.queryFn();
    expect(result).toEqual({
      action: 'sell',
      proceeds: 400000000000000000n,
      fee: 20000000000000000n,
      total: 380000000000000000n,
    });

    expect(mocks.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'quoteSell' }),
    );
  });

  it('queryFn throws when feed is missing', async () => {
    useSoothQuote(undefined, MOCK_POST_ID, 'buy', 1, 1000n);
    const options = getQueryOptions();
    await expect(options.queryFn()).rejects.toThrow(
      'Missing feed/postId or invalid share amount',
    );
  });
});

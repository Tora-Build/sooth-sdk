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

import { useSoothPosition, type SoothPositionData } from '../hooks/useSoothPosition';

const MOCK_FEED: Address = '0x1234567890123456789012345678901234567890';
const MOCK_POST_ID = 42n;
const MOCK_USER: Address = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

function getQueryOptions() {
  return mocks.useQuery.mock.calls[0][0] as {
    queryKey: unknown[];
    queryFn: () => Promise<SoothPositionData>;
    enabled: boolean;
  };
}

describe('useSoothPosition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('constructs queryKey with feed, postId, and user', () => {
    useSoothPosition(MOCK_FEED, MOCK_POST_ID, MOCK_USER);
    const options = getQueryOptions();
    expect(options.queryKey).toEqual([
      'sooth-position',
      MOCK_FEED,
      '42',
      MOCK_USER,
    ]);
  });

  it('sets enabled=true when all params provided', () => {
    useSoothPosition(MOCK_FEED, MOCK_POST_ID, MOCK_USER);
    const options = getQueryOptions();
    expect(options.enabled).toBe(true);
  });

  it('sets enabled=false when user is undefined', () => {
    useSoothPosition(MOCK_FEED, MOCK_POST_ID, undefined);
    const options = getQueryOptions();
    expect(options.enabled).toBe(false);
  });

  it('sets enabled=false when feed is undefined', () => {
    useSoothPosition(undefined, MOCK_POST_ID, MOCK_USER);
    const options = getQueryOptions();
    expect(options.enabled).toBe(false);
  });

  it('queryFn returns yesShares and noShares', async () => {
    useSoothPosition(MOCK_FEED, MOCK_POST_ID, MOCK_USER);
    const options = getQueryOptions();

    mocks.readContract.mockResolvedValueOnce([
      5000000000000000000n,
      3000000000000000000n,
    ]);

    const result = await options.queryFn();
    expect(result).toEqual({
      yesShares: 5000000000000000000n,
      noShares: 3000000000000000000n,
    });
  });

  it('queryFn handles zero shares', async () => {
    useSoothPosition(MOCK_FEED, MOCK_POST_ID, MOCK_USER);
    const options = getQueryOptions();

    mocks.readContract.mockResolvedValueOnce([0n, 0n]);

    const result = await options.queryFn();
    expect(result).toEqual({ yesShares: 0n, noShares: 0n });
  });

  it('queryFn calls readContract with correct args', async () => {
    useSoothPosition(MOCK_FEED, MOCK_POST_ID, MOCK_USER);
    const options = getQueryOptions();

    mocks.readContract.mockResolvedValueOnce([0n, 0n]);
    await options.queryFn();

    expect(mocks.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'positions',
        args: [MOCK_FEED, MOCK_POST_ID, MOCK_USER],
      }),
    );
  });

  it('queryFn throws when params are missing', async () => {
    useSoothPosition(undefined, MOCK_POST_ID, MOCK_USER);
    const options = getQueryOptions();
    await expect(options.queryFn()).rejects.toThrow('Missing feed, postId, or user');
  });
});

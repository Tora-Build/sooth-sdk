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
  WGHO_ADDRESS: '0xeee5a340Cdc9c179Db25dea45AcfD5FE8d4d3eB8',
  ERC20_ABI: [],
  ACTION_HUB_ADDRESS: '0x4A92a97Ff3a3604410945ae8CA25df4fBB2fDC11',
}));

import { useWGHOBalance, type WGHOBalanceData } from '../hooks/useWGHOBalance';

const MOCK_USER: Address = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

function getQueryOptions() {
  return mocks.useQuery.mock.calls[0][0] as {
    queryKey: unknown[];
    queryFn: () => Promise<WGHOBalanceData>;
    enabled: boolean;
  };
}

describe('useWGHOBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('constructs queryKey with user and actionHub', () => {
    useWGHOBalance(MOCK_USER);
    const options = getQueryOptions();
    expect(options.queryKey).toEqual([
      'wgho-balance',
      MOCK_USER,
      '0x4A92a97Ff3a3604410945ae8CA25df4fBB2fDC11',
    ]);
  });

  it('sets enabled=true when user is provided', () => {
    useWGHOBalance(MOCK_USER);
    const options = getQueryOptions();
    expect(options.enabled).toBe(true);
  });

  it('sets enabled=false when user is undefined', () => {
    useWGHOBalance(undefined);
    const options = getQueryOptions();
    expect(options.enabled).toBe(false);
  });

  it('queryFn returns balance, allowance, and formatted balance', async () => {
    useWGHOBalance(MOCK_USER);
    const options = getQueryOptions();

    mocks.readContract
      .mockResolvedValueOnce(1500000000000000000n)
      .mockResolvedValueOnce(750000000000000000n);

    const result = await options.queryFn();
    expect(result).toEqual({
      balance: 1500000000000000000n,
      allowance: 750000000000000000n,
      balanceFormatted: '1.5',
    });
  });

  it('queryFn handles zero balance', async () => {
    useWGHOBalance(MOCK_USER);
    const options = getQueryOptions();

    mocks.readContract
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(0n);

    const result = await options.queryFn();
    expect(result).toEqual({
      balance: 0n,
      allowance: 0n,
      balanceFormatted: '0',
    });
  });

  it('queryFn calls readContract for both balanceOf and allowance', async () => {
    useWGHOBalance(MOCK_USER);
    const options = getQueryOptions();

    mocks.readContract
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(0n);

    await options.queryFn();

    expect(mocks.readContract).toHaveBeenCalledTimes(2);
    expect(mocks.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'balanceOf' }),
    );
    expect(mocks.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'allowance' }),
    );
  });

  it('queryFn throws when user is missing', async () => {
    useWGHOBalance(undefined);
    const options = getQueryOptions();
    await expect(options.queryFn()).rejects.toThrow('Missing user address');
  });
});

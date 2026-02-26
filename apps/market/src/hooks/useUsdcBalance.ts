import { useAccount, useReadContract } from 'wagmi';
import { type Address } from 'viem';
import { ERC20_ABI } from '../config/abis';
import { getDeployment, getInstanceBySoothBook } from '../config/deployments';
import { DEFAULT_CHAIN_ID } from '../config/chains';

export function useUsdcBalance(instanceSoothBook?: string) {
  const { address } = useAccount();
  const instance = instanceSoothBook ? getInstanceBySoothBook(instanceSoothBook) : undefined;
  const fallbackDeployment = getDeployment(DEFAULT_CHAIN_ID);
  const usdcAddress = (instance?.usdc ?? fallbackDeployment?.MockUSDC) as
    | Address
    | undefined;
  const soothBookAddress = (instanceSoothBook ?? fallbackDeployment?.SoothBook) as
    | Address
    | undefined;

  const { data: decimalsRaw } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: !!usdcAddress },
  });
  const decimals = decimalsRaw != null ? Number(decimalsRaw) : 18;

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!usdcAddress, refetchInterval: 10_000 },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && soothBookAddress ? [address, soothBookAddress] : undefined,
    query: { enabled: !!address && !!usdcAddress && !!soothBookAddress },
  });

  const divisor = 10 ** decimals;

  return {
    balance: balance as bigint | undefined,
    allowance: allowance as bigint | undefined,
    formatted: balance ? (Number(balance) / divisor).toFixed(2) : '0.00',
    decimals,
    refetch: () => {
      refetchBalance();
      refetchAllowance();
    },
  };
}

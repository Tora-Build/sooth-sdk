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

  return {
    balance: balance as bigint | undefined,
    allowance: allowance as bigint | undefined,
    formatted: balance ? (Number(balance) / 1e6).toFixed(2) : '0.00',
    refetch: () => {
      refetchBalance();
      refetchAllowance();
    },
  };
}

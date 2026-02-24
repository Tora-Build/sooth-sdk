import { useAccount, useReadContract } from 'wagmi';
import { type Address } from 'viem';
import { ERC20_ABI } from '../config/abis';
import { getDeployment } from '../config/deployments';

export function useUsdcBalance() {
  const { address } = useAccount();
  const usdcAddress = getDeployment(84532)?.MockUSDC as Address | undefined;
  const soothBookAddress = getDeployment(84532)?.SoothBook as Address | undefined;

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

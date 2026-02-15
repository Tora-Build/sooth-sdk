import { useCallback, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";
import { useTokenBalances } from "./useTokenBalances";
import { useDeployments } from "./useDeployments";

export function useTraderVault() {
  const { address } = useAccount();
  const { contracts } = useDeployments();
  const [isPending, setIsPending] = useState(false);

  const tokenAddress = contracts.MockUSDC as `0x${string}` | undefined;
  const { balances } = useTokenBalances(useMemo(() => (tokenAddress ? [tokenAddress] : []), [tokenAddress]));

  const userUsdcBalance = balances[0] ?? 0n;
  const availableBalance = 0n;
  const reservedBalance = 0n;
  const totalBalance = 0n;
  const allowance = 0n;
  const decimals = 6;

  const unsupported = useCallback(async (action: string) => {
    setIsPending(true);
    toast.error(`${action} is disabled in the SoothBook-only frontend.`);
    setIsPending(false);
  }, []);

  return {
    deposit: async (_amount: string | bigint) => unsupported("Deposit"),
    withdraw: async (_amount: string | bigint) => unsupported("Withdraw"),
    claimWinnings: async (_marketAddress: string) => unsupported("Claim"),
    approveUSDC: async (_amount: string) => {
      await unsupported("Approve");
      return false;
    },
    availableBalance,
    reservedBalance,
    totalBalance,
    userUsdcBalance,
    allowance,
    isPending,
    isLoading: !address,
    refetch: async () => undefined,
    decimals,
    vaultAddress: undefined as unknown as `0x${string}`,
  };
}

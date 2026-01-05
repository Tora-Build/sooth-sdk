import { useChainStore } from "../store/useChainStore";
import { useDeployments } from "./useDeployments";
import { ABIS } from "../config/abis";
import { useDirectRead, readContractSafe } from "./useDirectRead";

type Address = `0x${string}`;

export interface VaultBalance {
  // USDC balances (WAD)
  availableUsdcWad: bigint;
  reservedUsdcWad: bigint;
  totalUsdcWad: bigint;

  // Internal outcome shares for a specific market
  yesInternal: bigint;
  noInternal: bigint;

  // Computed helpers
  availableUsdcFormatted: string;
  reservedUsdcFormatted: string;
}

/**
 * Hook to read TickBookVault balances (V9 Singleton Architecture)
 *
 * The vault holds:
 * - USDC: Available (can place orders) + Reserved (locked in orders)
 * - Internal outcome shares per market
 */
export function useTickBookVault(
  userAddress: Address | undefined,
  marketAddress?: Address
) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const vaultAddress = deployments?.contracts?.TickBookVault as Address | undefined;

  const query = useDirectRead({
    queryKey: ["v9", "tickBookVault", chainId, vaultAddress, userAddress, marketAddress],
    enabled: !!chainId && !!vaultAddress && !!userAddress,
    chainId,
    read: async (client) => {
      // Read USDC balances
      const [availableWad, reservedWad] = await Promise.all([
        readContractSafe<bigint>(client, {
          address: vaultAddress!,
          abi: ABIS.TickBookVault,
          functionName: "availableUsdcWad",
          args: [userAddress!],
        }),
        readContractSafe<bigint>(client, {
          address: vaultAddress!,
          abi: ABIS.TickBookVault,
          functionName: "reservedUsdcWad",
          args: [userAddress!],
        }),
      ]);

      // Read internal outcomes if market provided
      let yesInternal = 0n;
      let noInternal = 0n;

      if (marketAddress) {
        try {
          const outcomes = await readContractSafe<readonly [bigint, bigint]>(client, {
            address: vaultAddress!,
            abi: ABIS.TickBookVault,
            functionName: "getInternalOutcomes",
            args: [marketAddress, userAddress!],
          });
          yesInternal = outcomes[0];
          noInternal = outcomes[1];
        } catch {
          // Market may not have internal outcomes yet
        }
      }

      const totalWad = availableWad + reservedWad;

      // Format for display
      const formatWad = (wad: bigint): string => {
        const num = Number(wad) / 1e18;
        return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      return {
        availableUsdcWad: availableWad,
        reservedUsdcWad: reservedWad,
        totalUsdcWad: totalWad,
        yesInternal,
        noInternal,
        availableUsdcFormatted: `$${formatWad(availableWad)}`,
        reservedUsdcFormatted: `$${formatWad(reservedWad)}`,
      } as VaultBalance;
    },
  });

  return {
    vault: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

import { keccak256, encodeAbiParameters, parseAbiParameters, getAddress, type Address } from "viem";
import { useChainStore } from "../../../store/useChainStore";
import { useDeployments } from "../../useDeployments";
import { V9_ABIS } from "../../../config/abis";
import { useV8DirectRead, readContractSafe } from "./useV8DirectRead";

/**
 * Hook to read TickBook state for the Pro page (V9 Singleton Architecture)
 * Handles Singleton TickBookPoolManager mapping and tick discovery.
 */
export function useTickBookDirect(
  marketAddress: Address | undefined,
  yesTokenInput?: Address,
  noTokenInput?: Address,
  hookAddress?: Address
) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const poolManagerAddress = deployments?.contracts?.TickBookPoolManager as Address | undefined;
  const collateralizerAddress = deployments?.contracts?.Collateralizer as Address | undefined;

  const query = useV8DirectRead({
    queryKey: ["v9", "tickBookDirect", chainId, poolManagerAddress, marketAddress, yesTokenInput, noTokenInput],
    enabled: !!marketAddress && !!chainId && !!poolManagerAddress && !!collateralizerAddress,
    chainId,
    read: async (client) => {
      try {
        console.log(`[useTickBookDirect] Initializing for ${marketAddress}`);
        let yesToken = yesTokenInput;
        let noToken = noTokenInput;
        const isZero = (addr: string | undefined) => !addr || addr === "0x0000000000000000000000000000000000000000" || addr === "0x0";

        // 1. Resolve Tokens if not provided
        if (isZero(yesToken) || isZero(noToken)) {
          console.log(`[useTickBookDirect] Fetching tokens from Collateralizer at ${collateralizerAddress}`);
          const tokens = await readContractSafe<readonly [Address, Address]>(client, {
            address: collateralizerAddress!,
            abi: V9_ABIS.Collateralizer,
            functionName: "getOutcomeTokens",
            args: [marketAddress!],
          });
          yesToken = tokens[0];
          noToken = tokens[1];
          console.log(`[useTickBookDirect] Tokens found: YES=${yesToken}, NO=${noToken}`);
        }

        // 2. Format Addresses Robustly
        const robustAddress = (addr: string | undefined): Address => {
          if (!addr || isZero(addr)) return "0x0000000000000000000000000000000000000000";
          // Ensure it is 40 hex chars (+0x)
          let standard = addr.toLowerCase();
          if (standard.length > 42) standard = `0x${standard.slice(-40)}`;
          if (standard.length < 42 && standard.startsWith("0x")) {
            // Pad if misses leading zero
            standard = `0x${standard.slice(2).padStart(40, "0")}`;
          }
          try {
            return getAddress(standard);
          } catch (e) {
            console.error(`[useTickBookDirect] Failed to checksum address: ${addr} (normalized: ${standard})`, e);
            return standard as Address;
          }
        };

        const effectiveHook = (hookAddress || "0x0000000000000000000000000000000000000000") as Address;

        // 3. Calculate Market Key
        const marketKey = keccak256(encodeAbiParameters(
          parseAbiParameters("address, address, address, address"),
          [
            robustAddress(marketAddress),
            robustAddress(yesToken),
            robustAddress(noToken),
            robustAddress(effectiveHook)
          ]
        ));

        console.log(`[useTickBookDirect] Market key: ${marketKey}`);

        // 4. Fetch State and Info
        const [marketState, marketInfo] = await Promise.all([
          readContractSafe<readonly [number, bigint, bigint, bigint]>(client, {
            address: poolManagerAddress!,
            abi: V9_ABIS.TickBookPoolManager,
            functionName: "getMarketState",
            args: [marketKey],
          }),
          readContractSafe<readonly [Address, Address, Address, Address, boolean]>(client, {
            address: poolManagerAddress!,
            abi: V9_ABIS.TickBookPoolManager,
            functionName: "getMarketInfo",
            args: [marketKey],
          }),
        ]);

        const [tickIndex, activeLiqNo, activeLiqYes, probabilityWad] = marketState;
        const [truthMarket, yesTokenAddr, noTokenAddr, hookAddr, isActive] = marketInfo;

        if (!isActive) {
          console.warn(`[useTickBookDirect] Market ${marketKey} is NOT active in PoolManager`);
          return {
            marketKey,
            currentTick: 500,
            probability: 0.5,
            isActive: false,
            truthMarket,
            yesToken: yesTokenAddr,
            noToken: noTokenAddr,
            hook: hookAddr,
            bids: [],
            asks: [],
          };
        }

        // 5. Return basic market state (Orderbook depth requires Ponder in V9)
        console.log(`[useTickBookDirect] Success! Probability: ${Number(probabilityWad) / 10 ** 18}`);

        return {
          marketKey,
          currentTick: tickIndex,
          probability: Number(probabilityWad) / 10 ** 18,
          isActive,
          truthMarket,
          yesToken: yesTokenAddr,
          noToken: noTokenAddr,
          hook: hookAddr,
          activeLiquidityNo: activeLiqNo,
          activeLiquidityYes: activeLiqYes,
          bids: [],
          asks: [],
        };
      } catch (err) {
        console.error(`[useTickBookDirect] CRITICAL FAILURE for ${marketAddress}:`, err);
        return {
          marketKey: "0x0" as `0x${string}`,
          currentTick: 500,
          probability: 0.5,
          isActive: false,
          truthMarket: "0x0000000000000000000000000000000000000000",
          yesToken: "0x0000000000000000000000000000000000000000",
          noToken: "0x0000000000000000000000000000000000000000",
          hook: "0x0000000000000000000000000000000000000000",
          bids: [],
          asks: [],
        };
      }
    },
  });

  return {
    tickBook: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

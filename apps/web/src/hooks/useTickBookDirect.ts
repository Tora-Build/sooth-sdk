import { keccak256, encodeAbiParameters, parseAbiParameters, getAddress, type Address } from "viem";
import { useChainStore } from "../store/useChainStore";
import { useDeployments } from "./useDeployments";
import { V9_ABIS, V10_ABIS } from "../config/abis";
import { useDirectRead, readContractSafe } from "./useDirectRead";

/**
 * Hook to read TickBook state for the Pro page (V9 Singleton Architecture)
 * Handles Singleton TickBookPoolManager mapping and tick discovery.
 */
export function useTickBookDirect(
  marketAddress: Address | undefined,
  yesTokenInput?: Address,
  noTokenInput?: Address,
  options?: {
    staleTime?: number;
    refetchInterval?: number;
  }
) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const poolManagerAddress = deployments?.contracts?.TickBookPoolManager as Address | undefined;
  const collateralizerAddress = deployments?.contracts?.Collateralizer as Address | undefined;

  const query = useDirectRead({
    queryKey: ["v9", "tickBookDirect", chainId, poolManagerAddress, marketAddress, yesTokenInput, noTokenInput],
    enabled: !!marketAddress && !!chainId && !!poolManagerAddress && !!collateralizerAddress,
    chainId,
    staleTime: options?.staleTime ?? 10_000, // Default 10s for TickBook data
    refetchInterval: options?.refetchInterval ?? 20_000, // Default 20s
    read: async (client) => {
      try {
        console.log(`[useTickBookDirect] Initializing for ${marketAddress}`);

        // Determine ABI based on chain
        const poolManagerAbi = V10_ABIS.TickBookPoolManager;

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
          let standard = addr.toLowerCase();
          if (standard.length > 42) standard = `0x${standard.slice(-40)}`;
          if (standard.length < 42 && standard.startsWith("0x")) {
            standard = `0x${standard.slice(2).padStart(40, "0")}`;
          }
          try {
            return getAddress(standard);
          } catch (e) {
            console.error(`[useTickBookDirect] Failed to checksum address: ${addr} (normalized: ${standard})`, e);
            return standard as Address;
          }
        };

        // 3. Calculate Market Key
        const marketKey = keccak256(encodeAbiParameters(
          parseAbiParameters("address, address, address"),
          [
            robustAddress(marketAddress),
            robustAddress(yesToken),
            robustAddress(noToken)
          ]
        ));

        console.log(`[useTickBookDirect] Market key: ${marketKey}`);

        // 4. Fetch State and Info
        const [marketState, marketInfo] = await Promise.all([
          readContractSafe<readonly [number, bigint, bigint, bigint]>(client, {
            address: poolManagerAddress!,
            abi: poolManagerAbi,
            functionName: "getMarketState",
            args: [marketKey],
          }),
          readContractSafe<readonly [Address, Address, Address, boolean]>(client, {
            address: poolManagerAddress!,
            abi: poolManagerAbi,
            functionName: "getMarketInfo",
            args: [marketKey],
          }),
        ]);

        const [tickIndex, activeLiqNo, activeLiqYes, probabilityWad] = marketState;
        const [truthMarket, yesTokenAddr, noTokenAddr, isActive] = marketInfo;

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
            hook: undefined,
            bids: [],
            asks: [],
          };
        }

        // 5. Sample liquidity across full tick range for depth chart
        // V10: Ticks range 1-999, sample every 20 ticks for efficiency (50 samples total)
        const sampleTicks = async (outcome: number) => {
          const ticks: Array<{ tick: number; liquidity: bigint }> = [];
          const step = 20; 

          const ticksToSample = [];
          for (let tick = step; tick <= 990; tick += step) {
            ticksToSample.push(tick);
          }

          // Sample in parallel batches of 10 to avoid rate limits
          const batchSize = 10;
          for (let i = 0; i < ticksToSample.length; i += batchSize) {
            const batch = ticksToSample.slice(i, i + batchSize);
            const results = await Promise.all(
              batch.map(async (tick) => {
                try {
                  const liq = await readContractSafe<bigint>(client, {
                    address: poolManagerAddress!,
                    abi: poolManagerAbi,
                    functionName: "getLiquidityAtTick",
                    args: [marketKey, outcome, tick],
                  });
                  return { tick, liquidity: liq };
                } catch {
                  return { tick, liquidity: 0n };
                }
              })
            );
            for (const r of results) {
              if (r.liquidity > 0n) {
                ticks.push(r);
              }
            }
          }
          return ticks;
        };

        const [yesLiquidity, noLiquidity] = await Promise.all([
          sampleTicks(1), // YES
          sampleTicks(0), // NO
        ]);

        console.log(`[useTickBookDirect] Success! Probability: ${Number(probabilityWad) / 10 ** 18}`);

        return {
          marketKey,
          currentTick: tickIndex,
          probability: Number(probabilityWad) / 10 ** 18,
          isActive,
          truthMarket,
          yesToken: yesTokenAddr,
          noToken: noTokenAddr,
          hook: undefined,
          activeLiquidityNo: activeLiqNo,
          activeLiquidityYes: activeLiqYes,
          bids: yesLiquidity,
          asks: noLiquidity,
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

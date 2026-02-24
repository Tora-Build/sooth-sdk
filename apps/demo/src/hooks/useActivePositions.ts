import { useAccount, useChainId } from "wagmi";
import { formatUnits, encodePacked, keccak256 } from "viem";
import { ERC20_ABI, LAUNCHPAD_MARKET_ABI, LAUNCHPAD_OUTCOME_TOKEN_ABI, SOOTHBOOK_ABI } from "../config/abis";
import { useLaunchpadMarkets } from "./useLaunchpadMarkets";
import { useMemo } from "react";
import { getPollingInterval } from "../lib/polling";
import { useDirectRead, readContractSafe } from "./useDirectRead";
import { useDeployments } from "./useDeployments";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export interface ActivePosition {
  id: string;
  question: string;
  marketAddress: `0x${string}`;
  outcomeTokenAddress?: `0x${string}`;
  liquidYes: number;
  liquidNo: number;
  lockedYes: number;
  lockedNo: number;
  walletYes: number;
  walletNo: number;
  unlockTime: number;
  value: number;
  priceYes: number;
  isSettled: boolean;
  winningOutcome: number | null;
}

export const useActivePositions = () => {
  const { address } = useAccount();
  const chainId = useChainId();
  const { markets: launchpadMarkets } = useLaunchpadMarkets();
  const { contracts } = useDeployments();
  const soothBookAddress = contracts.SoothBook as `0x${string}` | undefined;

  const uniqueMarkets = useMemo(() => {
    const list: { address: `0x${string}`; name: string; outcomeToken?: `0x${string}`; isGraduated: boolean }[] = [];
    const seen = new Set<string>();

    if (launchpadMarkets) {
      launchpadMarkets.forEach((market) => {
        if (market.address && !seen.has(market.address.toLowerCase())) {
          seen.add(market.address.toLowerCase());
          list.push({
            address: market.address,
            name: market.name,
            outcomeToken: market.outcomeToken,
            isGraduated: Boolean(market.isGraduated),
          });
        }
      });
    }

    return list;
  }, [launchpadMarkets]);

  const marketScope = useMemo(
    () => uniqueMarkets.map((m) => `${m.address}:${m.outcomeToken ?? ""}:${m.isGraduated ? 1 : 0}`),
    [uniqueMarkets]
  );

  const positionsQuery = useDirectRead<ActivePosition[]>({
    queryKey: ["v12", "activePositions", chainId, address, soothBookAddress, marketScope],
    enabled: !!address && uniqueMarkets.length > 0,
    chainId,
    refetchInterval: getPollingInterval(chainId, "slow"),
    staleTime: 10_000,
    read: async (client) => {
      if (!address) return [];

      const positions = await Promise.all(
        uniqueMarkets.map(async (market): Promise<ActivePosition | null> => {
          const isSettled = await readContractSafe<boolean>(client, {
            address: market.address,
            abi: LAUNCHPAD_MARKET_ABI,
            functionName: "isSettled",
          }).catch(() => false);

          let winningOutcome: number | null = null;
          if (isSettled) {
            const rawOutcome = await readContractSafe<number | bigint>(client, {
              address: market.address,
              abi: LAUNCHPAD_MARKET_ABI,
              functionName: "winningOutcome",
            }).catch(() => null);
            if (rawOutcome !== null && rawOutcome !== undefined) {
              winningOutcome = Number(rawOutcome);
            }
          }

          let walletYesRaw = 0n;
          let walletNoRaw = 0n;
          let priceYes = 0.5;

          if (market.isGraduated && soothBookAddress) {
            const marketKey = keccak256(encodePacked(["address"], [market.address]));

            const marketTuple = await readContractSafe<
              readonly [`0x${string}`, `0x${string}`, `0x${string}`, boolean, boolean, number]
            >(client, {
              address: soothBookAddress,
              abi: SOOTHBOOK_ABI,
              functionName: "markets",
              args: [marketKey],
            }).catch(() => null);

            if (marketTuple) {
              const yesToken = marketTuple[1];
              const noToken = marketTuple[2];

              if (yesToken !== ZERO_ADDRESS) {
                walletYesRaw = await readContractSafe<bigint>(client, {
                  address: yesToken,
                  abi: ERC20_ABI,
                  functionName: "balanceOf",
                  args: [address],
                }).catch(() => 0n);
              }

              if (noToken !== ZERO_ADDRESS) {
                walletNoRaw = await readContractSafe<bigint>(client, {
                  address: noToken,
                  abi: ERC20_ABI,
                  functionName: "balanceOf",
                  args: [address],
                }).catch(() => 0n);
              }
            }

            const implied = await readContractSafe<readonly [bigint, bigint]>(client, {
              address: soothBookAddress,
              abi: SOOTHBOOK_ABI,
              functionName: "getImpliedPrice",
              args: [marketKey],
            }).catch(() => null);

            if (implied?.[0] !== undefined) {
              priceYes = Number(formatUnits(implied[0], 18));
            }
          } else {
            if (market.outcomeToken && market.outcomeToken !== ZERO_ADDRESS) {
              const [yesBalance, noBalance] = await Promise.all([
                readContractSafe<bigint>(client, {
                  address: market.outcomeToken,
                  abi: LAUNCHPAD_OUTCOME_TOKEN_ABI,
                  functionName: "balanceOf",
                  args: [address, 0n],
                }).catch(() => 0n),
                readContractSafe<bigint>(client, {
                  address: market.outcomeToken,
                  abi: LAUNCHPAD_OUTCOME_TOKEN_ABI,
                  functionName: "balanceOf",
                  args: [address, 1n],
                }).catch(() => 0n),
              ]);

              walletYesRaw = yesBalance;
              walletNoRaw = noBalance;
            }

            const ammPrice = await readContractSafe<bigint>(client, {
              address: market.address,
              abi: LAUNCHPAD_MARKET_ABI,
              functionName: "price",
              args: [0],
            }).catch(() => null);

            if (ammPrice !== null) {
              priceYes = Number(formatUnits(ammPrice, 18));
            }
          }

          const walletYes = Number(formatUnits(walletYesRaw, 18));
          const walletNo = Number(formatUnits(walletNoRaw, 18));
          const totalYes = walletYes;
          const totalNo = walletNo;

          if (totalYes <= 0.001 && totalNo <= 0.001) {
            return null;
          }

          const priceNo = 1 - priceYes;
          const value = totalYes * priceYes + totalNo * priceNo;

          return {
            id: market.address,
            question: market.name,
            marketAddress: market.address,
            outcomeTokenAddress: market.outcomeToken,
            liquidYes: 0,
            liquidNo: 0,
            lockedYes: 0,
            lockedNo: 0,
            walletYes,
            walletNo,
            unlockTime: 0,
            value,
            priceYes,
            isSettled,
            winningOutcome,
          };
        })
      );

      return positions.filter((position): position is ActivePosition => position !== null);
    },
  });

  return useMemo(() => {
    const vaultPositions = positionsQuery.data ?? [];
    const vaultValue = vaultPositions.reduce((sum, position) => sum + position.value, 0);

    return {
      vaultPositions,
      vaultValue,
      totalPositionValue: vaultValue,
      refetch: positionsQuery.refetch,
      isLoading: positionsQuery.isLoading,
    };
  }, [positionsQuery.data, positionsQuery.refetch, positionsQuery.isLoading]);
};

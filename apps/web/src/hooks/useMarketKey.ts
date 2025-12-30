import { useMemo } from "react";
import { keccak256, encodePacked } from "viem";
import { useDeployments } from "./useDeployments";

type Address = `0x${string}`;

/**
 * Compute V9 market key from pool key components
 * marketKey = keccak256(abi.encodePacked(truthMarket, yesToken, noToken, hook))
 */
export function computeMarketKey(
  truthMarket: Address,
  yesToken: Address,
  noToken: Address,
  hook: Address
): `0x${string}` {
  return keccak256(
    encodePacked(
      ["address", "address", "address", "address"],
      [truthMarket, yesToken, noToken, hook]
    )
  );
}

/**
 * Hook to compute and cache the V9 market key
 */
export function useMarketKey(
  truthMarket: Address | undefined,
  yesToken: Address | undefined,
  noToken: Address | undefined,
  hookAddress?: Address
) {
  const deployments = useDeployments();

  // Default to DynamicFeeHook if not provided
  const effectiveHook = hookAddress
    || (deployments?.contracts?.DynamicFeeHook as Address)
    || ("0x0000000000000000000000000000000000000000" as Address);

  const marketKey = useMemo(() => {
    if (!truthMarket || !yesToken || !noToken) return undefined;
    return computeMarketKey(truthMarket, yesToken, noToken, effectiveHook);
  }, [truthMarket, yesToken, noToken, effectiveHook]);

  return { marketKey, hook: effectiveHook };
}

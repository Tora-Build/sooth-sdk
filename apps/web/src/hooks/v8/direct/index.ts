/**
 * V8 Direct Hooks
 * 
 * These hooks use publicClient.readContract + React Query instead of wagmi's
 * useReadContracts (multicall). They are more reliable when RPC providers
 * have issues with batched calls.
 */

export { useV8DirectRead, readContractSafe } from "./useV8DirectRead";
export { useTruthMarketDirect } from "./useTruthMarketDirect";
export { useLaunchpadMarketDirect } from "./useLaunchpadMarketDirect";
export { useLaunchpadPositionDirect } from "./useLaunchpadPositionDirect";
export { useAmmMarketDirect } from "./useAmmMarketDirect";
export { useAMMPositionDirect } from "./useAMMPositionDirect";
export { useCollateralizerDirect } from "./useCollateralizerDirect";
export { useAMMQuoteDirect } from "./useAMMQuoteDirect";
export { useTickBookDirect } from "./useTickBookDirect";
export { useTickBookVaultDirect } from "./useTickBookVaultDirect";
export { useUserOrdersDirect } from "./useUserOrdersDirect";
export type { RangeOrder } from "./useUserOrdersDirect";

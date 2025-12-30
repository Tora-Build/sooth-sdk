/**
 * V9 Hooks - Singleton TickBookPoolManager Architecture
 *
 * V9 introduces a singleton TickBookPoolManager that manages all markets,
 * replacing the per-market TickBook model from V8.
 */

export { useTickBookPoolManager, type TickBookMarketState } from "./useTickBookPoolManager";
export { useTickBookVaultV9, type VaultBalance } from "./useTickBookVaultV9";
export { useDynamicFee, type DynamicFeeInfo } from "./useDynamicFee";
export { usePendingFills, type PendingFill } from "./usePendingFills";
export { useMarketKey, computeMarketKey } from "./useMarketKey";

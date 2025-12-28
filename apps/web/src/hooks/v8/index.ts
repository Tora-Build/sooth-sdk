/**
 * V8 Hooks - Index
 * 
 * All hooks for interacting with V8 contracts
 */

// Core hooks (useReadContracts-based)
export { useTruthMarket } from "./useTruthMarket";
export type { TruthMarketData } from "./useTruthMarket";

export { useLaunchpadMarket } from "./useLaunchpadMarket";
export type { LaunchpadMarketData } from "./useLaunchpadMarket";

export { useAmmMarket, useAmmTradeCost } from "./useAmmMarket";
export type { AmmMarketData, AmmTradeCostData } from "./useAmmMarket";

export { useCollateralizer, useOutcomeToken } from "./useCollateralizer";
export type { CollateralizerData, OutcomeTokenData } from "./useCollateralizer";

export { useCreatorPosition, useIsCreator } from "./useCreatorPosition";
export type { CreatorPositionData } from "./useCreatorPosition";

// Spendable Proceeds hooks (V8.1)
export { useAvailableBalance } from "./useAvailableBalance";
export type { AvailableBalanceData } from "./useAvailableBalance";
export { useLockQueue } from "./useLockQueue";
export type { LockQueueData, LockEntry } from "./useLockQueue";
export { useClaimableAmount } from "./useClaimableAmount";
export type { ClaimableAmountData } from "./useClaimableAmount";
export { useClaimUnlocked } from "./useClaimUnlocked";
export type { ClaimUnlockedData } from "./useClaimUnlocked";
export { useTokenBalances } from "./useTokenBalances";

// Direct hooks (publicClient.readContract + React Query)
// More reliable when RPC providers have multicall issues
export {
    useV8DirectRead,
    readContractSafe,
    useTruthMarketDirect,
    useLaunchpadMarketDirect,
    useAmmMarketDirect,
    useAMMPositionDirect,
    useCollateralizerDirect,
    useAMMQuoteDirect,
    useLaunchpadPositionDirect,
    useTickBookDirect,
    useTickBookVaultDirect,
} from "./direct";

/**
 * V8 Hooks - Index
 * 
 * All hooks for interacting with V8 contracts
 */

// Core hooks
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

export { AMMEngineABI } from './AMMEngine.js';
export { CollateralizerABI } from './Collateralizer.js';
export { DynamicFeeHookABI } from './DynamicFeeHook.js';
export { FeeRouterABI } from './FeeRouter.js';
export { FeeVaultABI } from './FeeVault.js';
export { LaunchpadEngineABI } from './LaunchpadEngine.js';
export { ManualAdjudicatorABI } from './ManualAdjudicator.js';
export { OrderEngineABI } from './OrderEngine.js';
export { OutcomeTokenABI } from './OutcomeToken.js';
export { TruthMarketABI } from './TruthMarket.js';
export { SoothBookABI } from './SoothBook.js';

import { AMMEngineABI } from './AMMEngine.js';
import { CollateralizerABI } from './Collateralizer.js';
import { DynamicFeeHookABI } from './DynamicFeeHook.js';
import { FeeRouterABI } from './FeeRouter.js';
import { FeeVaultABI } from './FeeVault.js';
import { LaunchpadEngineABI } from './LaunchpadEngine.js';
import { ManualAdjudicatorABI } from './ManualAdjudicator.js';
import { OrderEngineABI } from './OrderEngine.js';
import { OutcomeTokenABI } from './OutcomeToken.js';
import { TruthMarketABI } from './TruthMarket.js';
import { SoothBookABI } from './SoothBook.js';

export const ABIS = {
  AMMEngine: AMMEngineABI,
  Collateralizer: CollateralizerABI,
  DynamicFeeHook: DynamicFeeHookABI,
  FeeRouter: FeeRouterABI,
  FeeVault: FeeVaultABI,
  LaunchpadEngine: LaunchpadEngineABI,
  ManualAdjudicator: ManualAdjudicatorABI,
  OrderEngine: OrderEngineABI,
  OutcomeToken: OutcomeTokenABI,
  TruthMarket: TruthMarketABI,
  SoothBook: SoothBookABI,
} as const;

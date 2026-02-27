export { AMMEngineABI } from './AMMEngine.js';
export { CollateralizerABI } from './Collateralizer.js';
export { DynamicFeeHookABI } from './DynamicFeeHook.js';
export { LaunchpadEngineABI } from './LaunchpadEngine.js';
export { OutcomeTokenABI } from './OutcomeToken.js';
export { TruthMarketABI } from './TruthMarket.js';

import { AMMEngineABI } from './AMMEngine.js';
import { CollateralizerABI } from './Collateralizer.js';
import { DynamicFeeHookABI } from './DynamicFeeHook.js';
import { LaunchpadEngineABI } from './LaunchpadEngine.js';
import { OutcomeTokenABI } from './OutcomeToken.js';
import { TruthMarketABI } from './TruthMarket.js';

export const ABIS = {
  AMMEngine: AMMEngineABI,
  Collateralizer: CollateralizerABI,
  DynamicFeeHook: DynamicFeeHookABI,
  LaunchpadEngine: LaunchpadEngineABI,
  OutcomeToken: OutcomeTokenABI,
  TruthMarket: TruthMarketABI,
} as const;

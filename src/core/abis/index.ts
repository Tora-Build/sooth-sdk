export { AMMEngineABI } from './AMMEngine.js';
export { DynamicFeeHookABI } from './DynamicFeeHook.js';
export { LaunchpadEngineABI } from './LaunchpadEngine.js';
export { OrderEngineABI } from './OrderEngine.js';
export { TruthMarketABI } from './TruthMarket.js';
export { SoothBookABI } from './SoothBook.js';

import { AMMEngineABI } from './AMMEngine.js';
import { DynamicFeeHookABI } from './DynamicFeeHook.js';
import { LaunchpadEngineABI } from './LaunchpadEngine.js';
import { OrderEngineABI } from './OrderEngine.js';
import { TruthMarketABI } from './TruthMarket.js';
import { SoothBookABI } from './SoothBook.js';

export const ABIS = {
  AMMEngine: AMMEngineABI,
  DynamicFeeHook: DynamicFeeHookABI,
  LaunchpadEngine: LaunchpadEngineABI,
  OrderEngine: OrderEngineABI,
  TruthMarket: TruthMarketABI,
  SoothBook: SoothBookABI,
} as const;

export { AMMEngineABI } from './AMMEngine.js';
export { CollateralizerABI } from './Collateralizer.js';
export { DynamicFeeHookABI } from './DynamicFeeHook.js';
export { ITickBookHooksABI } from './ITickBookHooks.js';
export { LaunchpadEngineABI } from './LaunchpadEngine.js';
export { OutcomeTokenABI } from './OutcomeToken.js';
export { TickBookABI } from './TickBook.js';
export { TickBookPoolManagerABI } from './TickBookPoolManager.js';
export { TickBookVaultABI } from './TickBookVault.js';
export { TickBookVaultPoolManagerABI } from './TickBookVaultPoolManager.js';
export { TruthMarketABI } from './TruthMarket.js';

import { AMMEngineABI } from './AMMEngine.js';
import { CollateralizerABI } from './Collateralizer.js';
import { DynamicFeeHookABI } from './DynamicFeeHook.js';
import { ITickBookHooksABI } from './ITickBookHooks.js';
import { LaunchpadEngineABI } from './LaunchpadEngine.js';
import { OutcomeTokenABI } from './OutcomeToken.js';
import { TickBookABI } from './TickBook.js';
import { TickBookPoolManagerABI } from './TickBookPoolManager.js';
import { TickBookVaultABI } from './TickBookVault.js';
import { TickBookVaultPoolManagerABI } from './TickBookVaultPoolManager.js';
import { TruthMarketABI } from './TruthMarket.js';

export const ABIS = {
  AMMEngine: AMMEngineABI,
  Collateralizer: CollateralizerABI,
  DynamicFeeHook: DynamicFeeHookABI,
  ITickBookHooks: ITickBookHooksABI,
  LaunchpadEngine: LaunchpadEngineABI,
  OutcomeToken: OutcomeTokenABI,
  TickBook: TickBookABI,
  TickBookPoolManager: TickBookPoolManagerABI,
  TickBookVault: TickBookVaultABI,
  TickBookVaultPoolManager: TickBookVaultPoolManagerABI,
  TruthMarket: TruthMarketABI,
} as const;

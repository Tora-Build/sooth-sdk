export { AMMEngineABI } from './AMMEngine';
export { CollateralizerABI } from './Collateralizer';
export { DynamicFeeHookABI } from './DynamicFeeHook';
export { ITickBookHooksABI } from './ITickBookHooks';
export { LaunchpadEngineABI } from './LaunchpadEngine';
export { OutcomeTokenABI } from './OutcomeToken';
export { TickBookABI } from './TickBook';
export { TickBookPoolManagerABI } from './TickBookPoolManager';
export { TickBookVaultABI } from './TickBookVault';
export { TickBookVaultPoolManagerABI } from './TickBookVaultPoolManager';
export { TruthMarketABI } from './TruthMarket';

import { AMMEngineABI } from './AMMEngine';
import { CollateralizerABI } from './Collateralizer';
import { DynamicFeeHookABI } from './DynamicFeeHook';
import { ITickBookHooksABI } from './ITickBookHooks';
import { LaunchpadEngineABI } from './LaunchpadEngine';
import { OutcomeTokenABI } from './OutcomeToken';
import { TickBookABI } from './TickBook';
import { TickBookPoolManagerABI } from './TickBookPoolManager';
import { TickBookVaultABI } from './TickBookVault';
import { TickBookVaultPoolManagerABI } from './TickBookVaultPoolManager';
import { TruthMarketABI } from './TruthMarket';

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

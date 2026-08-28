// sooth-core v0.4.0 ABI set (dual-token venues, FeeVault fee layer).
// FeeVaultABI lives one level up — the contract was renamed from FeeRouter, so
// it needs no version namespace. Everything here shares a name with a v0.2.1
// export and is namespaced to avoid breaking apps still on 0.2.1 nodes.
export { AMMEngineABI } from './AMMEngine.js';
export { LaunchpadEngineABI } from './LaunchpadEngine.js';
export { OrderEngineABI } from './OrderEngine.js';
export { SoothBookABI } from './SoothBook.js';
export { TruthMarketABI } from './TruthMarket.js';
export { ManualAdjudicatorABI } from './ManualAdjudicator.js';
export { FeeVaultABI } from '../FeeVault.js';

import { AMMEngineABI } from './AMMEngine.js';
import { LaunchpadEngineABI } from './LaunchpadEngine.js';
import { OrderEngineABI } from './OrderEngine.js';
import { SoothBookABI } from './SoothBook.js';
import { TruthMarketABI } from './TruthMarket.js';
import { ManualAdjudicatorABI } from './ManualAdjudicator.js';
import { FeeVaultABI } from '../FeeVault.js';

export const ABIS_V040 = {
  AMMEngine: AMMEngineABI,
  LaunchpadEngine: LaunchpadEngineABI,
  OrderEngine: OrderEngineABI,
  SoothBook: SoothBookABI,
  TruthMarket: TruthMarketABI,
  ManualAdjudicator: ManualAdjudicatorABI,
  FeeVault: FeeVaultABI,
} as const;

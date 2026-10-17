/**
 * Unversioned protocol exports expose the pinned v7 callable surface shared by
 * existing consumers. They never select the newest release. SDK operations and
 * receipt decoding select exact v7/v7.1 artifacts with getFactoryAbis(release).
 * Adjudicator exports have separate artifact pins and require profile admission.
 */
import * as v7 from './v7/index.js';
import * as v7_1 from './v7_1/index.js';
import { assertSupportedFactoryRelease, type FactoryReleaseSelector } from '../releases.js';

/** Adjudicators in these bundles describe historical artifacts, not admission. */
export function getFactoryAbis(release: FactoryReleaseSelector) {
  const supported = assertSupportedFactoryRelease(release);
  return supported.interfaceVersion === 'sooth-factory-v7' ? v7 : v7_1;
}
export const FACTORY_SOURCE_REVISION = 'ab59390';
export const FACTORY_INTERFACE_VERSION = 'sooth-factory-v7';
/** keccak256 of the bundle bytes: the `sdkAbiHash` a release commits to. */
export const FACTORY_ABI_BUNDLE_HASH =
  '0xbbb80127a1464f7f8a754d71ea4dd825664c9892762b57a880258fd3d090025a';
export const FACTORY_ABI_DIGEST =
  'sha256:73e97b93fd6b1e39a1c4529f912356f96bd7fc0345d2fb2f1dacd909980bb539';
/** The revision `ManualAdjudicatorAbi` was taken from; not part of the release. */
export const FACTORY_ADJUDICATOR_SOURCE_REVISION = 'a128cb6';
export const FACTORY_ADJUDICATOR_BUNDLE_HASH =
  '0x3425d303fa006c283be9cb867e42570ce9d1a7187b2b4b85cf88df4c25506fd7';

export { NodeFactoryAbi } from './NodeFactory.js';
export { NodeRolesAbi } from './NodeRoles.js';
export { NodeDeployerAbi } from './NodeDeployer.js';
export { ReleaseRegistryAbi } from './ReleaseRegistry.js';
export { LPPositionTokenAbi } from './LPPositionToken.js';
export { MarketFactoryAbi } from './MarketFactory.js';
export { AMMEngineAbi } from './AMMEngine.js';
export { OrderEngineAbi } from './OrderEngine.js';
export { AmmFeeVaultAbi } from './AmmFeeVault.js';
export { BookFeeVaultAbi } from './BookFeeVault.js';
export { TruthMarketAbi } from './TruthMarket.js';
export { LPPositionManagerAbi } from './LPPositionManager.js';
export { ManualAdjudicatorAbi } from './ManualAdjudicator.js';
/** Independently admitted SQF-bound IMD profiles; excluded from the release digest. */
export { IMDAdjudicatorAbi, IMDTestnetAdjudicatorAbi } from './IMDAdjudicator.js';
export { ZkTLSAdjudicatorAbi } from './ZkTLSAdjudicator.js';
export { SwarmAdjudicatorAbi, SWARM_ADJUDICATOR_ABI_BUNDLE_HASH } from './SwarmAdjudicator.js';

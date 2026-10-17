import type { Address, Hex } from 'viem';

/** Immutable Alpha factory-releases.json seeds; deployment identity is not an ABI alias. */
export const SUPPORTED_FACTORY_RELEASES = [
  {
    chainId: 11155111,
    factory: '0x67926F892CaBa6A8b96ee45b0c927031371C9e85',
    releaseId: '0x8e2f97ec33d31c164e4a9863926f5e94441cb990483f83e76d6301071a26fad7',
    interfaceVersion: 'sooth-factory-v7',
    sdkAbiHash: '0xbbb80127a1464f7f8a754d71ea4dd825664c9892762b57a880258fd3d090025a',
    releaseManifestHash: '0x3ef78101e6fa3b7b38ed2f697a5536f895f0b6aa113603667a517060e785a3f7',
    sourceRevision: 'ab5939024387b411fb4e537cb1cd6c4200bbf704',
    artifactRevision: '1aa5fc80e7e4e14df5a4141c3195fd2ee4b302ef',
    startBlock: 11885789,
  },
  {
    chainId: 46630,
    factory: '0x42D11954d64822A7241a40d4cC2257799d87447c',
    releaseId: '0xfc6082bfae24fb3153dad004ab68b5b34584ce2c3dceead82dd43cba2d175393',
    interfaceVersion: 'sooth-factory-v7.1',
    sdkAbiHash: '0x45eff5ba71a0edb8bcc1a4a8146f1450b7db7b8ce34371d4e8b53f8317642869',
    releaseManifestHash: '0x8e395807efdf5e9193f3ffa21562607bf30a3e51650034a124abe7b676d75b35',
    sourceRevision: '6e35df324f5800e63835f19c7b15c3892873bb00',
    artifactRevision: '9edac2036184bb5860b958fb739d5698f0e2afa4',
    startBlock: 134209404,
  },
] as const;

export type SupportedFactoryRelease = (typeof SUPPORTED_FACTORY_RELEASES)[number];
export type FactoryInterfaceVersion = SupportedFactoryRelease['interfaceVersion'];
export interface FactoryReleasePin {
  interfaceVersion?: string;
  releaseId?: Hex;
  sdkAbiHash?: Hex;
  chainId?: number;
  factory?: Address;
}
export type FactoryReleaseSelector = FactoryInterfaceVersion | FactoryReleasePin;
const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

/**
 * Select a supported artifact and check every supplied commitment. A version alone
 * selects an ABI, never authenticates a deployment. Non-seed deployments must pin
 * the exact releaseId; callers still verify that commitment against the chain.
 */
export function assertSupportedFactoryRelease(
  selector: FactoryReleaseSelector,
): SupportedFactoryRelease {
  const pin: FactoryReleasePin =
    typeof selector === 'string' ? { interfaceVersion: selector } : selector;
  if (!pin || (pin.interfaceVersion === undefined && pin.releaseId === undefined))
    throw new Error('Factory interfaceVersion or releaseId pin required');
  if (pin.chainId !== undefined && (!Number.isSafeInteger(pin.chainId) || pin.chainId <= 0))
    throw new Error('Invalid factory chainId');
  if (
    pin.factory !== undefined &&
    (!/^0x[\da-f]{40}$/i.test(pin.factory) || /^0x0{40}$/i.test(pin.factory))
  )
    throw new Error('Invalid factory address');
  const release = SUPPORTED_FACTORY_RELEASES.find(
    (candidate) =>
      (pin.interfaceVersion === undefined || candidate.interfaceVersion === pin.interfaceVersion) &&
      (pin.releaseId === undefined || same(candidate.releaseId, pin.releaseId)),
  );
  if (!release) throw new Error('Unsupported factory release or interfaceVersion');
  if (pin.sdkAbiHash !== undefined && !same(release.sdkAbiHash, pin.sdkAbiHash))
    throw new Error('Factory sdkAbiHash does not match the pinned artifact');
  if (
    pin.releaseId === undefined &&
    ((pin.chainId !== undefined && pin.chainId !== release.chainId) ||
      (pin.factory !== undefined && !same(pin.factory, release.factory)))
  )
    throw new Error('Non-seed factory deployment requires an explicit releaseId pin');
  return release;
}

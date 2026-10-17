import type { FactoryRelease } from '../../../src/factory/schema.js';

// Pinned identity from Alpha packages/registry/factory-releases.json.
export const supportedRelease = {
  "chainId": 46630,
  "factory": "0x42D11954d64822A7241a40d4cC2257799d87447c",
  "releaseId": "0xfc6082bfae24fb3153dad004ab68b5b34584ce2c3dceead82dd43cba2d175393",
  "interfaceVersion": "sooth-factory-v7.1",
  "sdkAbiHash": "0x45eff5ba71a0edb8bcc1a4a8146f1450b7db7b8ce34371d4e8b53f8317642869",
  "releaseManifestHash": "0x8e395807efdf5e9193f3ffa21562607bf30a3e51650034a124abe7b676d75b35",
  "sourceRevision": "6e35df324f5800e63835f19c7b15c3892873bb00",
  "artifactRevision": "9edac2036184bb5860b958fb739d5698f0e2afa4",
  "startBlock": 134209404
} as const satisfies FactoryRelease;

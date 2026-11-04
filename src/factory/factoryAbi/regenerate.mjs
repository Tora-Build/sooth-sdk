#!/usr/bin/env node
/** Regenerate: node src/factory/factoryAbi/regenerate.mjs
 * Validate the exact committed bundle bytes before generating any output.
 * Bundle integrity does not verify inaccessible historical upstream git objects.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { keccak256 } from 'viem';
import { format, resolveConfig } from 'prettier';
const root = dirname(fileURLToPath(import.meta.url));
const formatConfig = await resolveConfig(root);
async function writeTypescript(path, source) {
  writeFileSync(path, await format(source, { ...formatConfig, filepath: path }));
}
if (process.argv.length !== 2)
  throw new Error('Usage: node src/factory/factoryAbi/regenerate.mjs (no arguments; uses committed bundles)');
const pins = [
  [
    'v7',
    '1aa5fc80e7e4e14df5a4141c3195fd2ee4b302ef',
    'sooth-factory-v7',
    '0xbbb80127a1464f7f8a754d71ea4dd825664c9892762b57a880258fd3d090025a',
  ],
  [
    'v7_1',
    '9edac2036184bb5860b958fb739d5698f0e2afa4',
    'sooth-factory-v7.1',
    '0x45eff5ba71a0edb8bcc1a4a8146f1450b7db7b8ce34371d4e8b53f8317642869',
  ],
  [
    'adjudicator',
    'a128cb6aa4a1886f00ffa6b500277fdf128dfd25',
    'sooth-factory-v7',
    '0x3425d303fa006c283be9cb867e42570ce9d1a7187b2b4b85cf88df4c25506fd7',
  ],
];

// Curated oracle and IMD modules are not generated from these source archives.
// Both archives are mandatory integrity inputs, with their historical metadata.
const sourcePins = [
  {
    name: 'oracle',
    repository: 'sooth-factory',
    revision: '20b16862f12398d48f1b50d75970da0ae3730fab',
    hash: '0xdb67c3c4274d31792731196504cbe6483b96a8eb636b0a046fcfdc935d23d1f0',
    files: [
      'src/adjudicators/ZkTLSAdjudicator.sol',
      'src/adjudicators/IMDAdjudicator.sol',
      'src/adjudicators/AdjudicatorBase.sol',
      'src/adjudicators/primus/IPrimusZKTLS.sol',
    ],
  },
  {
    name: 'imd',
    repository: 'sooth-alpha',
    revision: '7d5284df1101e2d05ce41d1648b6166e59a24dab',
    hash: '0x57c58cb4fde645f2d0b4120875567f9a237d839aac635fe444e3ed35b00d5aa6',
    files: ['packages/options-core/src/factoryAbi/IMDAdjudicator.ts'],
  },
];
const bundles = pins.map(([name, revision, version, hash]) => {
  const bytes = readFileSync(join(root, 'bundles', `${name}.json`));
  const bundle = JSON.parse(bytes.toString('utf8'));
  if (keccak256(bytes) !== hash || bundle.interfaceVersion !== version)
    throw new Error(`Refusing unpinned ${name} artifact`);
  const entries =
    name === 'adjudicator'
      ? [['ManualAdjudicator', bundle.contracts.ManualAdjudicator]]
      : Object.entries(bundle.contracts);
  for (const [contract, abi] of entries) {
    if (!Array.isArray(abi)) throw new Error(`Missing ${contract}`);
  }
  return { name, revision, version, hash, entries };
});
for (const pin of sourcePins) {
  const bytes = readFileSync(join(root, 'bundles', `${pin.name}-sources.json`));
  const archive = JSON.parse(bytes.toString('utf8'));
  const files = archive.files;
  if (
    keccak256(bytes) !== pin.hash ||
    archive.repository !== pin.repository ||
    archive.revision !== pin.revision ||
    !files || typeof files !== 'object' || Array.isArray(files) ||
    Object.keys(files).length !== pin.files.length ||
    !pin.files.every((path) => Object.hasOwn(files, path) && typeof files[path] === 'string')
  ) throw new Error(`Refusing unpinned ${pin.name} source archive`);
}

// Every input has passed validation before creating directories or writing files.
for (const { name, revision, version, hash, entries } of bundles) {
  if (name !== 'adjudicator') mkdirSync(join(root, name), { recursive: true });
  for (const [contract, abi] of entries) {
    const destination = name === 'adjudicator' ? root : join(root, name);
    await writeTypescript(
      join(destination, `${contract}.ts`),
      `/** GENERATED from historical sooth-factory (now sooth-factory-archive) ${revision}:sdk/abi.json.\n * Interface: ${version}; bundle keccak256: ${hash}.\n * Verified against bundled bytes; historical upstream git objects are not verified.\n * Regenerate with node src/factory/factoryAbi/regenerate.mjs\n */\nexport const ${contract}Abi = ${JSON.stringify(abi, null, 2)} as const;\n`,
    );
    if (name === 'v7' && contract !== 'ManualAdjudicator')
      await writeTypescript(
        join(root, `${contract}.ts`),
        `/** Default v7 ABI. Use getFactoryAbis for explicit release dispatch. */\nexport { ${contract}Abi } from './v7/${contract}.js';\n`,
      );
  }
  if (name !== 'adjudicator')
    await writeTypescript(
      join(root, name, 'index.ts'),
      entries.map(([contract]) => `export { ${contract}Abi } from './${contract}.js';`).join('\n') +
        '\n',
    );
}

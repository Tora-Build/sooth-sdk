#!/usr/bin/env node
/** Regenerate: node src/factory/factoryAbi/regenerate.mjs /path/to/sooth-factory [/path/to/sooth-alpha]
 * Only these immutable git objects are accepted; never reads the checkout's ABI.
 * The original bytes remain in bundles/ so consumers can audit sdkAbiHash.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { keccak256 } from 'viem';
import { format, resolveConfig } from 'prettier';
const root = dirname(fileURLToPath(import.meta.url));
const formatConfig = await resolveConfig(root);
async function writeTypescript(path, source) {
  writeFileSync(path, await format(source, { ...formatConfig, filepath: path }));
}
const repo = process.argv[2];
if (!repo) throw new Error('Supply the sooth-factory repository path');
const pins = [
  ['v7', '1aa5fc80e7e4e14df5a4141c3195fd2ee4b302ef', 'sooth-factory-v7', '0xbbb80127a1464f7f8a754d71ea4dd825664c9892762b57a880258fd3d090025a'],
  ['v7_1', '9edac2036184bb5860b958fb739d5698f0e2afa4', 'sooth-factory-v7.1', '0x45eff5ba71a0edb8bcc1a4a8146f1450b7db7b8ce34371d4e8b53f8317642869'],
  ['adjudicator', 'a128cb6aa4a1886f00ffa6b500277fdf128dfd25', 'sooth-factory-v7', '0x3425d303fa006c283be9cb867e42570ce9d1a7187b2b4b85cf88df4c25506fd7'],
];
mkdirSync(join(root, 'bundles'), { recursive: true });
for (const [name, revision, version, hash] of pins) {
  const bytes = execFileSync('git', ['show', `${revision}:sdk/abi.json`], { cwd: repo, maxBuffer: 4 * 1024 * 1024 });
  const bundle = JSON.parse(bytes.toString('utf8'));
  if (keccak256(bytes) !== hash || bundle.interfaceVersion !== version) throw new Error(`Refusing unpinned ${name} artifact`);
  writeFileSync(join(root, 'bundles', `${name}.json`), bytes);
  const entries = name === 'adjudicator' ? [['ManualAdjudicator', bundle.contracts.ManualAdjudicator]] : Object.entries(bundle.contracts);
  if (name !== 'adjudicator') mkdirSync(join(root, name), { recursive: true });
  for (const [contract, abi] of entries) {
    if (!Array.isArray(abi)) throw new Error(`Missing ${contract}`);
    const destination = name === 'adjudicator' ? root : join(root, name);
    await writeTypescript(join(destination, `${contract}.ts`), `/** GENERATED from sooth-factory ${revision}:sdk/abi.json.\n * Interface: ${version}; bundle keccak256: ${hash}.\n * Regenerate with node src/factory/factoryAbi/regenerate.mjs /path/to/sooth-factory\n */\nexport const ${contract}Abi = ${JSON.stringify(abi, null, 2)} as const;\n`);
    if (name === 'v7' && contract !== 'ManualAdjudicator') await writeTypescript(join(root, `${contract}.ts`), `/** Default v7 ABI. Use getFactoryAbis for explicit release dispatch. */\nexport { ${contract}Abi } from './v7/${contract}.js';\n`);
  }
  if (name !== 'adjudicator') await writeTypescript(join(root, name, 'index.ts'), entries.map(([contract]) => `export { ${contract}Abi } from './${contract}.js';`).join('\n') + '\n');
}

// Curated oracle interfaces are separate from sdk/abi.json. Preserve their exact
// pinned source inputs; changing these hashes requires explicit capability review.
const alpha = process.argv[3];
const sourcePins = [
  { name: 'oracle', repository: 'sooth-factory', repo, revision: '20b16862f12398d48f1b50d75970da0ae3730fab', hash: '0xdb67c3c4274d31792731196504cbe6483b96a8eb636b0a046fcfdc935d23d1f0', files: ['src/adjudicators/ZkTLSAdjudicator.sol', 'src/adjudicators/IMDAdjudicator.sol', 'src/adjudicators/AdjudicatorBase.sol', 'src/adjudicators/primus/IPrimusZKTLS.sol'] },
  ...(alpha ? [{ name: 'imd', repository: 'sooth-alpha', repo: alpha, revision: '7d5284df1101e2d05ce41d1648b6166e59a24dab', hash: '0x57c58cb4fde645f2d0b4120875567f9a237d839aac635fe444e3ed35b00d5aa6', files: ['packages/options-core/src/factoryAbi/IMDAdjudicator.ts'] }] : []),
];
for (const pin of sourcePins) {
  const files = Object.fromEntries(pin.files.map(path => [path, execFileSync('git', ['show', `${pin.revision}:${path}`], { cwd: pin.repo, encoding: 'utf8' })]));
  const json = JSON.stringify({ repository: pin.repository, revision: pin.revision, files }, null, 2).replace(/[\u0080-\uffff]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const bytes = Buffer.from(json + '\n');
  if (keccak256(bytes) !== pin.hash) throw new Error(`Refusing unpinned ${pin.name} source archive`);
  writeFileSync(join(root, 'bundles', `${pin.name}-sources.json`), bytes);
}

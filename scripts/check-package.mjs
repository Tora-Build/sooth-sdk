import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(pkg.name, 'sooth');
assert.equal(pkg.peerDependenciesMeta.react.optional, true);
assert.equal(pkg.peerDependenciesMeta['@tanstack/react-query'].optional, true);

const expected = ['extractQuestion', 'generateSQF', 'parseSQF', 'parseSQFSafe'];
const root = await import('sooth');
const sqf = await import('sooth/sqf');
assert.deepEqual(Object.keys(root).sort(), expected);
assert.deepEqual(Object.keys(sqf).sort(), expected);
for (const name of expected) assert.equal(root[name], sqf[name]);

const data = { question: 'Will X happen?', rule: { source: 'example', tie: 'invalid' } };
assert.deepEqual(sqf.parseSQF(sqf.generateSQF(data)), data);
assert.deepEqual(sqf.parseSQFSafe('Plain question?'), { question: 'Plain question?', rule: {} });

const removed = [
  'core',
  'core/utils',
  'core/types',
  'core/errors',
  'core/abis',
  'core/math',
  'core/contracts',
  'core/abis/v040',
];
for (const path of removed) {
  await assert.rejects(import(`sooth/${path}`), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
}
const factory = await import('sooth/factory');
const schema = await import('sooth/factory/schema');
const react = await import('sooth/react');
const identity = {
  chainId: 11155111,
  factory: '0x67926F892CaBa6A8b96ee45b0c927031371C9e85',
  nodeId: `0x${'ab'.repeat(32)}`,
};
assert.equal(
  schema.factoryNodeKey(identity),
  `sooth-factory:11155111:${identity.factory.toLowerCase()}:${identity.nodeId}`,
);
assert.equal(typeof factory.buildFactoryTransaction, 'function');
assert.equal(typeof react.SoothMarket, 'function');
const help = execFileSync(process.execPath, [new URL('../bin/soothcli.js', import.meta.url).pathname, '--help'], { encoding: 'utf8' });
assert.match(help, /factory|market/i);
const [pack] = JSON.parse(
  execFileSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], {
    cwd: new URL('../', import.meta.url),
    encoding: 'utf8',
  }),
);
const paths = pack.files.map(({ path }) => path);
for (const path of ['dist/index.js', 'dist/lib/sqf.js', 'dist/factory/index.js', 'dist/react/index.js', 'bin/soothcli.js']) {
  assert.ok(paths.includes(path), `Package is missing ${path}`);
}
assert.ok(!paths.some(path => path.startsWith('dist/core/')), 'Retired core artifacts must not ship');
console.log(`Package smoke passed: SQF roundtrip, Factory identity, React import, CLI help and ${paths.length} packed files.`);

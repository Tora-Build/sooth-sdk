import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(pkg.name, 'sooth');
assert.deepEqual(Object.keys(pkg.exports).sort(), ['.', './sqf']);
assert.deepEqual(pkg.dependencies, {});
assert.equal(pkg.bin, undefined);
assert.deepEqual(pkg.files, ['dist']);

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
assert.deepEqual(
  (await readdir(new URL('../dist/', import.meta.url), { recursive: true })).sort(),
  ['index.d.ts', 'index.js', 'lib', 'lib/sqf.d.ts', 'lib/sqf.js'],
);
const [pack] = JSON.parse(
  execFileSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], {
    cwd: new URL('../', import.meta.url),
    encoding: 'utf8',
  }),
);
assert.deepEqual(pack.files.map(({ path }) => path).sort(), [
  'LICENSE',
  'README.md',
  'dist/index.d.ts',
  'dist/index.js',
  'dist/lib/sqf.d.ts',
  'dist/lib/sqf.js',
  'package.json',
]);
console.log(`Pack check passed: ${pack.files.length} files, no core, CLI, or registry artifacts.`);
console.log(
  `Package check passed: 2 entry points, 4 shared functions, ${removed.length} removed subpaths rejected.`,
);

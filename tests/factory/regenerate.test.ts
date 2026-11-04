import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const abiPath = 'src/factory/factoryAbi';
const temporaryDirectories: string[] = [];

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'sooth-regenerate-'));
  temporaryDirectories.push(directory);
  const root = join(directory, abiPath);
  cpSync(join(repository, abiPath), root, { recursive: true });
  cpSync(join(repository, '.prettierrc.json'), join(directory, '.prettierrc.json'));
  symlinkSync(join(repository, 'node_modules'), join(directory, 'node_modules'), 'dir');
  return { directory, root };
}

function snapshot(root: string): Record<string, Buffer> {
  const files: Record<string, Buffer> = {};
  function visit(relative: string) {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      const path = join(relative, entry.name);
      if (entry.isDirectory()) visit(path);
      else files[path] = readFileSync(join(root, path));
    }
  }
  visit('');
  return files;
}

function run(directory: string, args: string[] = []) {
  return spawnSync(process.execPath, [join(directory, abiPath, 'regenerate.mjs'), ...args], {
    cwd: directory,
    encoding: 'utf8',
    timeout: 30_000,
  });
}

type AbiBundle = { interfaceVersion: string; contracts: Record<string, unknown[]> };
type SourceArchive = { repository: string; revision: string; files: Record<string, string> };
type Archives = {
  v7: AbiBundle;
  v7_1: AbiBundle;
  'oracle-sources': SourceArchive;
  'imd-sources': SourceArchive;
};

function changeArchive<Name extends keyof Archives>(root: string, name: Name, change: (archive: Archives[Name]) => void) {
  const path = join(root, 'bundles', `${name}.json`);
  const archive = JSON.parse(readFileSync(path, 'utf8'));
  change(archive);
  writeFileSync(path, JSON.stringify(archive, null, 2) + '\n');
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('bundled Factory ABI regeneration', () => {
  it('recreates every generated output byte-for-byte and is stable on repetition', () => {
    const { directory, root } = fixture();
    const committed = snapshot(root);
    for (const name of ['v7', 'v7_1', 'adjudicator']) {
      const bundle = JSON.parse(readFileSync(join(root, 'bundles', `${name}.json`), 'utf8'));
      const contracts = name === 'adjudicator' ? ['ManualAdjudicator'] : Object.keys(bundle.contracts);
      for (const contract of contracts) {
        rmSync(join(root, name === 'adjudicator' ? '' : name, `${contract}.ts`));
        if (name === 'v7' && contract !== 'ManualAdjudicator') rmSync(join(root, `${contract}.ts`));
      }
      if (name !== 'adjudicator') rmSync(join(root, name, 'index.ts'));
    }
    const first = run(directory);
    expect(first.error).toBeUndefined();
    expect(first.stderr).toBe('');
    expect(first.status).toBe(0);
    expect(snapshot(root)).toEqual(committed);
    const second = run(directory);
    expect(second.error).toBeUndefined();
    expect(second.stderr).toBe('');
    expect(second.status).toBe(0);
    expect(snapshot(root)).toEqual(committed);
  }, 60_000);

  const corruptions: [string, string, (root: string) => void][] = [
    ['corrupted ABI', 'v7 artifact', root => changeArchive(root, 'v7', bundle => {
      bundle.contracts.MarketFactory = [];
    })],
    ['wrong interface version', 'v7_1 artifact', root => changeArchive(root, 'v7_1', bundle => {
      bundle.interfaceVersion = 'sooth-factory-v99';
    })],
    ['wrong historical repository', 'oracle source archive', root => changeArchive(root, 'oracle-sources', archive => {
      archive.repository = 'sooth-factory-archive';
    })],
    ['wrong source revision', 'oracle source archive', root => changeArchive(root, 'oracle-sources', archive => {
      archive.revision = '0000000000000000000000000000000000000000';
    })],
    ['substituted source inventory', 'oracle source archive', root => changeArchive(root, 'oracle-sources', archive => {
      const path = Object.keys(archive.files)[0]!;
      archive.files['unexpected.sol'] = archive.files[path];
      delete archive.files[path];
    })],
    ['late tampered source input', 'imd source archive', root => {
      const path = join(root, 'bundles', 'imd-sources.json');
      writeFileSync(path, Buffer.concat([readFileSync(path), Buffer.from(' ')]));
    }],
  ];

  it.each(corruptions)('refuses %s before mutating any output', (_label, error, corrupt) => {
    const { directory, root } = fixture();
    // Distinct output bytes expose an early write even when regeneration is otherwise stable.
    for (const path of Object.keys(snapshot(root))) {
      if (path.endsWith('.ts')) writeFileSync(join(root, path), `// untouched ${path}\n`);
    }
    corrupt(root);
    const before = snapshot(root);
    const result = run(directory);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Refusing unpinned ${error}`);
    expect(snapshot(root)).toEqual(before);
  }, 60_000);

  it('rejects legacy checkout arguments without mutating files', () => {
    const { directory, root } = fixture();
    const before = snapshot(root);
    const result = run(directory, [dirname(directory), dirname(directory)]);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Usage: node src/factory/factoryAbi/regenerate.mjs (no arguments; uses committed bundles)');
    expect(snapshot(root)).toEqual(before);
  }, 60_000);
});

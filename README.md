# sooth

Protocol-neutral Sooth Question Format (SQF) utilities. Version 1.0.0 is a
breaking, utility-only change pending release. This cleanup does not publish it.

## Package names

The npm package stays `sooth`. Alpha uses the workspace alias `@sooth/sdk`
with `"@sooth/sdk": "workspace:sooth@*"`. The SQF subpath stays `sooth/sqf`
(`@sooth/sdk/sqf` in Alpha).

## Usage

```ts
import { generateSQF, parseSQFSafe, type SQFData } from 'sooth/sqf';

const data: SQFData = {
  question: 'Will X happen?',
  rule: { description: 'Resolves YES if X.', source: 'example' },
  event: 'EV-1',
  category: 'tech',
  meta: { icon: 'x' },
};

const text = generateSQF(data);
const parsed = parseSQFSafe(text);
```

## Exports

Both `sooth` and `sooth/sqf` export:

- `parseSQF(raw)`: parse tagged question text into `SQFData`.
- `generateSQF(data)`: generate tagged question text.
- `extractQuestion(raw)`: return the question or the original text.
- `parseSQFSafe(raw)`: preserve plain text with an empty rule.
- Types: `SQFData`, `SQFRule`.

SQF supports `§question`, `§rule`, `§event`, `§category`, and `§meta` sections.
Rule fields remain generic strings. These helpers format text; they do not
validate settlement rules or decide outcomes. Existing SQF behavior is preserved.
There are no runtime dependencies or network calls.

## Migration from 0.x

All `sooth/core` subpaths, contract ABIs, contract helpers, client classes,
registry types and snapshots, v1 registry loading, `soothcli`, and scenarios
are removed. The package does not provide a Factory protocol client.

Consumers of `sooth/sqf` keep the same API. Consumers of removed exports must
retire those workflows or use their own protocol integration before upgrading.
Alpha coordinates this removal separately, including retired Demo/Mobile and
legacy Market paths. Historical release records remain in `CHANGELOG.md` and
`DECISIONS.md`.

## Development

Use Node.js 20+ and the pinned pnpm version in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm test:package
```

See [CONTRIBUTING.md](./CONTRIBUTING.md), [TEST_PLAN.md](./TEST_PLAN.md), and
[SECURITY.md](./SECURITY.md).

# Version Filter — How the CLI Rejects Mismatched Nodes

The version filter is the first line of defense against ABI mismatches. Without it, every CLI migration becomes a guessing game when a user reports an error — they could be pointing the wrong version of soothcli at a v0.1.x node.

## Three components

### 1. The constant — `src/cli/config.ts`

```ts
export const SDK_VERSION = "12.1.0";

// CLI is hardcoded against this sooth-core version's ABIs and call flow.
// Connecting to a node with a different coreVersion produces ABI mismatches
// (e.g. settle() arity, isMarketSettled vs isSettled). Refuse to start.
export const SUPPORTED_CORE_VERSION = "0.X.Y"; // bump per version
```

When migrating to a new version, this is the first edit. The version string must match exactly what `nodes.json` reports for the new nodes.

### 2. The startup gate — `src/cli/interactive.ts`

In `main()`, right after `createConfig`:

```ts
config = createConfig(nodeIdArg);
if (config.coreVersion !== SUPPORTED_CORE_VERSION) {
  console.error(
    error(
      `\n  Unsupported node coreVersion: ${config.coreVersion}\n` +
        `  This CLI only supports sooth-core v${SUPPORTED_CORE_VERSION}.\n` +
        `  Run \`soothcli --list\` to find a compatible node.`,
    ),
  );
  process.exit(1);
}
```

Place this **before** `createActorManager` and any RPC calls — failing fast saves a few seconds of pointless wallet/RPC initialization.

### 3. The `--list` compat column

Make the listing self-documenting so users can fix their own mistake:

```ts
console.log(`\n  ${bold("Available Sooth Nodes")}`);
console.log(`  ${dim(`CLI supports core v${SUPPORTED_CORE_VERSION} only`)}\n`);
console.log("  ID          Chain              Core   Compat");
console.log("  ────────    ─────────────────  ────   ──────");
for (const n of nodes) {
  const chain = getChain(n.chainId);
  const compat = n.coreVersion === SUPPORTED_CORE_VERSION ? "✓" : "✗";
  console.log(
    `  ${n.id}    ${(chain?.name ?? `chain:${n.chainId}`).padEnd(17)}  ${n.coreVersion}  ${compat}`,
  );
}
```

Output users see:

```
  Available Sooth Nodes
  CLI supports core v0.2.0 only

  ID          Chain              Core   Compat
  ────────    ─────────────────  ────   ──────
  c30c6b15    Base Sepolia       0.2.0  ✓
  a03aa4f4    Base Sepolia       0.1.2  ✗
```

## Why exact version match (not semver-range)

Sooth-core uses fairly aggressive minor versions for breaking changes (v0.1.x → v0.2.0 added attest/finalize lifecycle). A `^0.2.0` or `>=0.2.0` range would let v0.3.0 nodes connect and silently misbehave. Exact match means a CLI migration is required for every contract migration — which is exactly the discipline this skill enforces.

If sooth-core ever stabilizes onto stricter semver, this can be relaxed to a range check.

## Verifying after a migration

Two checks, both fast:

```bash
# Should show all nodes with the new version as ✓ and old ones as ✗
pnpm --filter sdk interactive --list

# Should reject with clean message + exit 1
pnpm --filter sdk interactive <old-version-node-id>
```

If the rejection path silently launches the REPL anyway, the gate is wired wrong — the most common mistake is putting the check after `actorManager` initialization, which can throw on its own and mask the version error.

/**
 * Registry Loader — SDK-side boundary for reading registry data without
 * importing the in-monorepo `packages/registry` package. After the SDK
 * extraction (sooth-sdk submodule), the registry package no longer
 * lives in the same repo, so the SDK ships a self-contained loader.
 *
 * Data sources, in order of preference:
 *   1. An explicitly-injected manifest (via setManifest / setManifestProvider).
 *      This is how sooth-alpha contributors get instant feedback when they
 *      edit packages/registry/nodes.json — they wire a provider that imports
 *      the live JSON. External SDK consumers never hit this path.
 *   2. HTTP fetch from registry.sooth.market (with a short timeout). This is
 *      the freshness path — caught nodes added since the last SDK release.
 *   3. The embedded snapshot at data/nodes.snapshot.json. Last-known-good,
 *      bundled with each SDK release so the CLI works offline / pre-network.
 *
 * Skew between sooth-alpha's live registry and the SDK's embedded snapshot
 * is bounded by CI: any registry edit must re-vendor the snapshot in the
 * sooth-sdk submodule and bump the submodule pointer in sooth-alpha.
 */

import { defineChain, type Chain } from "viem";
import type { ChainMeta, NodesManifest, SoothNode } from "./registry-types";
// Embedded snapshot — shipped with every SDK release as the offline fallback.
// Must be re-vendored whenever packages/registry/nodes.json changes (CI guard).
import embeddedSnapshot from "../data/nodes.snapshot.json" with { type: "json" };

const DEFAULT_REGISTRY_URL = "https://registry.sooth.market";
const HTTP_TIMEOUT_MS = 2_000;

type ManifestProvider = () => NodesManifest | Promise<NodesManifest>;

let injectedProvider: ManifestProvider | null = null;
let cachedManifest: NodesManifest | null = null;
let httpRefreshPromise: Promise<void> | null = null;

/** Synchronously override the manifest. Sooth-alpha uses this in dev to point
 *  the SDK at the live packages/registry/nodes.json without going over HTTP. */
export function setManifest(manifest: NodesManifest): void {
  cachedManifest = manifest;
}

/** Async lazy override. Provider runs once; result is cached as the manifest. */
export function setManifestProvider(provider: ManifestProvider): void {
  injectedProvider = provider;
  cachedManifest = null; // force re-resolution on next ensureManifest()
}

/** Reset to the embedded-snapshot default. Mainly for tests. */
export function resetManifest(): void {
  injectedProvider = null;
  cachedManifest = null;
  httpRefreshPromise = null;
}

/** Resolve the manifest. Call once at startup; subsequent calls return the
 *  cached value. Order: injected provider → cached → HTTP (with timeout) →
 *  embedded snapshot. Always returns something — never rejects. */
export async function loadManifest(opts?: {
  registryUrl?: string;
  /** Skip the HTTP refresh attempt. Useful in tests. */
  offline?: boolean;
}): Promise<NodesManifest> {
  if (cachedManifest) return cachedManifest;

  if (injectedProvider) {
    cachedManifest = await injectedProvider();
    return cachedManifest;
  }

  if (!opts?.offline) {
    const fresh = await fetchManifestWithTimeout(
      opts?.registryUrl ?? DEFAULT_REGISTRY_URL,
    );
    if (fresh) {
      cachedManifest = fresh;
      return cachedManifest;
    }
  }

  cachedManifest = embeddedSnapshot as NodesManifest;
  return cachedManifest;
}

/** Kick off a non-blocking HTTP refresh in the background. The next call to
 *  loadManifest()/sync helpers picks up the fresh data. Safe to call from
 *  CLI startup so users get up-to-date nodes without a startup delay. */
export function refreshManifestInBackground(opts?: {
  registryUrl?: string;
}): Promise<void> {
  if (httpRefreshPromise) return httpRefreshPromise;
  httpRefreshPromise = (async () => {
    const fresh = await fetchManifestWithTimeout(
      opts?.registryUrl ?? DEFAULT_REGISTRY_URL,
    );
    if (fresh) cachedManifest = fresh;
  })().finally(() => {
    httpRefreshPromise = null;
  });
  return httpRefreshPromise;
}

async function fetchManifestWithTimeout(
  registryUrl: string,
): Promise<NodesManifest | null> {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), HTTP_TIMEOUT_MS);
    const res = await fetch(`${registryUrl}/v1/manifest`, {
      signal: ac.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as { data: NodesManifest };
    return json.data;
  } catch {
    return null;
  }
}

/** Synchronous accessors. These require loadManifest() to have run first
 *  (or setManifest to have been called). They throw if the manifest is
 *  not yet available — surfaces ordering bugs early. */

function requireManifest(): NodesManifest {
  if (!cachedManifest) {
    throw new Error(
      "Registry manifest not loaded. Call `await loadManifest()` (or " +
        "`setManifest(...)`) before using sync registry accessors.",
    );
  }
  return cachedManifest;
}

export function getAllNodes(): SoothNode[] {
  return requireManifest().nodes;
}

export function getNodeById(id: string): SoothNode | undefined {
  return requireManifest().nodes.find((n) => n.id === id);
}

export function getChain(chainId: number): ChainMeta | undefined {
  return requireManifest().chains[String(chainId)];
}

export function getSupportedChainIds(): number[] {
  return requireManifest().nodes.map((n) => n.chainId);
}

/** Convert a registry chain to a viem Chain object. Mirrors the shape of
 *  packages/registry/src/viem.ts:toViemChain so call sites are unchanged. */
export function toViemChain(chainId: number, rpcOverride?: string[]): Chain {
  const meta = getChain(chainId);
  if (!meta) throw new Error(`Unknown chainId: ${chainId}`);

  const rpcUrls = rpcOverride ?? meta.rpcUrls;

  return defineChain({
    id: chainId,
    name: meta.name,
    nativeCurrency: meta.nativeCurrency,
    rpcUrls: { default: { http: rpcUrls } },
    blockExplorers: {
      default: { name: meta.explorer.name, url: meta.explorer.url },
    },
    ...(meta.multicall3 && {
      contracts: { multicall3: { address: meta.multicall3 } },
    }),
    testnet: meta.testnet,
  });
}

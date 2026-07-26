#!/usr/bin/env node

/**
 * soothcli — Sooth Protocol CLI
 *
 * Thin wrapper that launches the interactive REPL.
 * All logic lives in src/cli/interactive.ts.
 *
 * Usage:
 *   soothcli <nodeId>              Connect to node and enter REPL
 *   soothcli <nodeId> --rpc=<url>  Connect with custom RPC
 *   soothcli --list                List available nodes
 */
const args = process.argv.slice(2);

const DEFAULT_REGISTRY_URL = process.env.SOOTH_REGISTRY_URL || 'https://registry.sooth.market';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json();
}

async function loadNodeTable(baseUrl) {
  try {
    const manifestRes = await fetchJson(`${baseUrl}/v1/manifest`);
    const manifest = manifestRes?.data || manifestRes;
    if (Array.isArray(manifest?.nodes)) {
      return {
        nodes: manifest.nodes,
        chains: manifest.chains || {},
      };
    }
  } catch {}

  const nodesRes = await fetchJson(`${baseUrl}/v1/nodes`);
  const nodes = nodesRes?.data || nodesRes;
  let chains = {};
  try {
    const chainsRes = await fetchJson(`${baseUrl}/v1/chains`);
    chains = chainsRes?.data || chainsRes || {};
  } catch {}

  if (!Array.isArray(nodes)) {
    throw new Error('Registry response did not include a node array');
  }

  return { nodes, chains };
}

if (args.includes('--list')) {
  try {
    const { nodes, chains } = await loadNodeTable(DEFAULT_REGISTRY_URL);

    console.log('\n  Available Sooth Nodes\n');
    console.log('  ID          Chain              Core');
    console.log('  --------    -----------------  ----');

    for (const node of nodes) {
      const chainName = (chains?.[String(node.chainId)]?.name ?? `chain:${node.chainId}`).padEnd(17);
      console.log(`  ${node.id}    ${chainName}  ${node.coreVersion}`);
    }

    console.log('');
    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Failed to fetch node list from ${DEFAULT_REGISTRY_URL}: ${msg}`);
    process.exit(1);
  }
}

try {
  await import('../dist/cli/interactive.js');
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("Cannot find package 'viem'")) {
    console.error("Missing runtime dependency 'viem'. Run `pnpm install` in repo root, then retry.");
    process.exit(1);
  }

  throw err;
}

/**
 * sooth — Sooth Protocol SDK
 *
 * Programmatic access to Sooth prediction markets.
 *
 * Usage:
 *   import { SoothClient } from 'sooth'
 *   const client = await SoothClient.create('a7f3b2e1', { privateKey: '0x...' })
 *   const markets = await client.markets.list()
 *
 * Core utilities (ABIs, math, config):
 *   import { ABIS, computeLMSR } from 'sooth/core'
 */

export { SoothClient } from './client.js';
export { Registry } from './registry.js';
export type {
  SoothNode,
  SoothContracts,
  SoothAdjudicators,
  ChainMeta,
  NodesManifest,
  Address,
} from './registry-types.js';
// Registry resolution: injected → HTTP (2s timeout) → embedded snapshot.
// Exported so consumers can inject a manifest (setManifest / setManifestProvider)
// or drive resolution directly (loadManifest) — the same robust path the SDK uses.
export {
  loadManifest,
  setManifest,
  setManifestProvider,
  resetManifest,
  refreshManifestInBackground,
} from './registry-loader.js';
export { Markets } from './market.js';
export { Orderbook } from './orderbook.js';
export { Wallet } from './wallet.js';
export type {
  SoothClientOptions,
  MarketInfo,
  Position,
  TradeParams,
  OrderbookOrder,
  SoothClients,
} from './types.js';

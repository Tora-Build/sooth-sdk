/**
 * @sooth/sdk — Sooth Protocol SDK
 *
 * Programmatic access to Sooth prediction markets.
 *
 * Usage:
 *   import { SoothClient } from '@sooth/sdk'
 *   const client = await SoothClient.create('a7f3b2e1', { privateKey: '0x...' })
 *   const markets = await client.markets.list()
 *
 * Core utilities (ABIs, math, config):
 *   import { ABIS, computeLMSR } from '@sooth/sdk/core'
 */

export { SoothClient } from './client';
export { Registry } from './registry';
export type {
  SoothNode,
  SoothContracts,
  ChainMeta,
  NodesManifest,
  Address,
} from './registry-types';
export { Markets } from './market';
export { Orderbook } from './orderbook';
export { Wallet } from './wallet';
export type {
  SoothClientOptions,
  NodeInfo,
  ChainInfo,
  MarketInfo,
  Position,
  TradeParams,
  OrderbookOrder,
  SoothClients,
} from './types';

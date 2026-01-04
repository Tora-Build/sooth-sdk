// Indexer hooks with RPC fallback
export { useOrdersIndexed } from "./useOrdersIndexed";
export { useOrderbookIndexed } from "./useOrderbookIndexed";
export { useTradesIndexed } from "./useTradesIndexed";
export type { TickData } from "./useOrderbookIndexed";
export type { Trade } from "./useTradesIndexed";

// Config
export { INDEXER_URL, USE_INDEXER, checkIndexerHealth } from "./config";

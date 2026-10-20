/** Optional React UI entry. Protocol and SQF imports never load React or React DOM. */
export { SoothMarket, type SoothMarketProps } from './SoothMarket.js';
export { SoothNode, type SoothNodeProps } from './SoothNode.js';
export { SoothCreateMarket, type SoothCreateMarketProps } from './SoothCreateMarket.js';
export {
  parseSoothNodeReference,
  formatSoothNodeReference,
  type SoothNodeReference,
  type SoothNodeFeatures,
  type SoothNodePresentation,
} from './node.js';
export {
  readSoothCreationOptions,
  planSoothCreation,
  sendSoothCreation,
  type SoothCreationProfile,
  type SoothCreationOptions,
  type SoothCreationIntent,
  type SoothCreationPreview,
  type SoothSubmittedCreation,
} from './creation.js';
export {
  loadSoothPendingCreations,
  saveSoothPendingCreation,
  removeSoothPendingCreation,
  reconcileSoothCreation,
  type SoothPendingCreation,
  type SoothCreationReconciliation,
} from './creationRecovery.js';
export {
  SoothProvider,
  useSoothWallet,
  useSoothMarket,
  useSoothTransactionRecovery,
} from './hooks.js';
export {
  createSoothRuntime,
  readSoothMarket,
  generateSoothEmbed,
  type SoothRuntime,
  type SoothRuntimeConfiguration,
  type SoothChainConfiguration,
  type SoothResolvedMarket,
  type SoothResolvedNode,
  type SoothMarketData,
} from './runtime.js';
export {
  createEip1193WalletAdapter,
  createViemWalletAdapter,
  getInjectedSoothWallet,
  loadSoothPending,
  saveSoothPending,
  removeSoothPending,
  reconcileSoothPending,
  type SoothWalletAdapter,
  type SoothWalletSession,
  type SoothPendingTransaction,
  type SoothPendingReconciliation,
} from './wallet.js';
export {
  planSoothTrade,
  sendSoothAction,
  type SoothTradeIntent,
  type SoothTradePreview,
  type SoothSubmittedTransaction,
} from './trading.js';
export {
  SOOTH_EMBED_PROTOCOL,
  parseSoothMarketReference,
  formatSoothMarketReference,
  soothWidgetUrl,
  renderSoothEmbedSnippet,
  isSoothEmbedMessage,
  acceptsSoothEmbedMessage,
  type SoothMarketReference,
  type SoothTheme,
  type SoothVenue,
  type SoothHostEvent,
  type SoothEmbedMessage,
} from './embed.js';
export {
  readSoothPriceHistory,
  readSoothDepth,
  quoteSoothTrade,
  readSoothLiquidity,
  planSoothAddLiquidity,
  readSoothNodeMarkets,
  readSoothMarketSummary,
  type SoothChartInterval,
  type SoothPricePoint,
  type SoothPriceHistory,
  type SoothDepth,
  type SoothDepthLevel,
  type SoothLiveQuote,
  type SoothLiquidity,
  type SoothLiquidityReceipt,
  type SoothLiquidityClaim,
  type SoothLiquidityPreview,
  type SoothLpEntitlements,
  type SoothMarketSummary,
} from './data.js';
export {
  useSoothPriceHistory,
  useSoothDepth,
  useSoothLiveQuote,
  useSoothLiquidity,
  useSoothNodeMarkets,
  useSoothMarketSummary,
  type SoothDataState,
} from './dataHooks.js';
export type { SoothLocale } from './ui/i18n.js';

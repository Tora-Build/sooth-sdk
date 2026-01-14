import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { type AppKitNetwork } from '@reown/appkit/networks';
import { fallback, http } from 'viem';
import { baseSepolia, monadTestnet, arcTestnet, megaethTestnet } from './chains';

// Reown AppKit Project ID
export const projectId = '01ecc3f4925fa2e6a5f3f82b74487317';

// Metadata for AppKit
export const metadata = {
  name: 'Sooth Protocol',
  description: 'Prediction Markets',
  url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
  icons: ['https://avatars.githubusercontent.com/u/179229932'],
};

// Networks for AppKit (includes Arc Testnet)
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  // IMPORTANT: use our local chain definitions for EVM networks.
  // This avoids wagmi auto-enabling Multicall3 batching in some network presets,
  // which has been observed (via NDJSON) to intermittently stall `useReadContracts`.
  baseSepolia as unknown as AppKitNetwork,
  monadTestnet as unknown as AppKitNetwork,
  megaethTestnet as unknown as AppKitNetwork,
  arcTestnet as unknown as AppKitNetwork
];

// Base Sepolia RPC config with rate limit handling
// Public RPCs have strict rate limits (~5-10 rps)
const baseSepoliaHttpOptions = {
  retryCount: 3,
  retryDelay: 3000, // 3 seconds between retries (backoff for 429s)
  timeout: 30_000,
  batch: {
    batchSize: 100,    // Max calls per batch
    wait: 50,          // Wait 50ms to collect batch
  },
};

// Monad RPC config with retry and rate limit handling
// Docs: https://docs.monad.xyz/developer-essentials/testnets
// Rate limits: QuickNode 25 rps, Ankr 300/10s, Foundation 20 rps
const monadHttpOptions = {
  retryCount: 3,
  retryDelay: 1000, // 1 second between retries
  timeout: 30_000,  // 30 second timeout
};

// Arc RPC config
// Docs: https://docs.arc.network/arc/references/connect-to-arc
// Note: Arc RPC doesn't support eth_newFilter/eth_getFilterChanges
const arcHttpOptions = {
  retryCount: 2,
  retryDelay: 1000,
  timeout: 30_000,
};

// MegaETH RPC config
const megaethHttpOptions = {
  retryCount: 2,
  retryDelay: 1000,
  timeout: 30_000,
};

const arcRpcCandidates = (import.meta.env.VITE_ARC_TESTNET_RPC_URL ?? '')
  .split(',')
  .map((url: string) => url.trim())
  .filter(Boolean);

const arcRpcUrls =
  arcRpcCandidates.length > 0
    ? arcRpcCandidates
    : [
      'https://rpc.blockdaemon.testnet.arc.network',
      'https://rpc.drpc.testnet.arc.network',
      'https://rpc.testnet.arc.network',
      'https://rpc.quicknode.testnet.arc.network',
    ];

// Create Wagmi Adapter with custom RPC
export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
  transports: {
    // Base Sepolia: Official RPC only (publicnode has QUIC protocol issues)
    [baseSepolia.id]: http('https://sepolia.base.org', baseSepoliaHttpOptions),
    // Monad: Ankr is the only reliably working endpoint as of 2026-01
    // QuickNode and Foundation RPCs are currently unreachable
    [monadTestnet.id]: http('https://rpc.ankr.com/monad_testnet', monadHttpOptions),
    [arcTestnet.id]: fallback(arcRpcUrls.map((url: string) => http(url, arcHttpOptions))),
    [megaethTestnet.id]: http('https://megaeth-testnet.g.alchemy.com/v2/REDACTED_ALCHEMY_TOKEN', megaethHttpOptions),
  },
});

// Export wagmi config for hooks
export const config = wagmiAdapter.wagmiConfig;





import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { type AppKitNetwork } from '@reown/appkit/networks';
import { fallback, http } from 'viem';
import { baseSepolia, monadTestnet, arcTestnet } from './chains';

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

// Create Wagmi Adapter with custom RPC
export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
  transports: {
    // Base Sepolia: Official + PublicNode fallback with batching
    [baseSepolia.id]: fallback([
      http('https://sepolia.base.org', baseSepoliaHttpOptions),
      http('https://base-sepolia-rpc.publicnode.com', baseSepoliaHttpOptions)
    ]),
    // Monad: Fallback with retry config - start with Ankr (higher limits)
    // then QuickNode, then Foundation
    [monadTestnet.id]: fallback(
      [
        http('https://blue-stylish-friday.monad-testnet.quiknode.pro/e8b690b8d333c538f85bab9c93a2a3b512a4cb9a/', monadHttpOptions),
        http('https://rpc.ankr.com/monad_testnet', monadHttpOptions),  // 300/10s - highest
        http('https://testnet-rpc.monad.xyz', monadHttpOptions),       // 25 rps
        http('https://rpc-testnet.monadinfra.com', monadHttpOptions),  // 20 rps
      ],
      {
        rank: true,           // Rank endpoints by latency
        retryCount: 3,        // Retry across all endpoints
        retryDelay: 500,      // 500ms between fallback attempts
      }
    ),
    // Arc Testnet: Fallback with multiple RPC providers
    // Note: Arc requires minFeePerGas >= 160 Gwei
    [arcTestnet.id]: fallback(
      [
        http('https://rpc.testnet.arc.network', arcHttpOptions),
        http('https://rpc.quicknode.testnet.arc.network', arcHttpOptions),
        http('https://rpc.drpc.testnet.arc.network', arcHttpOptions),
        http('https://rpc.blockdaemon.testnet.arc.network', arcHttpOptions),
      ],
      {
        rank: true,
        retryCount: 3,
        retryDelay: 500,
      }
    ),
  },
});

// Export wagmi config for hooks
export const config = wagmiAdapter.wagmiConfig;





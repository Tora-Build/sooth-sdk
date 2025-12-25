import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { type AppKitNetwork } from '@reown/appkit/networks';
import { fallback, http } from 'viem';
import { baseSepolia, megaethFrontier } from './chains';

// Reown AppKit Project ID
export const projectId = '01ecc3f4925fa2e6a5f3f82b74487317';

// Metadata for AppKit
export const metadata = {
  name: 'Sooth Protocol',
  description: 'Prediction Markets',
  url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
  icons: ['https://avatars.githubusercontent.com/u/179229932'],
};

// Networks for AppKit
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  // IMPORTANT: use our local chain definitions for EVM networks.
  // This avoids wagmi auto-enabling Multicall3 batching in some network presets,
  // which has been observed (via NDJSON) to intermittently stall `useReadContracts`.
  baseSepolia as unknown as AppKitNetwork,
  megaethFrontier as unknown as AppKitNetwork
];

// Create Wagmi Adapter with custom RPC
export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
  transports: {
    // Prefer higher-limit public RPC; fallback to Base's official endpoint.
    [baseSepolia.id]: fallback([http('https://sepolia.base.org'), http('https://base-sepolia-rpc.publicnode.com')]),
    [megaethFrontier.id]: http('https://mainnet.megaeth.com/rpc'),
  },
});

// Export wagmi config for hooks
export const config = wagmiAdapter.wagmiConfig;





import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { type AppKitNetwork, baseSepolia } from '@reown/appkit/networks';
import { http } from 'viem';
import { megaethTestnet } from './chains';

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
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [baseSepolia, megaethTestnet];

// Create Wagmi Adapter with custom RPC to avoid WalletConnect CORS issues
// WalletConnect RPC does NOT allow browser requests (no CORS headers)
// Use Base's public RPC directly: https://sepolia.base.org
export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
    [megaethTestnet.id]: http('https://timothy.megaeth.com/rpc'),
  },
});

// Export wagmi config for hooks
export const config = wagmiAdapter.wagmiConfig;





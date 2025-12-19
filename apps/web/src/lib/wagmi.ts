import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { type AppKitNetwork, baseSepolia } from '@reown/appkit/networks';
import { http } from 'viem';
import { megaethFrontier } from './chains';

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
  baseSepolia, 
  megaethFrontier as unknown as AppKitNetwork
];

// Create Wagmi Adapter with custom RPC
export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
    [megaethFrontier.id]: http('https://mainnet.megaeth.com/rpc'),
  },
});

// Export wagmi config for hooks
export const config = wagmiAdapter.wagmiConfig;





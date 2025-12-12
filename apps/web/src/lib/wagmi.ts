import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { type AppKitNetwork, baseSepolia } from '@reown/appkit/networks';
import { http } from 'viem';
import { bnbTestnet } from './chains';

// Reown AppKit Project ID
export const projectId = '01ecc3f4925fa2e6a5f3f82b74487317';

// Metadata for AppKit
export const metadata = {
  name: 'Sooth Protocol',
  description: 'Prediction Markets',
  url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
  icons: ['https://avatars.githubusercontent.com/u/179229932'],
};

// Networks for AppKit (MegaETH hidden - RPC rate limiting)
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [baseSepolia, bnbTestnet];

// Create Wagmi Adapter with custom RPC
export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
    [bnbTestnet.id]: http('https://data-seed-prebsc-1-s1.bnbchain.org:8545'),
  },
});

// Export wagmi config for hooks
export const config = wagmiAdapter.wagmiConfig;





import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { baseSepolia } from './chains';

// Reown AppKit Project ID
export const projectId = '01ecc3f4925fa2e6a5f3f82b74487317';

// Metadata for AppKit
export const metadata = {
  name: 'Sooth Protocol',
  description: 'Prediction Markets',
  url: 'https://sooth.finance',
  icons: ['https://avatars.githubusercontent.com/u/179229932'],
};

// Networks for AppKit (EVM chains)
export const networks = [baseSepolia] as const;

// Create Wagmi Adapter
export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
});

// Export wagmi config for hooks
export const config = wagmiAdapter.wagmiConfig;

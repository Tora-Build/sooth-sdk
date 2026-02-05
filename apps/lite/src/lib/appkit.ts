import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { type AppKitNetwork } from '@reown/appkit/networks';
import { http } from 'viem';
import { monadTestnet, MONAD_TESTNET_CHAIN_ID, WALLETCONNECT_PROJECT_ID } from './config';

export const projectId = WALLETCONNECT_PROJECT_ID || '01ecc3f4925fa2e6a5f3f82b74487317';

export const metadata = {
  name: 'Sooth',
  description: 'Prediction Markets on Monad',
  url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
  icons: ['https://avatars.githubusercontent.com/u/179229932'],
};

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  monadTestnet as unknown as AppKitNetwork,
];

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
  transports: {
    [MONAD_TESTNET_CHAIN_ID]: http('https://testnet-rpc.monad.xyz', {
      retryCount: 3,
      retryDelay: 1000,
      timeout: 30_000,
    }),
  },
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

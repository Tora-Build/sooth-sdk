import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { type AppKitNetwork } from '@reown/appkit/networks';
import { http } from 'viem';
import { WALLETCONNECT_PROJECT_ID, lensMainnet, lensTestnet, LENS_MAINNET_CHAIN_ID, LENS_TESTNET_CHAIN_ID, IS_TESTNET } from './lensConfig';

export const projectId = WALLETCONNECT_PROJECT_ID || '01ecc3f4925fa2e6a5f3f82b74487317';

export const metadata = {
  name: 'Sooth',
  description: 'Prediction Markets on Lens',
  url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
  icons: ['https://avatars.githubusercontent.com/u/179229932'],
};

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = IS_TESTNET
  ? [
      lensTestnet as unknown as AppKitNetwork,
      lensMainnet as unknown as AppKitNetwork,
    ]
  : [
      lensMainnet as unknown as AppKitNetwork,
      lensTestnet as unknown as AppKitNetwork,
    ];

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
  transports: {
    [LENS_MAINNET_CHAIN_ID]: http('https://rpc.lens.xyz', {
      retryCount: 3,
      retryDelay: 1000,
      timeout: 30_000,
    }),
    [LENS_TESTNET_CHAIN_ID]: http('https://rpc.testnet.lens.xyz', {
      retryCount: 3,
      retryDelay: 1000,
      timeout: 30_000,
    }),
  },
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

import '@walletconnect/react-native-compat';

import { createAppKit } from '@reown/appkit-react-native';
import { EthersAdapter } from '@reown/appkit-ethers-react-native';
import { baseSepolia } from 'viem/chains';

const projectId = process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '';

const ethersAdapter = new EthersAdapter();

export const appKit = createAppKit({
  projectId,
  networks: [baseSepolia],
  defaultNetwork: baseSepolia,
  adapters: [ethersAdapter],
  features: {
    swaps: false,
    onramp: false,
  },
  metadata: {
    name: 'Sooth Protocol',
    description: 'Prediction Markets',
    url: 'https://sooth.markets',
    icons: ['https://sooth.markets/icon.png'],
    redirect: {
      native: 'sooth://',
    },
  },
} as any);

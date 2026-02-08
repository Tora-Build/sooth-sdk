import { defineChain } from 'viem';

export const MONAD_TESTNET_CHAIN_ID = 10143;

export const monadTestnet = defineChain({
  id: MONAD_TESTNET_CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://blue-stylish-friday.monad-testnet.quiknode.pro/REDACTED_QUICKNODE_TOKEN/'] },
  },
  blockExplorers: {
    default: { name: 'Monad Explorer', url: 'https://testnet.monadexplorer.com' },
  },
  testnet: true,
});

export const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

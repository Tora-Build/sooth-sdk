import { defineChain } from 'viem';

/**
 * Lens Chain Configuration
 */

// Testnet (default for now)
export const LENS_TESTNET_CHAIN_ID = 37111;
export const LENS_MAINNET_CHAIN_ID = 232;

// Environment-based network selection
const network = (import.meta.env.VITE_LENS_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
export const IS_TESTNET = network === 'testnet';

// Active chain configuration based on VITE_LENS_NETWORK
export const ACTIVE_LENS_CHAIN_ID = IS_TESTNET ? LENS_TESTNET_CHAIN_ID : LENS_MAINNET_CHAIN_ID;
export const ACTIVE_LENS_RPC_URL = IS_TESTNET ? 'https://rpc.testnet.lens.xyz' : 'https://rpc.lens.xyz';
export const ACTIVE_LENS_API_URL = IS_TESTNET ? 'https://api.testnet.lens.xyz/graphql' : 'https://api.lens.xyz/graphql';
export const ACTIVE_SOOTH_POST_ACTION = IS_TESTNET ? '0x7ADCc784b192Ea376820aAa28E358f156E458f84' : '';

// Legacy exports (kept for backward compatibility)
export const LENS_CHAIN_ID = ACTIVE_LENS_CHAIN_ID;
export const LENS_API_URL = ACTIVE_LENS_API_URL;
export const LENS_RPC_URL = ACTIVE_LENS_RPC_URL;

// Test App address from LENS_API_REVIEW.md
export const LENS_APP_ADDRESS = '0xC75A89145d765c396fd75CbD16380Eb184Bd2ca7';

export const lensTestnet = defineChain({
  id: LENS_TESTNET_CHAIN_ID,
  name: 'Lens Testnet',
  nativeCurrency: { name: 'GRASS', symbol: 'GRASS', decimals: 18 },
  rpcUrls: {
    default: { http: [LENS_RPC_URL] },
  },
  blockExplorers: {
    default: { name: 'Lens Explorer', url: 'https://explorer.testnet.lens.xyz' },
  },
  testnet: true,
});

export const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

export const lensMainnet = defineChain({
  id: LENS_MAINNET_CHAIN_ID,
  name: 'Lens Chain',
  nativeCurrency: { name: 'GHO', symbol: 'GHO', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.lens.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Lens Explorer', url: 'https://explorer.lens.xyz' },
  },
  testnet: false,
});

import { defineChain } from 'viem';

/**
 * Lens Chain Configuration
 */

// Testnet (default for now)
export const LENS_TESTNET_CHAIN_ID = 37111;
export const LENS_MAINNET_CHAIN_ID = 232;

// Start with testnet
export const LENS_CHAIN_ID = LENS_TESTNET_CHAIN_ID;
export const LENS_API_URL = 'https://api.testnet.lens.xyz/graphql';
export const LENS_RPC_URL = 'https://rpc.testnet.lens.xyz';

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

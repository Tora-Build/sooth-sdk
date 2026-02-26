import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { type AppKitNetwork } from '@reown/appkit/networks';
import { fallback, http } from 'viem';
import { toViemChain } from '@sooth/registry/viem';

export const projectId = '01ecc3f4925fa2e6a5f3f82b74487317';

// --- Public RPC fallbacks (no secrets) ---

const baseSepoliaPublicUrls = [
  'https://sepolia.base.org',
];

const monadTestnetPublicUrls = [
  'https://testnet-rpc.monad.xyz',
  'https://rpc.ankr.com/monad_testnet',
];

// --- HTTP transport options per chain ---

const baseSepoliaHttpOptions = {
  retryCount: 3,
  retryDelay: 3000,
  timeout: 30_000,
  batch: { batchSize: 100, wait: 50 } as const,
};

const monadHttpOptions = {
  retryCount: 3,
  retryDelay: 1000,
  timeout: 30_000,
};

// --- Transport factory (private env → public fallbacks) ---

function createTransport(publicUrls: string[], httpOptions: object, envVarName?: string) {
  const envUrl = envVarName ? import.meta.env[envVarName] : undefined;
  const urls = envUrl ? [envUrl, ...publicUrls] : publicUrls;
  const unique = [...new Set(urls)].filter(Boolean);

  if (unique.length === 1) return http(unique[0], httpOptions);
  return fallback(unique.map((url) => http(url, httpOptions)));
}

// --- Chain definitions ---

const baseSepolia = toViemChain(84532, [
  import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
]);

const monadTestnet = toViemChain(10143, [
  import.meta.env.VITE_MONAD_TESTNET_RPC_URL || 'https://testnet-rpc.monad.xyz',
]);

export const metadata = {
  name: 'sooth.market',
  description: 'Pro Trading Registry — Sooth Protocol',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://sooth.market',
  icons: ['https://avatars.githubusercontent.com/u/179229932'],
};

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  baseSepolia as unknown as AppKitNetwork,
  monadTestnet as unknown as AppKitNetwork,
];

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
  transports: {
    [baseSepolia.id]: createTransport(
      baseSepoliaPublicUrls,
      baseSepoliaHttpOptions,
      'VITE_BASE_SEPOLIA_RPC_URL',
    ),
    [monadTestnet.id]: createTransport(
      monadTestnetPublicUrls,
      monadHttpOptions,
      'VITE_MONAD_TESTNET_RPC_URL',
    ),
  },
});

export const config = wagmiAdapter.wagmiConfig;

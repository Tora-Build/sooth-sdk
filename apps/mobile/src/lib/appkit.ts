import '@walletconnect/react-native-compat';

import { createAppKit } from '@reown/appkit-react-native';
import { EthersAdapter } from '@reown/appkit-ethers-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PRIMARY_CHAIN_ID, SUPPORTED_CHAINS } from './config';
import { debugLog } from './debug';

const projectId = process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '';

const ethersAdapter = new EthersAdapter();

const storage = {
  async getKeys() {
    const keys = await AsyncStorage.getAllKeys();
    debugLog('STORAGE', 'getKeys', { count: keys.length });
    return keys;
  },
  async getEntries<T = unknown>() {
    const keys = await AsyncStorage.getAllKeys();
    if (!keys.length) {
      debugLog('STORAGE', 'getEntries', { count: 0 });
      return [];
    }
    const entries = await AsyncStorage.multiGet(keys);
    debugLog('STORAGE', 'getEntries', { count: entries.length, keys });
    return entries.map(([key, value]) => [key, parseStorageValue<T>(key, value)]);
  },
  async getItem<T = unknown>(key: string): Promise<T | undefined> {
    const value = await AsyncStorage.getItem(key);
    const parsed = parseStorageValue<T>(key, value);
    const truncatedValue = value && value.length > 50 ? value.slice(0, 50) + '...' : value;
    debugLog('STORAGE', 'getItem', { key, valuePreview: truncatedValue, parsed: typeof parsed });
    return parsed;
  },
  async setItem<T = unknown>(key: string, value: T) {
    if (value === undefined) {
      debugLog('STORAGE', 'setItem:remove', { key, reason: 'undefined value' });
      await AsyncStorage.removeItem(key);
      return;
    }
    const storedValue = typeof value === 'string' ? value : JSON.stringify(value);
    const truncatedValue = storedValue.length > 50 ? storedValue.slice(0, 50) + '...' : storedValue;
    debugLog('STORAGE', 'setItem', { key, valuePreview: truncatedValue, type: typeof value });
    await AsyncStorage.setItem(key, storedValue);
  },
  async removeItem(key: string) {
    debugLog('STORAGE', 'removeItem', { key });
    await AsyncStorage.removeItem(key);
  },
};

function parseStorageValue<T = unknown>(key: string, value: string | null): T | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  if (trimmed === 'undefined' || trimmed === 'null') return undefined;
  try {
    const parsed = JSON.parse(trimmed) as T;
    if (key.includes('expirer') && !Array.isArray(parsed)) {
      return [] as T;
    }
    if (key === '@appkit/recent_wallet' && !Array.isArray(parsed)) {
      return [] as T;
    }
    if (key === '@appkit/connected_connectors' && !Array.isArray(parsed)) {
      return [] as T;
    }
    return parsed;
  } catch {
    if (key.includes('expirer')) return [] as T;
    if (key === '@appkit/recent_wallet') return [] as T;
    if (key === '@appkit/connected_connectors') return [] as T;
    return value as unknown as T;
  }
}

export function createAppKitInstance() {
  // Mask project ID for security (show first 4 chars only)
  const maskedProjectId = projectId ? projectId.slice(0, 4) + '****' : 'MISSING';

  const config = {
    projectId,
    networks: [...SUPPORTED_CHAINS],
    defaultNetwork: SUPPORTED_CHAINS.find((chain) => chain.id === PRIMARY_CHAIN_ID) ?? SUPPORTED_CHAINS[0],
    adapters: [ethersAdapter],
    storage,
    debug: __DEV__,
    featuredWalletIds: [
      // Coinbase Wallet
      'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa',
      // Uniswap Wallet
      'c03dfee351b6fcc421b4494ea33b9d4b92a984f87aa76d1663bb28705e95034a',
      // Phantom
      'a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393',
    ],
    includeWalletIds: [
      'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // Coinbase/Base
      'c03dfee351b6fcc421b4494ea33b9d4b92a984f87aa76d1663bb28705e95034a', // Uniswap
    ],
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
        // Always use 'sooth://' - the exp+ prefix is only for Expo Go, not EAS dev builds
        native: 'sooth://',
      },
    },
  };

  debugLog('APPKIT', 'createInstance', {
    projectId: maskedProjectId,
    networksCount: config.networks.length,
    defaultNetworkId: config.defaultNetwork?.id,
    defaultNetworkName: config.defaultNetwork?.name,
    debug: config.debug,
    featuredWalletCount: config.featuredWalletIds?.length,
    includeWalletCount: config.includeWalletIds?.length,
    redirectNative: config.metadata.redirect.native,
  });

  return createAppKit(config as any);
}

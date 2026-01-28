import { create } from 'zustand';
import marketsConfig from '../config/markets.json';

export interface MarketConfig {
  id: string;
  address: string;
  name: string;
  description: string;
  category: string;
  imageUrl?: string;
  mode: 'demo' | 'live';
}

/** Raw market config from JSON - may have optional fields */
interface RawMarketConfig {
  id?: string;
  address?: string;
  name?: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  mode?: string;
}

interface MarketsConfigFile {
  version: string;
  markets: RawMarketConfig[];
}

interface MarketStore {
  markets: MarketConfig[];
  selectedMarket: MarketConfig | null;
  setSelectedMarket: (market: MarketConfig | null) => void;
  getMarketById: (id: string) => MarketConfig | undefined;
  getMarketByAddress: (address: string) => MarketConfig | undefined;
}

const typedConfig = marketsConfig as MarketsConfigFile;

const demoMarkets = (typedConfig.markets || [])
  .filter((m): m is RawMarketConfig & { mode: 'demo' } => m.mode === 'demo')
  .map((m): MarketConfig => ({
    id: m.id || '',
    address: m.address?.toLowerCase() || '',
    name: m.name || '',
    description: m.description || '',
    category: m.category || 'other',
    imageUrl: m.imageUrl,
    mode: 'demo',
  }));

export const useMarketStore = create<MarketStore>((set, get) => ({
  markets: demoMarkets,
  selectedMarket: null,
  setSelectedMarket: (market) => set({ selectedMarket: market }),
  getMarketById: (id) => get().markets.find((m) => m.id === id),
  getMarketByAddress: (address) =>
    get().markets.find((m) => m.address.toLowerCase() === address.toLowerCase()),
}));

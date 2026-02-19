/**
 * Lens Provider — demo mode with sample markets
 * 
 * Since Lens V3 SDK (with Post Actions, etc.) isn't on npm yet,
 * and there are no prediction markets on Lens yet, this shows
 * sample markets to demonstrate the UI + architecture.
 * 
 * Will connect to real Lens API when V3 SDK is available.
 */

import { LENS_CHAIN_ID } from '../lensConfig';
import type { Provider, Market } from './types';
import type { Address } from 'viem';

const SAMPLE_LENS_MARKETS: Market[] = [
  {
    address: '0x0000000000000000000000000000000000000001' as Address,
    question: 'Will Lens Chain TVL exceed $100M by Q2 2026?',
    stage: 'bonding',
    yesProbability: 0.62,
    createdAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 3),
    deadline: BigInt(Math.floor(new Date('2026-06-30').getTime() / 1000)),
    totalLPSupply: BigInt(0),
    lensPostId: 'sample-1',
    lensAuthor: 'lens/stani',
  },
  {
    address: '0x0000000000000000000000000000000000000002' as Address,
    question: 'Will Hey.xyz surpass 100K daily active users by March 2026?',
    stage: 'bonding',
    yesProbability: 0.35,
    createdAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 2),
    deadline: BigInt(Math.floor(new Date('2026-03-31').getTime() / 1000)),
    totalLPSupply: BigInt(0),
    lensPostId: 'sample-2',
    lensAuthor: 'lens/yoginth',
  },
  {
    address: '0x0000000000000000000000000000000000000003' as Address,
    question: 'Will GHO market cap reach $1B before July 2026?',
    stage: 'bonding',
    yesProbability: 0.48,
    createdAt: BigInt(Math.floor(Date.now() / 1000) - 86400),
    deadline: BigInt(Math.floor(new Date('2026-07-01').getTime() / 1000)),
    totalLPSupply: BigInt(0),
    lensPostId: 'sample-3',
    lensAuthor: 'lens/aave',
  },
  {
    address: '0x0000000000000000000000000000000000000004' as Address,
    question: 'Will a Lens-native prediction market protocol launch by April 2026?',
    stage: 'bonding',
    yesProbability: 0.78,
    createdAt: BigInt(Math.floor(Date.now() / 1000) - 3600 * 6),
    deadline: BigInt(Math.floor(new Date('2026-04-30').getTime() / 1000)),
    totalLPSupply: BigInt(0),
    lensPostId: 'sample-4',
    lensAuthor: 'lens/sooth',
  },
  {
    address: '0x0000000000000000000000000000000000000005' as Address,
    question: 'Will Firefly integrate prediction markets as a native feature?',
    stage: 'bonding',
    yesProbability: 0.55,
    createdAt: BigInt(Math.floor(Date.now() / 1000) - 3600 * 2),
    deadline: BigInt(Math.floor(new Date('2026-05-15').getTime() / 1000)),
    totalLPSupply: BigInt(0),
    lensPostId: 'sample-5',
    lensAuthor: 'lens/firefly',
  },
];

export class LensProvider implements Provider {
  name = 'Lens';
  chainId = LENS_CHAIN_ID;

  async fetchMarkets(): Promise<Market[]> {
    // Demo mode: return sample markets
    // TODO: Connect to real Lens V3 API when SDK is available
    return SAMPLE_LENS_MARKETS;
  }

  async fetchMarket(marketId: string): Promise<Market | null> {
    return SAMPLE_LENS_MARKETS.find(m => 
      m.lensPostId === marketId || m.address === marketId
    ) || null;
  }

  async checkHealth(): Promise<boolean> {
    return true; // Always healthy in demo mode
  }
}

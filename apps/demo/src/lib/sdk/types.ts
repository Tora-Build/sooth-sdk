import type { PublicClient, WalletClient, Address } from 'viem';

export type {
  OutputLine,
  OutputLineType,
  OutputCallback,
  CommandResult,
  OrderType,
  OrderResult,
  Order,
  SpotSellOrder,
  MarketState,
  MarketInfo,
  Balances,
  InternalOutcomes,
} from '@sooth/sdk-core';

export { WAD, MAX_UINT256 } from '@sooth/sdk-core';

export interface SDKConfig {
  chainId: number;
  publicClient: PublicClient;
  walletClient?: WalletClient;
  contracts: {
    MockUSDC: Address;
    LaunchpadEngine: Address;
    Collateralizer: Address;
    AMMEngine: Address;
    SoothBook?: Address;
    [contractName: string]: Address | undefined;
  };
}

export interface SDKContext {
  config: SDKConfig;
  address?: Address;
  marketKey?: `0x${string}`;
  marketAddress?: Address;
}

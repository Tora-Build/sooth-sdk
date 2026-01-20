import 'dotenv/config';
import { type Address, type Chain } from 'viem';
import { baseSepolia } from 'viem/chains';

// Custom chain definitions for testnets not in viem
const monadTestnet: Chain = {
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.monad.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Monad Explorer', url: 'https://testnet.monadexplorer.com' },
  },
};

const arcTestnet: Chain = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: { http: ['https://arc-testnet.g.alchemy.com/v2/demo'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://testnet.arcscan.io' },
  },
};

const megaethTestnet: Chain = {
  id: 6343,
  name: 'MegaETH Testnet',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://carrot.megaeth.com/rpc'] },
  },
  blockExplorers: {
    default: { name: 'MegaETH Explorer', url: 'https://megaexplorer.xyz' },
  },
};

export interface NetworkConfig {
  chain: Chain;
  contracts: {
    MockUSDC: Address;
    Collateralizer: Address;
    AMMEngine: Address;
    TickBookVault: Address;
    TickBookPoolManager: Address;
    LaunchpadEngine: Address;
  };
  rpcUrl?: string;
}

// V10.9 Contract Addresses (2026-01-19)
export const NETWORKS: Record<string, NetworkConfig> = {
  baseSepolia: {
    chain: baseSepolia,
    contracts: {
      MockUSDC: '0x2a6601d2471d9215c4572e7a02279382679c2e8a',
      Collateralizer: '0x258883fb64afe22517db08f4c6e886f4967205b9',
      AMMEngine: '0xe19c027a9407dc0eddae2d908e263d79aaf0bbe2',
      TickBookVault: '0x94a243ee73e3306a35642f23a92b78a5a8bdd0ee',
      TickBookPoolManager: '0xb94c45ed45575b48927a21601724db57dd74a94f',
      LaunchpadEngine: '0x83fcdc807e9ddc8ea823f7d43c8d0623374a2883',
    },
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL,
  },
  monadTestnet: {
    chain: monadTestnet,
    contracts: {
      MockUSDC: '0x394e0e16baf10cb2e2bb0016f854635ea80a3d23',
      Collateralizer: '0x6a6454680c547c4db7e9bb7b06cac3030ce60183',
      AMMEngine: '0x8f3e3e0309f0730c62b3fdc68bff2291308537bd',
      TickBookVault: '0x0d9c613ae45820dacfcd5aff85a98f2e650b09a9',
      TickBookPoolManager: '0xdebbf3b24b3bc6ff44888b6153c64bbd569ec90e',
      LaunchpadEngine: '0x3ae688354f831a6b37025e3f19744bd857005cca',
    },
    rpcUrl: process.env.MONAD_TESTNET_RPC_URL,
  },
  arcTestnet: {
    chain: arcTestnet,
    contracts: {
      MockUSDC: '0x805825e6af09178ea699a32a8d6cc5ca3637df80',
      Collateralizer: '0x0313af9c18e3c954f42b771a6d301fbbc6ad60a5',
      AMMEngine: '0x0f0dd0be87f6ab153e732039469fe64353b95dbb',
      TickBookVault: '0x1695ac9983f457e446d8f903d7c4061fbc7907f8',
      TickBookPoolManager: '0x8ba9751284d77ed59f46ea877577e6430bc30209',
      LaunchpadEngine: '0x625b4b2997232380126f0aecd84867086f89b27e',
    },
    rpcUrl: process.env.ARC_TESTNET_RPC_URL,
  },
  megaethTestnet: {
    chain: megaethTestnet,
    contracts: {
      MockUSDC: '0x57bda4319c306a68054f25017183030752f97d63',
      Collateralizer: '0xe928d0cf62a98f2e24e65978ae487f562749305a',
      AMMEngine: '0x61470420cc117e9460aae3bdc6cdf77c443ac09c',
      TickBookVault: '0x5b9a8b49d5616326bd61ac57b429cbf84e8cc756',
      TickBookPoolManager: '0xf52a8e9f5defcc6fe0e66b523d29ad7cfc3af530',
      LaunchpadEngine: '0xa2b2653124cb98b4d83a8a314e5e0bef2621832f',
    },
    rpcUrl: process.env.MEGAETH_TESTNET_RPC_URL,
  },
};

export function getNetwork(name: string): NetworkConfig {
  const network = NETWORKS[name];
  if (!network) {
    throw new Error(`Unknown network: ${name}. Available: ${Object.keys(NETWORKS).join(', ')}`);
  }
  return network;
}

// ABIs - minimal set needed for keeper operations
export const POOL_MANAGER_ABI = [
  {
    type: 'function',
    name: 'getAllMarketOrders',
    inputs: [{ name: 'marketKey', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAllMarketSpotSells',
    inputs: [{ name: 'marketKey', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTickLiquidity',
    inputs: [
      { name: 'marketKey', type: 'bytes32' },
      { name: 'outcome', type: 'uint8' },
      { name: 'tick', type: 'uint16' },
    ],
    outputs: [
      { name: 'rangeNet', type: 'int128' },
      { name: 'rangeGross', type: 'uint128' },
      { name: 'spotLiquidity', type: 'uint128' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getOrder',
    inputs: [
      { name: 'marketKey', type: 'bytes32' },
      { name: 'orderId', type: 'uint256' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'owner', type: 'address' },
          { name: 'outcome', type: 'uint8' },
          { name: 'tickLower', type: 'uint16' },
          { name: 'tickUpper', type: 'uint16' },
          { name: 'active', type: 'bool' },
          { name: 'liquidityRemoved', type: 'bool' },
          { name: 'sharesTotal', type: 'uint128' },
          { name: 'liquidity', type: 'uint128' },
          { name: 'collateralDepositedWad', type: 'uint128' },
          { name: 'filledShares', type: 'uint128' },
          { name: 'collateralUsedWad', type: 'uint128' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSpotSellOrder',
    inputs: [
      { name: 'marketKey', type: 'bytes32' },
      { name: 'sellId', type: 'uint256' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'owner', type: 'address' },
          { name: 'outcome', type: 'uint8' },
          { name: 'tickLower', type: 'uint16' },
          { name: 'tickUpper', type: 'uint16' },
          { name: 'active', type: 'bool' },
          { name: 'sharesTotal', type: 'uint128' },
          { name: 'filledShares', type: 'uint128' },
          { name: 'proceedsClaimedWad', type: 'uint128' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'placeOrder',
    inputs: [
      { name: 'marketKey', type: 'bytes32' },
      { name: 'outcome', type: 'uint8' },
      { name: 'shares', type: 'uint256' },
      { name: 'tickLower', type: 'uint16' },
      { name: 'tickUpper', type: 'uint16' },
      { name: 'maxCost', type: 'uint256' },
    ],
    outputs: [
      { name: 'orderId', type: 'uint256' },
      { name: 'filledShares', type: 'uint256' },
      { name: 'filledCost', type: 'uint256' },
      { name: 'restingShares', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'placeSpotSell',
    inputs: [
      { name: 'marketKey', type: 'bytes32' },
      { name: 'outcome', type: 'uint8' },
      { name: 'shares', type: 'uint256' },
      { name: 'tickLower', type: 'uint16' },
      { name: 'tickUpper', type: 'uint16' },
    ],
    outputs: [
      { name: 'sellId', type: 'uint256' },
      { name: 'filledShares', type: 'uint256' },
      { name: 'proceeds', type: 'uint256' },
      { name: 'restingShares', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getMarketInfo',
    inputs: [{ name: 'marketKey', type: 'bytes32' }],
    outputs: [
      { name: 'truthMarket', type: 'address' },
      { name: 'yesToken', type: 'address' },
      { name: 'noToken', type: 'address' },
      { name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getUserOrders',
    inputs: [
      { name: 'marketKey', type: 'bytes32' },
      { name: 'user', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPendingFills',
    inputs: [
      { name: 'marketKey', type: 'bytes32' },
      { name: 'orderId', type: 'uint256' },
    ],
    outputs: [
      { name: 'pendingShares', type: 'uint256' },
      { name: 'pendingUsdc', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'batchClaimFills',
    inputs: [
      { name: 'marketKey', type: 'bytes32' },
      { name: 'orderIds', type: 'uint256[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'batchCancelOrders',
    inputs: [
      { name: 'marketKey', type: 'bytes32' },
      { name: 'orderIds', type: 'uint256[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getUserSpotSells',
    inputs: [
      { name: 'marketKey', type: 'bytes32' },
      { name: 'user', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'cancelSpotSell',
    inputs: [
      { name: 'marketKey', type: 'bytes32' },
      { name: 'sellId', type: 'uint256' },
    ],
    outputs: [{ name: 'sharesReturned', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimSpotSellProceeds',
    inputs: [
      { name: 'marketKey', type: 'bytes32' },
      { name: 'sellId', type: 'uint256' },
    ],
    outputs: [{ name: 'proceeds', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const;

export const LAUNCHPAD_ABI = [
  {
    type: 'function',
    name: 'getMarkets',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMarketState',
    inputs: [{ name: 'market', type: 'address' }],
    outputs: [
      { name: 'creator', type: 'address' },
      { name: 'bBase', type: 'uint256' },
      { name: 'bCurrent', type: 'uint256' },
      { name: 'totalLPSupply', type: 'uint256' },
      { name: 'isGraduated', type: 'bool' },
      { name: 'floorValue', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const;

export const COLLATERALIZER_ABI = [
  {
    type: 'function',
    name: 'getOutcomeTokens',
    inputs: [{ name: 'market', type: 'address' }],
    outputs: [
      { name: 'yesToken', type: 'address' },
      { name: 'noToken', type: 'address' },
    ],
    stateMutability: 'view',
  },
] as const;

export const VAULT_ABI = [
  {
    type: 'function',
    name: 'availableUsdcWad',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'depositUsdc',
    inputs: [{ name: 'amountWad', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdrawUsdc',
    inputs: [{ name: 'amountWad', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getInternalOutcomes',
    inputs: [
      { name: 'market', type: 'address' },
      { name: 'user', type: 'address' },
    ],
    outputs: [
      { name: 'yes', type: 'uint256' },
      { name: 'no', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const;

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export const WAD = 10n ** 18n;
export const MAX_UINT256 = 2n ** 256n - 1n;
export const MIN_TICK = 1;
export const MAX_TICK = 999;

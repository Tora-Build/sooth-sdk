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

export const NETWORKS: Record<string, NetworkConfig> = {
  baseSepolia: {
    chain: baseSepolia,
    contracts: {
      MockUSDC: '0x2bba41ddbd9a10b3719c3865029ce5238ec09dac',
      Collateralizer: '0x3aeeedd2e749c6d7bbabafdfd76ad84ad6c414f1',
      AMMEngine: '0x95c0a48c38a19dcdd9b8d21b0c304154230b56b9',
      TickBookVault: '0x3727d8d586bd37cd716c1bdbc05c6c2c6b8adc5d',
      TickBookPoolManager: '0x463759fa866e6045c97cb37c25bcd74d23aa9b34',
      LaunchpadEngine: '0xdc51a2beb6ed2e65f1ee4cfa87a228b77e697a21',
    },
  },
  monadTestnet: {
    chain: monadTestnet,
    contracts: {
      MockUSDC: '0x28db001c8803ca586b3da0bfd31d8ce676aff0f0',
      Collateralizer: '0x7cbabf4a2dad48f7b5180b54adb8038a42663cb7',
      AMMEngine: '0xd18e6e7489d07e38f903e301c19f6a43650a0178',
      TickBookVault: '0xb3ea593be1a834650e2955cc8f038921f4571ffa',
      TickBookPoolManager: '0xaa3daf93c823258fe025b26be90e8a08d2abf84f',
      LaunchpadEngine: '0x9ca66ac4a00e7c380db41a714be470493bc2eee1',
    },
  },
  arcTestnet: {
    chain: arcTestnet,
    contracts: {
      MockUSDC: '0x31a1380bea9b3616956cdc05b2f3fad489803717',
      Collateralizer: '0xed16d73f5879ccf8ca1a16cfda46615fa98ef30c',
      AMMEngine: '0x3c01829ddac95f1f143c04afdcf0c2689aa979f0',
      TickBookVault: '0xadd058a6bd2bce6f1fe1cbd3c9e21250c055e242',
      TickBookPoolManager: '0xb4240ac6cc3a082d5819e9410f0eb90209a4a3f3',
      LaunchpadEngine: '0x7015ea4bdada102969f5d9eb9457e087a559cedc',
    },
  },
  megaethTestnet: {
    chain: megaethTestnet,
    contracts: {
      MockUSDC: '0x749d2d9937c10e28dd065d1f301ed485f1525f0a',
      Collateralizer: '0x86437735e952ec47884e3ff202594d8789943a81',
      AMMEngine: '0xed1ffac79bfe9a13715774d2694a0f55ed392656',
      TickBookVault: '0xb80a06cc6813c03f1b04bc969942740b7483b447',
      TickBookPoolManager: '0x7f7a84196dc38b054a6f31b2efcd7142860b37c6',
      LaunchpadEngine: '0x2de2f2e6aad4f310dc72acc6f896412ceb4706f3',
    },
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
    name: 'getMarketConfig',
    inputs: [{ name: 'market', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'creator', type: 'address' },
          { name: 'yesToken', type: 'address' },
          { name: 'noToken', type: 'address' },
          { name: 'creatorDeposit', type: 'uint256' },
          { name: 'accumulatedFees', type: 'uint256' },
          { name: 'graduated', type: 'bool' },
          { name: 'registeredInTickBook', type: 'bool' },
        ],
      },
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

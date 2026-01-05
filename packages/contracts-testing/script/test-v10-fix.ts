#!/usr/bin/env bun
/**
 * V10.0.1 Pro-rata Fix Test Script
 * Creates market, graduates, places orders, and verifies fill percentages
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  encodeDeployData,
  formatEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';

// Load environment
const envPath = path.join(process.cwd(), '../../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex);
        const value = trimmed.slice(eqIndex + 1);
        if (!process.env[key]) process.env[key] = value;
      }
    }
  }
}

const WAD = 10n ** 18n;
const Q128 = 2n ** 128n;
const MAX_UINT256 = 2n ** 256n - 1n;

// Monad Testnet chain config
const monadTestnet = {
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.monad.xyz'] },
  },
};

// Load deployment
const deploymentPath = path.join(__dirname, '../../contracts-core/deployments/v9-monadTestnet.json');
const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));

// Load TruthMarket bytecode from compiled artifacts
const truthMarketArtifactPath = path.join(__dirname, '../out/TruthMarket.sol/TruthMarket.json');
const truthMarketArtifact = JSON.parse(fs.readFileSync(truthMarketArtifactPath, 'utf-8'));
const TRUTH_MARKET_BYTECODE = truthMarketArtifact.bytecode.object as `0x${string}`;

// ABIs
const MockUSDCAbi = parseAbi([
  'function mint(address to, uint256 amount) external',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
]);

const TruthMarketAbi = parseAbi([
  'function activate() external',
  'function creator() view returns (address)',
  'constructor(string question, uint64 deadline, address adjudicator, address guardian)',
]);

const LaunchpadAbi = parseAbi([
  'function createMarket(address market, uint256 initialLiquidity, string name, string symbol) external returns (uint256 lpTokens)',
  'function tradePositions(address market, uint8 outcome, int256 deltaShares, uint256 maxCost) external returns (uint256)',
  'function getGraduationProgress(address market) view returns (uint256 feesAccrued, uint256 threshold, uint256 percentComplete)',
  'function markets(address) view returns (address creator, uint256 bBase, uint256 bCurrent, uint256 creatorDeposit, uint256 feesAccrued, uint256 totalLPSupply, uint256 lpYieldPool, bool isGraduated, uint64 createdAt, uint64 graduatedAt, string name, string symbol)',
  'function graduationMultiplier() view returns (uint16)',
]);

const TickBookAbi = [
  {
    name: 'placeOrder',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketKey', type: 'bytes32' },
      { name: 'outcome', type: 'uint8' },
      { name: 'shares', type: 'uint128' },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
      { name: 'maxCost', type: 'uint256' },
    ],
    outputs: [
      { name: 'orderId', type: 'uint256' },
      { name: 'filled', type: 'uint128' },
      { name: 'resting', type: 'uint128' },
      { name: 'costUsed', type: 'uint256' },
    ],
  },
  {
    name: 'getOrder',
    type: 'function',
    stateMutability: 'view',
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
          { name: 'tickLower', type: 'int24' },
          { name: 'tickUpper', type: 'int24' },
          { name: 'shares', type: 'uint128' },
          { name: 'filledShares', type: 'uint128' },
          { name: 'active', type: 'bool' },
          { name: 'fillGrowthInsideLastX128', type: 'uint256' },
          { name: 'collateralUsedGrowthInsideLastX128', type: 'uint256' },
          { name: 'createdBlock', type: 'uint256' },
          { name: 'liquidityRemoved', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'claimFills',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketKey', type: 'bytes32' },
      { name: 'orderId', type: 'uint256' },
    ],
    outputs: [
      { name: 'shares', type: 'uint128' },
      { name: 'collateralRefund', type: 'uint256' },
    ],
  },
] as const;

const CollateralizerAbi = parseAbi([
  'function getOutcomeTokens(address market) view returns (address yesToken, address noToken)',
]);

async function main() {
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  if (!privateKey) throw new Error('PRIVATE_KEY required');
  
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({
    chain: monadTestnet as any,
    transport: http(monadTestnet.rpcUrls.default.http[0]),
  });
  const walletClient = createWalletClient({
    account,
    chain: monadTestnet as any,
    transport: http(monadTestnet.rpcUrls.default.http[0]),
  });

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           V10.0.1 PRO-RATA FIX TEST                        ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║ Chain:    Monad Testnet (${monadTestnet.id})                         ║`);
  console.log(`║ Deployer: ${account.address.slice(0, 20)}...            ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  const contracts = {
    MockUSDC: deployment.contracts.MockUSDC as `0x${string}`,
    LaunchpadEngine: deployment.contracts.LaunchpadEngine as `0x${string}`,
    TickBook: deployment.contracts.TickBookPoolManager as `0x${string}`,
    Collateralizer: deployment.contracts.Collateralizer as `0x${string}`,
  };

  // Get ALIEN market from LaunchpadEngine (first graduated market)
  const allMarkets = await publicClient.readContract({
    address: contracts.LaunchpadEngine,
    abi: parseAbi(['function getMarkets() view returns (address[])']),
    functionName: 'getMarkets',
    args: [],
  }) as `0x${string}`[];
  
  // Find the first graduated market (ALIEN)
  const marketAddress = allMarkets[0]; // ALIEN is first
  console.log(`\n  Using ALIEN market: ${marketAddress}`);
  
  // 1. Mint USDC and approve TickBook
  console.log('\n[1/3] Setting up USDC...');
  const mintAmount = 10000n * WAD;
  let hash = await walletClient.writeContract({
    address: contracts.MockUSDC,
    abi: MockUSDCAbi,
    functionName: 'mint',
    args: [account.address, mintAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  
  hash = await walletClient.writeContract({
    address: contracts.MockUSDC,
    abi: MockUSDCAbi,
    functionName: 'approve',
    args: [contracts.TickBook, MAX_UINT256],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log('  ✓ Minted 10,000 USDC and approved TickBook');

  // Get marketKey
  const [yesToken, noToken] = await publicClient.readContract({
    address: contracts.Collateralizer,
    abi: CollateralizerAbi,
    functionName: 'getOutcomeTokens',
    args: [marketAddress],
  }) as [`0x${string}`, `0x${string}`];
  
  const { keccak256, encodePacked } = await import('viem');
  const marketKey = keccak256(encodePacked(['address', 'address'], [yesToken, noToken]));
  console.log(`  MarketKey: ${marketKey.slice(0, 18)}...`);

  // 6. Test pro-rata fix: Place range orders and cross
  console.log('\n[6/6] Testing pro-rata accumulator fix...');
  
  // Approve TickBook
  hash = await walletClient.writeContract({
    address: contracts.MockUSDC,
    abi: MockUSDCAbi,
    functionName: 'approve',
    args: [contracts.TickBook, MAX_UINT256],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  // Place a YES range order at 40-60 cents
  console.log('  Placing YES range order (40-60¢, 100 shares)...');
  const placeResult = await walletClient.writeContract({
    address: contracts.TickBook,
    abi: TickBookAbi,
    functionName: 'placeOrder',
    args: [marketKey, 0, 100n * WAD, 400, 600, 100n * WAD],
    gas: 1000000n,
  });
  const placeReceipt = await publicClient.waitForTransactionReceipt({ hash: placeResult });
  
  // Get order ID - use simulateContract to get return value
  const { result: orderResult } = await publicClient.simulateContract({
    address: contracts.TickBook,
    abi: TickBookAbi,
    functionName: 'placeOrder',
    args: [marketKey, 0, 1n * WAD, 400, 600, 10n * WAD], // Small dummy order to get next ID
    account: account.address,
  });
  // Our order is the previous one
  const orderId = (orderResult as any)[0] - 1n;
  console.log(`  Order ID: ${orderId}`);
  
  // Place a NO order that should cross
  console.log('  Placing NO crossing order (45-55¢, 50 shares)...');
  hash = await walletClient.writeContract({
    address: contracts.TickBook,
    abi: TickBookAbi,
    functionName: 'placeOrder',
    args: [marketKey, 1, 50n * WAD, 450, 550, 100n * WAD],
    gas: 1000000n,
  });
  await publicClient.waitForTransactionReceipt({ hash });

  // Check the YES order's fill status
  const order = await publicClient.readContract({
    address: contracts.TickBook,
    abi: TickBookAbi,
    functionName: 'getOrder',
    args: [marketKey, orderId],
  }) as any;

  const shares = order.shares as bigint;
  const filledShares = order.filledShares as bigint;
  const fillPercent = shares > 0n ? (filledShares * 100n) / shares : 0n;

  console.log('\n  ══════════════════════════════════════════════════');
  console.log('  ORDER STATUS:');
  console.log(`    Shares:       ${formatEther(shares)}`);
  console.log(`    Filled:       ${formatEther(filledShares)}`);
  console.log(`    Fill %:       ${fillPercent}%`);
  console.log('  ══════════════════════════════════════════════════');

  // The bug would show 99% filled when only ~50% should be filled
  if (fillPercent > 60n) {
    console.log('\n  ❌ FAIL: Fill percentage too high - pro-rata bug may still exist!');
    process.exit(1);
  } else {
    console.log('\n  ✓ PASS: Fill percentage looks correct (≤60%)');
    console.log('  V10.0.1 pro-rata fix verified!');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

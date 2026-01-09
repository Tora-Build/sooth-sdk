#!/usr/bin/env bun
/**
 * V10 Pro-rata Fix Test Script
 * Uses an existing on-chain market, places crossing orders, and sanity-checks fill percentages.
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  formatEther,
  keccak256,
  encodeAbiParameters,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';

// Load environment from repo root (.env)
const repoRoot = path.join(__dirname, '../../..');
const envPath = path.join(repoRoot, '.env');
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
const MAX_UINT256 = 2n ** 256n - 1n;

const baseSepolia = {
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sepolia.base.org'] },
  },
};

type ChainName = 'baseSepolia' | 'monadTestnet';

function getArgValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function loadDeployment(chainName: ChainName) {
  const deploymentPath = path.join(repoRoot, 'packages/contracts-core/deployments', `${chainName}.json`);
  return JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
}

// ABIs
const MockUSDCAbi = parseAbi([
  'function mint(address to, uint256 amount) external',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

const LaunchpadAbi = parseAbi([
  'function getMarkets() view returns (address[])',
  'function markets(address) view returns (address creator, uint256 bBase, uint256 bCurrent, uint256 creatorDeposit, uint256 feesAccrued, uint256 totalLPSupply, uint256 lpYieldPool, bool isGraduated, uint64 createdAt, uint64 graduatedAt, string name, string symbol)',
]);

const TickBookVaultAbi = parseAbi([
  'function depositUsdc(uint256 amountAsset) external',
  'function availableUsdcWad(address user) view returns (uint256)',
]);

const TickBookAbi = [
  {
    name: 'placeOrder',
    type: 'function',
    stateMutability: 'nonpayable',
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
  },
  {
    name: 'getNextOrderId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getPendingFills',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'marketKey', type: 'bytes32' },
      { name: 'orderId', type: 'uint256' },
    ],
    outputs: [
      { name: 'pendingShares', type: 'uint256' },
      { name: 'pendingCollateralUsed', type: 'uint256' },
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
          { name: 'outcome', type: 'uint256' },
          { name: 'tickLower', type: 'uint256' },
          { name: 'tickUpper', type: 'uint256' },
          { name: 'active', type: 'bool' },
          { name: 'liquidityRemoved', type: 'bool' },
          { name: 'sharesTotal', type: 'uint256' },
          { name: 'liquidity', type: 'uint256' },
          { name: 'collateralDepositedWad', type: 'uint256' },
          { name: 'filledShares', type: 'uint256' },
          { name: 'collateralUsedWad', type: 'uint256' },
        ],
      },
    ],
  },
] as const;

const CollateralizerAbi = parseAbi([
  'function getOutcomeTokens(address market) view returns (address yesToken, address noToken)',
]);

async function main() {
  const chainName = (getArgValue('--chain') ?? (process.env.CHAIN as string) ?? 'baseSepolia') as ChainName;
  if (chainName !== 'baseSepolia' && chainName !== 'monadTestnet') {
    throw new Error(`Unsupported chain: ${chainName}`);
  }

  if (chainName !== 'baseSepolia') {
    throw new Error(`This script run was requested for baseSepolia; got chain=${chainName}`);
  }

  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  if (!privateKey) throw new Error('PRIVATE_KEY required');
  
  const account = privateKeyToAccount(privateKey);
  const deployment = loadDeployment(chainName);

  const publicClient = createPublicClient({
    chain: baseSepolia as any,
    transport: http(baseSepolia.rpcUrls.default.http[0]),
  });
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia as any,
    transport: http(baseSepolia.rpcUrls.default.http[0]),
  });

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                V10 PRO-RATA FIX TEST                       ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║ Chain:    Base Sepolia (${baseSepolia.id})                            ║`);
  console.log(`║ Deployer: ${account.address.slice(0, 20)}...            ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  const contracts = {
    MockUSDC: deployment.contracts.MockUSDC as `0x${string}`,
    LaunchpadEngine: deployment.contracts.LaunchpadEngine as `0x${string}`,
    TickBook: deployment.contracts.TickBookPoolManager as `0x${string}`,
    TickBookVault: deployment.contracts.TickBookVault as `0x${string}`,
    Collateralizer: deployment.contracts.Collateralizer as `0x${string}`,
  };

  const allMarkets = (await publicClient.readContract({
    address: contracts.LaunchpadEngine,
    abi: LaunchpadAbi,
    functionName: 'getMarkets',
    args: [],
  })) as `0x${string}`[];

  if (!allMarkets.length) throw new Error('No markets returned by LaunchpadEngine.getMarkets()');

  let marketAddress: `0x${string}` | undefined;
  for (const m of allMarkets) {
    const state = (await publicClient.readContract({
      address: contracts.LaunchpadEngine,
      abi: LaunchpadAbi,
      functionName: 'markets',
      args: [m],
    })) as any;
    const symbol = (state as any)[11] as string;
    if (symbol === 'ALIEN') {
      marketAddress = m;
      break;
    }
  }

  marketAddress = marketAddress ?? allMarkets[0];
  console.log(`\n  Using market: ${marketAddress}`);
  
  // 1. Mint USDC, deposit to TickBookVault (required for placeOrder)
  console.log('\n[1/3] Setting up USDC + vault deposit...');
  const usdcDecimals = (await publicClient.readContract({
    address: contracts.MockUSDC,
    abi: MockUSDCAbi,
    functionName: 'decimals',
    args: [],
  })) as number;
  const mintAmountAsset = 10_000n * 10n ** BigInt(usdcDecimals);

  let hash = await walletClient.writeContract({
    address: contracts.MockUSDC,
    abi: MockUSDCAbi,
    functionName: 'mint',
    args: [account.address, mintAmountAsset],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  hash = await walletClient.writeContract({
    address: contracts.MockUSDC,
    abi: MockUSDCAbi,
    functionName: 'approve',
    args: [contracts.TickBookVault, MAX_UINT256],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  hash = await walletClient.writeContract({
    address: contracts.TickBookVault,
    abi: TickBookVaultAbi,
    functionName: 'depositUsdc',
    args: [mintAmountAsset],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  const available = (await publicClient.readContract({
    address: contracts.TickBookVault,
    abi: TickBookVaultAbi,
    functionName: 'availableUsdcWad',
    args: [account.address],
  })) as bigint;
  console.log(`  ✓ Minted + deposited: availableUsdcWad=${formatEther(available)}`);

  // Get marketKey
  const [yesToken, noToken] = await publicClient.readContract({
    address: contracts.Collateralizer,
    abi: CollateralizerAbi,
    functionName: 'getOutcomeTokens',
    args: [marketAddress],
  }) as [`0x${string}`, `0x${string}`];

  const marketKey = keccak256(
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'address' },
        { type: 'address' },
      ],
      [marketAddress, yesToken, noToken]
    )
  );
  console.log(`  MarketKey: ${marketKey.slice(0, 18)}...`);

  // 2. Place two overlapping opposite-outcome orders and ensure fill isn't absurdly high
  console.log('\n[2/3] Placing orders to exercise pro-rata accumulator...');

  // Approve TickBookVault to move funds already in-vault is not needed; orders spend from availableUsdcWad.
  // We still approve TickBook to be safe for any token interactions.
  hash = await walletClient.writeContract({
    address: contracts.MockUSDC,
    abi: MockUSDCAbi,
    functionName: 'approve',
    args: [contracts.TickBook, MAX_UINT256],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  // Pro-rata accumulator regression test (on-chain):
  // 1) Place a WIDE YES range order (large sharesTotal spread across many ticks)
  // 2) Place a tiny NO limit order that only overlaps ONE tick worth of that YES liquidity
  // If the old bug exists (using oppLiqInOverlap as denominator), the YES maker order would show near-100% pending fill.
  const yesTickLower = 1;
  const yesTickUpper = 300;
  const yesSharesTotal = 30_000n * WAD; // density = 100 shares per tick

  const noTick = 900; // implies overlapLow=overlapHigh=1000-noTick = 100
  const noShares = 100n * WAD;

  console.log(`  Placing YES range order (ticks=${yesTickLower}-${yesTickUpper}, shares=${formatEther(yesSharesTotal)})...`);
  const nextBefore = (await publicClient.readContract({
    address: contracts.TickBook,
    abi: TickBookAbi,
    functionName: 'getNextOrderId',
    args: [],
  })) as bigint;

  hash = await walletClient.writeContract({
    address: contracts.TickBook,
    abi: TickBookAbi,
    functionName: 'placeOrder',
    args: [marketKey, 1, yesSharesTotal, yesTickLower, yesTickUpper, 10_000n * WAD],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  const yesOrderId = nextBefore + 1n;
  console.log(`  YES Order ID: ${yesOrderId}`);

  // Sanity: new YES order should not have immediate fills in this scenario.
  const yesOrderBefore = (await publicClient.readContract({
    address: contracts.TickBook,
    abi: TickBookAbi,
    functionName: 'getOrder',
    args: [marketKey, yesOrderId],
  })) as any;

  if ((yesOrderBefore.filledShares as bigint) > 0n) {
    console.log(`  ⚠️  Unexpected: YES order filled immediately=${formatEther(yesOrderBefore.filledShares as bigint)}.`);
    console.log('     Aborting to avoid false signals from existing book liquidity.');
    process.exit(1);
  }

  console.log(`  Placing NO limit order (tick=${noTick}, shares=${formatEther(noShares)}) to cross 1-tick of YES liquidity...`);
  hash = await walletClient.writeContract({
    address: contracts.TickBook,
    abi: TickBookAbi,
    functionName: 'placeOrder',
    args: [marketKey, 0, noShares, noTick, noTick, 10_000n * WAD],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  // Check the YES order's fill status
  const order = await publicClient.readContract({
    address: contracts.TickBook,
    abi: TickBookAbi,
    functionName: 'getOrder',
    args: [marketKey, yesOrderId],
  }) as any;

  const pending = (await publicClient.readContract({
    address: contracts.TickBook,
    abi: TickBookAbi,
    functionName: 'getPendingFills',
    args: [marketKey, yesOrderId],
  })) as readonly [bigint, bigint];

  const shares = order.sharesTotal as bigint;
  const filledSharesClaimed = order.filledShares as bigint;
  const pendingShares = pending[0];
  const filledSharesTotal = filledSharesClaimed + pendingShares;
  const fillBps = shares > 0n ? (filledSharesTotal * 10_000n) / shares : 0n;

  console.log('\n  ══════════════════════════════════════════════════');
  console.log('  ORDER STATUS:');
  console.log(`    Shares:       ${formatEther(shares)}`);
  console.log(`    Filled:       ${formatEther(filledSharesTotal)} (claimed=${formatEther(filledSharesClaimed)}, pending=${formatEther(pendingShares)})`);
  console.log(`    Fill (bps):   ${fillBps}`);
  console.log('  ══════════════════════════════════════════════════');

  if (pendingShares == 0n) {
    console.log('\n  ❌ FAIL: pendingShares=0 (no crossing occurred, or rounding to zero)');
    process.exit(1);
  }

  // Expected: pendingShares ~= 100 shares (one tick worth of liquidity), NOT anywhere near the full 30,000.
  // The historic bug (using oppLiqInOverlap as denominator) would often make pendingShares explode toward sharesTotal.
  if (pendingShares > 1_000n * WAD) {
    console.log('\n  ❌ FAIL: pendingShares too large for a 1-tick cross (suggests pro-rata denominator bug)');
    process.exit(1);
  }

  console.log('\n  ✓ PASS: pendingShares is small (pro-rata accumulator looks healthy).');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

#!/usr/bin/env bun
/**
 * HFT Benchmark Harness for TickBook V8.1
 * 
 * Tests high-frequency trading performance on the V8.1 Hybrid Concentrated Orderbook.
 * Uses the Maker/Taker model with:
 *   - placeLimitOrder(): Makers provide liquidity across tick ranges
 *   - executeMarketOrder(): Takers execute market orders with 20bps fee
 * 
 * Measures latency, throughput (TPS), gas costs, and success rates.
 * 
 * Usage:
 *   bun run script/hft-benchmark.ts [options]
 * 
 * Options:
 *   --chain=baseSepolia|megaethFrontier|monadTestnet  Target chain (default: all)
 *   --wallets=N                                        Number of trader wallets (default: 10)
 *   --trades=N                                         Total trades to execute (default: 100)
 *   --parallel=N                                       Max parallel transactions (default: 5)
 * 
 * Environment:
 *   PRIVATE_KEY - Required (in .env or environment)
 * 
 * V8.1 Architecture:
 *   - 10,000-tick bitmap for O(1) price discovery
 *   - Unified YES/NO depth (single heatmap)
 *   - Directional sweeping: UP = buy YES, DOWN = buy NO
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  formatEther,
  type PublicClient,
  type WalletClient,
  type Chain,
  keccak256,
  encodePacked,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';

// Load .env file if present
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex);
        const value = trimmed.slice(eqIndex + 1);
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
  console.log('📁 Loaded .env file');
}

import {
  chainConfigs,
  getChainConfig,
  getAllChainNames,
  type ChainConfig,
  type DeploymentArtifact,
} from './chainConfigs.js';

// ============================================
// Constants
// ============================================

const WAD = 10n ** 18n;

// ============================================
// Contract ABIs
// ============================================

const ERC20_ABI = parseAbi([
  'function mint(address to, uint256 amount) external',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
]);

const COLLATERALIZER_ABI = parseAbi([
  'function split(address market, uint256 amount) external',
  'function getOutcomeTokens(address market) external view returns (address yesToken, address noToken)',
]);

// V8.1 TickBook ABI - Maker/Taker model
const TICKBOOK_ABI = parseAbi([
  // Market registration
  'function registerMarket(address market, address yesToken, address noToken) external returns (bytes32 marketKey)',
  'function getMarketKey(address market) external view returns (bytes32)',

  // Maker functions (Limit Orders)
  'function placeLimitOrder(bytes32 marketKey, uint16 tickLower, uint16 tickUpper, uint256 amount) external returns (uint256 yesAmount, uint256 noAmount)',
  'function cancelLimitOrder(bytes32 marketKey, uint16 tickLower, uint16 tickUpper, uint256 amount) external returns (uint256 yesAmount, uint256 noAmount)',

  // Taker functions (Market Orders)
  'function executeMarketOrder(bytes32 marketKey, bool isBuy, uint256 amountIn, uint16 limitTick) external returns (uint256 amountOut)',

  // View functions
  'function getCurrentTick(bytes32 marketKey) external view returns (uint16 tickIndex, uint256 probability)',
  'function getTickDepth(bytes32 marketKey, uint16 tick) external view returns (uint128)',
]);

// ============================================
// Benchmark Configuration
// ============================================

interface BenchmarkConfig {
  chainName: string;
  numWallets: number;
  totalTrades: number;
  maxParallel: number;
  usdcPerWallet: bigint;
  tradeSize: bigint;
  liquidityPerTick: bigint;
}

const defaultConfig: Omit<BenchmarkConfig, 'chainName'> = {
  numWallets: 10,
  totalTrades: 100,
  maxParallel: 5,
  usdcPerWallet: 10000n * WAD, // 10,000 USDC per wallet
  tradeSize: 100n * WAD,       // 100 USDC per trade
  liquidityPerTick: 1000n * WAD, // 1,000 USDC liquidity per tick
};

// ============================================
// Benchmark Results
// ============================================

interface TradeResult {
  success: boolean;
  latencyMs: number;
  gasUsed?: bigint;
  error?: string;
}

interface BenchmarkResults {
  chain: string;
  chainId: number;
  timestamp: string;
  config: BenchmarkConfig;
  setup: {
    walletsCreated: number;
    walletsFunded: number;
    liquidityAdded: boolean;
    marketKey: string;
  };
  trades: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  };
  latency: {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: {
    totalTimeMs: number;
    tps: number;
  };
  gas: {
    min: bigint;
    max: bigint;
    avg: bigint;
    total: bigint;
  };
}

// ============================================
// Wallet Management
// ============================================

interface TraderWallet {
  privateKey: `0x${string}`;
  address: `0x${string}`;
  walletClient: WalletClient;
}

function generateTraderWallets(
  chain: Chain,
  count: number
): TraderWallet[] {
  const wallets: TraderWallet[] = [];

  for (let i = 0; i < count; i++) {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(),
    });

    wallets.push({
      privateKey,
      address: account.address,
      walletClient,
    });
  }

  return wallets;
}

// ============================================
// Benchmark Execution
// ============================================

async function runBenchmark(
  config: BenchmarkConfig,
  deployment: DeploymentArtifact
): Promise<BenchmarkResults> {
  const chainConfig = getChainConfig(config.chainName);
  const chain = chainConfig.chain;

  // Get master wallet from env
  const masterKey = process.env.PRIVATE_KEY as `0x${string}`;
  const masterAccount = privateKeyToAccount(masterKey);

  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  const masterWallet = createWalletClient({
    account: masterAccount,
    chain,
    transport: http(),
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${config.chainName}] HFT BENCHMARK`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Chain ID: ${chain.id}`);
  console.log(`Master Wallet: ${masterAccount.address}`);
  console.log(`Wallets: ${config.numWallets}, Trades: ${config.totalTrades}`);

  // ============================================
  // PHASE 1: Setup Trader Wallets
  // ============================================

  console.log(`\n[${config.chainName}] Phase 1: Setting up trader wallets...`);

  const traders = generateTraderWallets(chain, config.numWallets);
  console.log(`  Created ${traders.length} trader wallets`);

  // ============================================
  // PHASE 2: Fund Wallets
  // ============================================

  console.log(`\n[${config.chainName}] Phase 2: Funding wallets...`);

  // Get gas settings for Monad (higher limits needed due to opcode repricing)
  const gasOverrides = config.chainName === 'monadTestnet' && chainConfig.gasSettings?.gasLimit
    ? { gas: chainConfig.gasSettings.gasLimit, maxFeePerGas: chainConfig.gasSettings.maxFeePerGas, maxPriorityFeePerGas: chainConfig.gasSettings.maxPriorityFeePerGas }
    : {};

  // Mint USDC to master (for distribution)
  const totalUSDCNeeded = config.usdcPerWallet * BigInt(config.numWallets) + 10000n * WAD; // extra for liquidity

  const mintHash = await masterWallet.writeContract({
    address: deployment.contracts.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'mint',
    args: [masterAccount.address, totalUSDCNeeded],
    chain,
    account: masterAccount,
    ...gasOverrides,
  });
  await publicClient.waitForTransactionReceipt({ hash: mintHash });
  console.log(`  Minted ${Number(totalUSDCNeeded / WAD)} USDC to master`);



  // Transfer USDC to each trader and some native token for gas
  let walletsFunded = 0;
  for (const trader of traders) {
    try {
      // Transfer native token for gas - vary by chain
      const gasAmount = config.chainName === 'monadTestnet'
        ? 1000000000000000000n  // 1 MON for Monad (higher gas prices)
        : 1000000000000000n;    // 0.001 ETH for other chains (minimal)
      const gasHash = await masterWallet.sendTransaction({
        to: trader.address,
        value: gasAmount,
        chain,
        account: masterAccount,
        gas: 100000n, // Simple transfer doesn't need 8M gas
        maxFeePerGas: chainConfig.gasSettings?.maxFeePerGas,
        maxPriorityFeePerGas: chainConfig.gasSettings?.maxPriorityFeePerGas,
      });
      await publicClient.waitForTransactionReceipt({ hash: gasHash });

      // Transfer USDC
      const usdcHash = await masterWallet.writeContract({
        address: deployment.contracts.MockUSDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [trader.address, config.usdcPerWallet],
        chain,
        account: masterAccount,
      });
      await publicClient.waitForTransactionReceipt({ hash: usdcHash });

      walletsFunded++;
    } catch (error) {
      console.error(`  Failed to fund wallet ${trader.address}:`, error);
    }
  }
  console.log(`  Funded ${walletsFunded}/${traders.length} wallets`);

  // ============================================
  // PHASE 3: Split USDC into Tokens
  // ============================================

  console.log(`\n[${config.chainName}] Phase 3: Splitting USDC into YES/NO tokens...`);

  const market = deployment.markets[0]; // Use first market
  const yesToken = market.yesToken as `0x${string}`;
  const noToken = market.noToken as `0x${string}`;

  for (const trader of traders) {
    try {
      // Approve Collateralizer
      const approveHash = await trader.walletClient.writeContract({
        address: deployment.contracts.MockUSDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [deployment.contracts.Collateralizer as `0x${string}`, config.usdcPerWallet],
        chain,
        account: trader.walletClient.account!,
        ...gasOverrides,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // Split into YES/NO
      const splitHash = await trader.walletClient.writeContract({
        address: deployment.contracts.Collateralizer as `0x${string}`,
        abi: COLLATERALIZER_ABI,
        functionName: 'split',
        args: [market.address as `0x${string}`, config.usdcPerWallet],
        chain,
        account: trader.walletClient.account!,
        ...gasOverrides,
      });
      await publicClient.waitForTransactionReceipt({ hash: splitHash });
    } catch (error) {
      console.error(`  Failed to split for ${trader.address}:`, error);
    }
  }
  console.log(`  Split tokens for all traders`);

  // ============================================
  // PHASE 4: Register Market with TickBook & Add Liquidity
  // ============================================

  console.log(`\n[${config.chainName}] Phase 4: Setting up TickBook liquidity...`);

  // Calculate market key
  const marketKey = keccak256(
    encodePacked(
      ['address', 'address', 'address'],
      [market.address as `0x${string}`, yesToken, noToken]
    )
  );

  // Register market with TickBook (may already be registered)
  try {
    const registerHash = await masterWallet.writeContract({
      address: deployment.contracts.TickBook as `0x${string}`,
      abi: TICKBOOK_ABI,
      functionName: 'registerMarket',
      args: [market.address as `0x${string}`, yesToken, noToken],
      chain,
      account: masterAccount,
      ...gasOverrides,
    });
    await publicClient.waitForTransactionReceipt({ hash: registerHash });
    console.log(`  Registered market with TickBook`);
  } catch (error: any) {
    const errMsg = String(error).slice(0, 150);
    if (errMsg.includes('already registered')) {
      console.log(`  Market already registered with TickBook`);
    } else {
      console.error(`  Failed to register market: ${errMsg}`);
    }
  }

  // Master splits USDC for liquidity
  const liquidityAmount = 5000n * WAD;

  const masterApproveHash = await masterWallet.writeContract({
    address: deployment.contracts.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [deployment.contracts.Collateralizer as `0x${string}`, liquidityAmount],
    chain,
    account: masterAccount,
  });
  await publicClient.waitForTransactionReceipt({ hash: masterApproveHash });

  const masterSplitHash = await masterWallet.writeContract({
    address: deployment.contracts.Collateralizer as `0x${string}`,
    abi: COLLATERALIZER_ABI,
    functionName: 'split',
    args: [market.address as `0x${string}`, liquidityAmount],
    chain,
    account: masterAccount,
  });
  await publicClient.waitForTransactionReceipt({ hash: masterSplitHash });

  // Approve TickBook for YES and NO tokens
  const yesApproveHash = await masterWallet.writeContract({
    address: yesToken,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [deployment.contracts.TickBook as `0x${string}`, liquidityAmount],
    chain,
    account: masterAccount,
  });
  await publicClient.waitForTransactionReceipt({ hash: yesApproveHash });

  const noApproveHash = await masterWallet.writeContract({
    address: noToken,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [deployment.contracts.TickBook as `0x${string}`, liquidityAmount],
    chain,
    account: masterAccount,
  });
  await publicClient.waitForTransactionReceipt({ hash: noApproveHash });

  // V8.1: Place limit orders across price ranges using Maker/Taker model
  // Place ranged limit orders at different probability bands
  const limitOrders = [
    { tickLower: 3500, tickUpper: 4500, description: '35%-45% (NO favored)' },
    { tickLower: 4500, tickUpper: 5500, description: '45%-55% (neutral)' },
    { tickLower: 5500, tickUpper: 6500, description: '55%-65% (YES favored)' },
  ];
  const liqPerRange = config.liquidityPerTick;


  for (const order of limitOrders) {
    try {
      const liqHash = await masterWallet.writeContract({
        address: deployment.contracts.TickBook as `0x${string}`,
        abi: TICKBOOK_ABI,
        functionName: 'placeLimitOrder',
        args: [marketKey, order.tickLower, order.tickUpper, liqPerRange],
        chain,
        account: masterAccount,
        ...gasOverrides,
      });
      await publicClient.waitForTransactionReceipt({ hash: liqHash });
      console.log(`  Placed limit order: ${order.description}`);
    } catch (error) {
      console.error(`  Failed to place limit order ${order.description}:`, error);
    }
  }

  // ============================================
  // PHASE 5: Approve TickBook for Traders
  // ============================================

  console.log(`\n[${config.chainName}] Phase 5: Approving TickBook for traders...`);

  for (const trader of traders) {
    try {
      // Approve YES tokens
      await trader.walletClient.writeContract({
        address: yesToken,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [deployment.contracts.TickBook as `0x${string}`, config.usdcPerWallet],
        chain,
        account: trader.walletClient.account!,
        ...gasOverrides,
      });

      // Approve NO tokens
      await trader.walletClient.writeContract({
        address: noToken,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [deployment.contracts.TickBook as `0x${string}`, config.usdcPerWallet],
        chain,
        account: trader.walletClient.account!,
        ...gasOverrides,
      });
    } catch (error) {
      console.error(`  Failed to approve for ${trader.address}:`, error);
    }
  }
  console.log(`  Approved TickBook for all traders`);

  // ============================================
  // PHASE 6: Execute Benchmark Trades
  // ============================================

  console.log(`\n[${config.chainName}] Phase 6: Executing ${config.totalTrades} benchmark trades...`);

  const results: TradeResult[] = [];
  const startTime = Date.now();

  // Create trade queue
  const tradeQueue: { trader: TraderWallet; isBuy: boolean; index: number }[] = [];
  for (let i = 0; i < config.totalTrades; i++) {
    tradeQueue.push({
      trader: traders[i % traders.length],
      isBuy: i % 2 === 0, // Alternate buy/sell
      index: i,
    });
  }

  // Execute trades in batches
  const batchSize = config.maxParallel;

  for (let i = 0; i < tradeQueue.length; i += batchSize) {
    const batch = tradeQueue.slice(i, i + batchSize);

    const batchPromises = batch.map(async ({ trader, isBuy, index }) => {
      const tradeStart = Date.now();

      try {
        // V8.1: Use executeMarketOrder (Taker model)
        // isBuy=true sweeps UP (buying YES), isBuy=false sweeps DOWN (buying NO)
        const limitTick = isBuy ? 9999 : 0; // Max slippage protection

        const hash = await trader.walletClient.writeContract({
          address: deployment.contracts.TickBook as `0x${string}`,
          abi: TICKBOOK_ABI,
          functionName: 'executeMarketOrder',
          args: [
            marketKey,
            isBuy,
            config.tradeSize,
            limitTick,
          ],
          chain,
          account: trader.walletClient.account!,
          ...gasOverrides,
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        const latencyMs = Date.now() - tradeStart;

        return {
          success: receipt.status === 'success',
          latencyMs,
          gasUsed: receipt.gasUsed,
        } as TradeResult;
      } catch (error) {
        return {
          success: false,
          latencyMs: Date.now() - tradeStart,
          error: String(error),
        } as TradeResult;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    const successCount = batchResults.filter(r => r.success).length;
    console.log(`  Batch ${Math.floor(i / batchSize) + 1}: ${successCount}/${batchResults.length} successful`);

    // Log first failure reason in batch
    const firstFail = batchResults.find(r => !r.success && r.error);
    if (firstFail && firstFail.error) {
      const shortError = firstFail.error.split('\n')[0].slice(0, 100);
      console.log(`    First error: ${shortError}`);
    }
  }

  const totalTimeMs = Date.now() - startTime;

  // ============================================
  // PHASE 7: Calculate Metrics
  // ============================================

  console.log(`\n[${config.chainName}] Phase 7: Calculating metrics...`);

  const successfulTrades = results.filter(r => r.success);
  const failedTrades = results.filter(r => !r.success);

  const latencies = successfulTrades.map(r => r.latencyMs).sort((a, b) => a - b);
  const gasValues = successfulTrades.filter(r => r.gasUsed).map(r => r.gasUsed!);

  const percentile = (arr: number[], p: number): number => {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, index)];
  };

  const avgGas = gasValues.length > 0
    ? gasValues.reduce((a, b) => a + b, 0n) / BigInt(gasValues.length)
    : 0n;

  const benchmarkResults: BenchmarkResults = {
    chain: config.chainName,
    chainId: chain.id,
    timestamp: new Date().toISOString(),
    config,
    setup: {
      walletsCreated: traders.length,
      walletsFunded,
      liquidityAdded: true,
      marketKey,
    },
    trades: {
      total: results.length,
      successful: successfulTrades.length,
      failed: failedTrades.length,
      successRate: successfulTrades.length / results.length,
    },
    latency: {
      min: latencies.length > 0 ? Math.min(...latencies) : 0,
      max: latencies.length > 0 ? Math.max(...latencies) : 0,
      avg: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
    },
    throughput: {
      totalTimeMs,
      tps: (successfulTrades.length * 1000) / totalTimeMs,
    },
    gas: {
      min: gasValues.length > 0 ? gasValues.reduce((a, b) => a < b ? a : b) : 0n,
      max: gasValues.length > 0 ? gasValues.reduce((a, b) => a > b ? a : b) : 0n,
      avg: avgGas,
      total: gasValues.reduce((a, b) => a + b, 0n),
    },
  };

  return benchmarkResults;
}

// ============================================
// Output Formatting
// ============================================

function printResults(results: BenchmarkResults): void {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`BENCHMARK RESULTS: ${results.chain}`);
  console.log(`${'═'.repeat(60)}`);

  console.log(`\n📊 TRADES`);
  console.log(`   Total:      ${results.trades.total}`);
  console.log(`   Successful: ${results.trades.successful}`);
  console.log(`   Failed:     ${results.trades.failed}`);
  console.log(`   Success %:  ${(results.trades.successRate * 100).toFixed(2)}%`);

  console.log(`\n⏱️  LATENCY (ms)`);
  console.log(`   Min:  ${results.latency.min}`);
  console.log(`   Max:  ${results.latency.max}`);
  console.log(`   Avg:  ${results.latency.avg.toFixed(2)}`);
  console.log(`   P50:  ${results.latency.p50}`);
  console.log(`   P95:  ${results.latency.p95}`);
  console.log(`   P99:  ${results.latency.p99}`);

  console.log(`\n🚀 THROUGHPUT`);
  console.log(`   Total Time: ${results.throughput.totalTimeMs}ms`);
  console.log(`   TPS:        ${results.throughput.tps.toFixed(2)}`);

  console.log(`\n⛽ GAS`);
  console.log(`   Min:   ${results.gas.min}`);
  console.log(`   Max:   ${results.gas.max}`);
  console.log(`   Avg:   ${results.gas.avg}`);
  console.log(`   Total: ${results.gas.total}`);
}

function saveResults(results: BenchmarkResults[], outputPath: string): void {
  // Convert BigInt to string for JSON serialization
  const serializable = results.map(r => ({
    ...r,
    config: {
      ...r.config,
      usdcPerWallet: r.config.usdcPerWallet.toString(),
      tradeSize: r.config.tradeSize.toString(),
      liquidityPerTick: r.config.liquidityPerTick.toString(),
    },
    gas: {
      min: r.gas.min.toString(),
      max: r.gas.max.toString(),
      avg: r.gas.avg.toString(),
      total: r.gas.total.toString(),
    },
  }));

  fs.writeFileSync(outputPath, JSON.stringify(serializable, null, 2));
  console.log(`\n📁 Results saved to: ${outputPath}`);
}

// ============================================
// Main Entry Point
// ============================================

async function main() {
  // Parse command line args
  const args = process.argv.slice(2);

  const chainArg = args.find(a => a.startsWith('--chain='));
  const walletsArg = args.find(a => a.startsWith('--wallets='));
  const tradesArg = args.find(a => a.startsWith('--trades='));
  const parallelArg = args.find(a => a.startsWith('--parallel='));

  const targetChains = chainArg
    ? chainArg.replace('--chain=', '').split(',')
    : getAllChainNames();

  const numWallets = walletsArg ? parseInt(walletsArg.replace('--wallets=', '')) : defaultConfig.numWallets;
  const totalTrades = tradesArg ? parseInt(tradesArg.replace('--trades=', '')) : defaultConfig.totalTrades;
  const maxParallel = parallelArg ? parseInt(parallelArg.replace('--parallel=', '')) : defaultConfig.maxParallel;

  // Validate private key
  if (!process.env.PRIVATE_KEY) {
    console.error('ERROR: PRIVATE_KEY environment variable required');
    console.error('Usage: PRIVATE_KEY=0x... npx ts-node script/hft-benchmark.ts [options]');
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              SOOTH PROTOCOL HFT BENCHMARK                   ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║ Chains: ${targetChains.join(', ').padEnd(51)}║`);
  console.log(`║ Wallets: ${String(numWallets).padEnd(50)}║`);
  console.log(`║ Trades: ${String(totalTrades).padEnd(51)}║`);
  console.log(`║ Parallel: ${String(maxParallel).padEnd(49)}║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  const allResults: BenchmarkResults[] = [];

  for (const chainName of targetChains) {
    // Load deployment artifact
    const deploymentPath = path.join(__dirname, `../deployments/v9-${chainName}.json`);

    if (!fs.existsSync(deploymentPath)) {
      console.error(`\n❌ Deployment not found for ${chainName}: ${deploymentPath}`);
      console.error(`   Run deploy-multichain.ts first`);
      continue;
    }

    const deployment: DeploymentArtifact = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

    const config: BenchmarkConfig = {
      chainName,
      numWallets,
      totalTrades,
      maxParallel,
      usdcPerWallet: defaultConfig.usdcPerWallet,
      tradeSize: defaultConfig.tradeSize,
      liquidityPerTick: defaultConfig.liquidityPerTick,
    };

    try {
      const results = await runBenchmark(config, deployment);
      printResults(results);
      allResults.push(results);
    } catch (error) {
      console.error(`\n❌ Benchmark failed for ${chainName}:`, error);
    }
  }

  // Save all results
  if (allResults.length > 0) {
    const outputPath = path.join(__dirname, '../deployments/benchmark-results.json');
    saveResults(allResults, outputPath);

    // Print comparison table
    if (allResults.length > 1) {
      console.log(`\n${'═'.repeat(80)}`);
      console.log('CHAIN COMPARISON');
      console.log(`${'═'.repeat(80)}`);
      console.log(`${'Chain'.padEnd(20)} | ${'TPS'.padEnd(10)} | ${'P50 (ms)'.padEnd(10)} | ${'P99 (ms)'.padEnd(10)} | ${'Success %'.padEnd(10)}`);
      console.log('-'.repeat(80));

      for (const r of allResults) {
        console.log(
          `${r.chain.padEnd(20)} | ` +
          `${r.throughput.tps.toFixed(2).padEnd(10)} | ` +
          `${String(r.latency.p50).padEnd(10)} | ` +
          `${String(r.latency.p99).padEnd(10)} | ` +
          `${(r.trades.successRate * 100).toFixed(1)}%`
        );
      }
    }
  }

  console.log('\n✅ Benchmark complete!');
}

main().catch(console.error);


#!/usr/bin/env bun
/**
 * Multi-Chain V12 Core Deployment Script
 * 
 * Deploys V12 core contracts to multiple chains:
 * - Base Sepolia (testnet)
 * - Monad Testnet
 * - Arc Testnet
 * 
 * NOTE: This script deploys CORE CONTRACTS ONLY. 
 * Use the interactive CLI or separate market scripts to create markets.
 * 
 * Usage:
 *   bun run script/deploy-multichain.ts [--chains baseSepolia,monadTestnet]
 * 
 * Environment:
 *   PRIVATE_KEY - Required (in .env or environment)
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  keccak256,
  encodePacked,
  decodeEventLog,
  parseEther,
  type Chain,
  formatEther,
  Abi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file if present

const envPaths = [
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '../../.env'),
];

for (const envPath of envPaths) {
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
    console.log(`📁 Loaded .env from ${envPath}`);
    break;
  }
}


import {
  getChainConfig,
  getAllChainNames,
  type ChainConfig,
  type DeploymentArtifact,
} from './chainConfigs.js';

const DEPLOYMENT_VERSION = 'V12.0';

// ============================================
// Seed Markets (created via LaunchpadEngine at deploy time)
// ============================================

const SEED_INITIAL_LIQUIDITY = parseEther('100'); // 100 WAD per market
const USDC_MINT_FOR_SEEDS = parseEther('1000000'); // Enough for all seed markets

const SEED_MARKETS = [
  { name: 'Will BTC hit $150k in 2026?' },
  { name: 'Will ETH flip BTC by 2027?' },
  { name: 'Will US approve a spot SOL ETF in 2026?' },
];

// ============================================
// Artifact Loading
// ============================================

interface ContractArtifact {
  abi: Abi;
  bytecode: `0x${string}`;
}

function loadArtifact(contractName: string): ContractArtifact {
  const artifactPath = path.join(__dirname, `../out/${contractName}.sol/${contractName}.json`);

  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found: ${artifactPath}. Run 'forge build' first.`);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  return {
    abi: artifact.abi,
    bytecode: artifact.bytecode.object as `0x${string}`,
  };
}

// ============================================
// Contract ABIs (inline for key interactions)
// ============================================

// ============================================
// Deployment Context
// ============================================

interface DeploymentContext {
  chainName: string;
  config: ChainConfig;
  publicClient: any;
  walletClient: any;
  deployer: `0x${string}`;
}

async function waitForContractCode(
  ctx: DeploymentContext,
  contractName: string,
  contractAddress: `0x${string}`
): Promise<void> {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const bytecode = await ctx.publicClient.getBytecode({ address: contractAddress });
    if (bytecode && bytecode !== '0x') return;
    await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }
  throw new Error(
    `[${ctx.chainName}] ${contractName} code not visible on RPC after deployment: ${contractAddress}`
  );
}

async function waitForReceipt(
  ctx: DeploymentContext,
  hash: `0x${string}`
): Promise<any> {
  const confirmations = BigInt(Math.max(1, ctx.config.deploymentConfig.confirmations));
  const timeoutMs = 30 * 60 * 1000; // 30 minutes
  const pollMs = 2000;
  const startedAt = Date.now();
  let missingTxStreak = 0;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const receipt = await ctx.publicClient.getTransactionReceipt({ hash });
      if (receipt) {
        if (confirmations <= 1n) return receipt;
        while (Date.now() - startedAt < timeoutMs) {
          const latestBlock = await ctx.publicClient.getBlockNumber();
          if (latestBlock >= receipt.blockNumber + confirmations - 1n) return receipt;
          await new Promise((resolve) => setTimeout(resolve, pollMs));
        }
      }
      missingTxStreak = 0;
    } catch {
      // Receipt missing: check whether tx is still propagated.
      try {
        const tx = await ctx.publicClient.getTransaction({ hash });
        if (tx) {
          missingTxStreak = 0;
        } else {
          missingTxStreak += 1;
        }
      } catch {
        missingTxStreak += 1;
      }

      if (missingTxStreak >= 900) {
        throw new Error(`transaction dropped before confirmation: ${hash}`);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(`Timed out waiting for transaction receipt: ${hash}`);
}

async function waitForTransactionPropagation(
  ctx: DeploymentContext,
  hash: `0x${string}`,
  timeoutMs = 60_000
): Promise<boolean> {
  const startedAt = Date.now();
  const pollMs = 1000;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const tx = await ctx.publicClient.getTransaction({ hash });
      if (tx) return true;
    } catch {
      // keep polling until propagated or timeout
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return false;
}

function applyFeeBump(
  gasOptions: Record<string, bigint | undefined>,
  attempt: number
): Record<string, bigint | undefined> {
  if (attempt === 0) return { ...gasOptions };
  const bumpFactor = 100n + BigInt(attempt * 25); // +25% per retry attempt
  const scale = (value?: bigint): bigint | undefined =>
    value ? (value * bumpFactor + 99n) / 100n : undefined;

  return {
    ...gasOptions,
    maxFeePerGas: scale(gasOptions.maxFeePerGas),
    maxPriorityFeePerGas: scale(gasOptions.maxPriorityFeePerGas),
    gasPrice: scale(gasOptions.gasPrice),
  };
}

// ============================================
// Contract Deployment
// ============================================

async function deployContract(
  ctx: DeploymentContext,
  contractName: string,
  constructorArgs: unknown[] = []
): Promise<`0x${string}`> {
  const { abi, bytecode } = loadArtifact(contractName);

  console.log(`  [${ctx.chainName}] Deploying ${contractName}...`);

  // Build gas options - spread all gas settings from config
  const gasOptions: Record<string, bigint | undefined> = {};
  if (ctx.config.gasSettings.gasLimit) gasOptions.gas = ctx.config.gasSettings.gasLimit;
  if (ctx.config.gasSettings.maxFeePerGas) gasOptions.maxFeePerGas = ctx.config.gasSettings.maxFeePerGas;
  if (ctx.config.gasSettings.maxPriorityFeePerGas) gasOptions.maxPriorityFeePerGas = ctx.config.gasSettings.maxPriorityFeePerGas;
  if (ctx.config.gasSettings.gasPrice) gasOptions.gasPrice = ctx.config.gasSettings.gasPrice;
  const nonce = await ctx.publicClient.getTransactionCount({
    address: ctx.walletClient.account!.address,
    blockTag: 'pending',
  });
  const maxAttempts = Math.max(1, ctx.config.deploymentConfig.retryAttempts);
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const attemptGasOptions = applyFeeBump(gasOptions, attempt);
      const hash = await ctx.walletClient.deployContract({
        abi,
        bytecode,
        args: constructorArgs,
        chain: ctx.config.chain,
        account: ctx.walletClient.account!,
        nonce,
        ...attemptGasOptions,
      });

      const attemptSuffix = attempt > 0 ? ` (retry ${attempt}/${maxAttempts - 1})` : '';
      console.log(`  [${ctx.chainName}] TX${attemptSuffix}: ${hash}`);

      const propagated = await waitForTransactionPropagation(ctx, hash);
      if (!propagated) {
        throw new Error(`transaction not propagated: ${hash}`);
      }

      const receipt = await waitForReceipt(ctx, hash);
      if (!receipt.contractAddress) {
        throw new Error(`Contract deployment failed: ${contractName}`);
      }

      await waitForContractCode(ctx, contractName, receipt.contractAddress);
      console.log(`  [${ctx.chainName}] ✓ ${contractName}: ${receipt.contractAddress} (block ${receipt.blockNumber})`);
      return receipt.contractAddress;
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts - 1) break;
      console.warn(
        `  [${ctx.chainName}] ⚠️ ${contractName} attempt ${attempt + 1} failed (${error instanceof Error ? error.message : String(error)}), retrying...`
      );
      await new Promise((resolve) => setTimeout(resolve, ctx.config.deploymentConfig.retryDelay));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Contract deployment failed after retries: ${contractName}`);
}

// ============================================
// Deploy Core Infrastructure
// ============================================

interface SeedMarketResult {
  address: string;
  name: string;
  marketKey: string;
}

interface CoreContracts {
  mockUSDC: `0x${string}`;
  protocolConfig: `0x${string}`;
  collateralizer: `0x${string}`;
  ammEngine: `0x${string}`;
  soothBook: `0x${string}`;
  launchpadEngine: `0x${string}`;
  seedMarkets: SeedMarketResult[];
}

async function deployCoreContracts(ctx: DeploymentContext): Promise<CoreContracts> {
  console.log(`\n[${ctx.chainName}] === Deploying Core V12 Contracts ===`);

  // 1. MockUSDC
  const mockUSDC = await deployContract(ctx, 'MockUSDC', ['Mock USDC', 'USDC']);

  // 2. ProtocolConfig
  const protocolConfig = await deployContract(ctx, 'ProtocolConfig', [ctx.deployer]);

  // 3. Collateralizer
  const collateralizer = await deployContract(ctx, 'Collateralizer', [mockUSDC]);

  // 4. AMMEngine
  const ammEngine = await deployContract(ctx, 'AMMEngine', [mockUSDC, protocolConfig, ctx.deployer]);

  // 5. SoothBook
  const soothBook = await deployContract(ctx, 'SoothBook', []);

  // 6. LaunchpadEngine
  const launchpadEngine = await deployContract(ctx, 'LaunchpadEngine', [
    mockUSDC,
    ammEngine,
    collateralizer,
    soothBook,
    protocolConfig,
    ctx.deployer, // Protocol Treasury
    ctx.deployer, // Initial owner
  ]);

  // 7. Configure Engines (Link up permissions — MUST happen before seed markets)
  console.log(`\n[${ctx.chainName}] === Configuring Engines & Permissions ===`);

  console.log(`  [${ctx.chainName}] Setting LaunchpadEngine as AMMEngine router...`);
  const setRouterHash = await ctx.walletClient.writeContract({
    address: ammEngine,
    abi: parseAbi(['function setRouter(address) external']),
    functionName: 'setRouter',
    args: [launchpadEngine],
    chain: ctx.config.chain,
    account: ctx.walletClient.account!,
    ...ctx.config.gasSettings,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash: setRouterHash });

  console.log(`  [${ctx.chainName}] Transferring SoothBook ownership to LaunchpadEngine...`);
  const transferOwnershipHash = await ctx.walletClient.writeContract({
    address: soothBook,
    abi: parseAbi(['function transferOwnership(address) external']),
    functionName: 'transferOwnership',
    args: [launchpadEngine],
    chain: ctx.config.chain,
    account: ctx.walletClient.account!,
    ...ctx.config.gasSettings,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash: transferOwnershipHash });

  // 8. Create seed markets via LaunchpadEngine (requires router + ownership set)
  console.log(`\n[${ctx.chainName}] === Creating Seed Markets via LaunchpadEngine ===`);

  const usdcAbi = parseAbi([
    'function mint(address to, uint256 amount) external',
    'function approve(address spender, uint256 amount) external returns (bool)',
  ]);

  const launchpadAbi = parseAbi([
    'function protocolConfig() external view returns (address)',
    'function createMarket(string question, uint64 startTime, uint64 deadline, address adjudicator, address guardian, uint256 initialLiquidity, uint256 adjudicatorAgentId, uint256 adjudicatorMinValidators) external returns (address market, uint256 lpTokens)',
    'event MarketCreated(address indexed market, address indexed creator, uint256 initialLiquidity, uint256 deposit, uint256 lpTokens)',
  ]);

  console.log(`  [${ctx.chainName}] Minting USDC for seed market deposits...`);
  const mintHash = await ctx.walletClient.writeContract({
    address: mockUSDC,
    abi: usdcAbi,
    functionName: 'mint',
    args: [ctx.deployer, USDC_MINT_FOR_SEEDS],
    chain: ctx.config.chain,
    account: ctx.walletClient.account!,
    ...ctx.config.gasSettings,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash: mintHash });

  console.log(`  [${ctx.chainName}] Approving LaunchpadEngine for USDC...`);
  const approveHash = await ctx.walletClient.writeContract({
    address: mockUSDC,
    abi: usdcAbi,
    functionName: 'approve',
    args: [launchpadEngine, USDC_MINT_FOR_SEEDS],
    chain: ctx.config.chain,
    account: ctx.walletClient.account!,
    ...ctx.config.gasSettings,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash: approveHash });

  const protocolConfigAddr = await ctx.publicClient.readContract({
    address: launchpadEngine,
    abi: launchpadAbi,
    functionName: 'protocolConfig',
  }) as `0x${string}`;

  const deadline = BigInt(Math.floor(Date.now() / 1000)) + BigInt(365 * 24 * 60 * 60);
  const seedMarketResults: SeedMarketResult[] = [];

  for (const seed of SEED_MARKETS) {
    console.log(`  [${ctx.chainName}] Creating market: "${seed.name}"`);

    const createHash = await ctx.walletClient.writeContract({
      address: launchpadEngine,
      abi: launchpadAbi,
      functionName: 'createMarket',
      args: [seed.name, 0n, deadline, ctx.deployer, protocolConfigAddr, SEED_INITIAL_LIQUIDITY, 0n, 0n],
      chain: ctx.config.chain,
      account: ctx.walletClient.account!,
      ...ctx.config.gasSettings,
    });

    const receipt = await ctx.publicClient.waitForTransactionReceipt({
      hash: createHash,
      confirmations: ctx.config.deploymentConfig.confirmations,
    });

    let truthMarketAddress: `0x${string}` | undefined;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: launchpadAbi, data: log.data, topics: log.topics });
        if (decoded.eventName === 'MarketCreated') {
          truthMarketAddress = (decoded.args as any).market;
          break;
        }
      } catch { /* not our event */ }
    }

    if (!truthMarketAddress) {
      throw new Error(`Failed to extract TruthMarket address for "${seed.name}"`);
    }

    const marketKey = keccak256(encodePacked(['address'], [truthMarketAddress]));
    seedMarketResults.push({ address: truthMarketAddress, name: seed.name, marketKey });
    console.log(`  [${ctx.chainName}] ✓ TruthMarket: ${truthMarketAddress} (key: ${marketKey.slice(0, 14)}...)`);
  }

  return {
    mockUSDC,
    protocolConfig,
    collateralizer,
    ammEngine,
    soothBook,
    launchpadEngine,
    seedMarkets: seedMarketResults,
  };
}

// ============================================
// Full Chain Deployment
// ============================================

function safeRpcLabel(rpcUrl: string): string {
  try {
    return new URL(rpcUrl).origin;
  } catch {
    return rpcUrl;
  }
}

async function createClientsWithFallback(opts: {
  chain: Chain;
  account: ReturnType<typeof privateKeyToAccount>;
  rpcUrls: string[];
}): Promise<{ rpcUrl: string; publicClient: any; walletClient: any }> {
  let lastError: unknown;

  for (const rpcUrl of opts.rpcUrls) {
    const publicClient = createPublicClient({
      chain: opts.chain,
      transport: http(rpcUrl),
    });

    try {
      await publicClient.getBalance({ address: opts.account.address });

      const walletClient = createWalletClient({
        account: opts.account,
        chain: opts.chain,
        transport: http(rpcUrl),
      });

      return { rpcUrl, publicClient, walletClient };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No working RPC URL found');
}

async function deployToChain(chainName: string, privateKey: `0x${string}`): Promise<DeploymentArtifact> {
  const config = getChainConfig(chainName);
  const account = privateKeyToAccount(privateKey);

  const rpcUrls = config.chain.rpcUrls.default.http;
  const { rpcUrl, publicClient, walletClient } = await createClientsWithFallback({
    chain: config.chain,
    account,
    rpcUrls,
  });

  console.log(`[${chainName}] Using RPC: ${safeRpcLabel(rpcUrl)}`);

  const ctx: DeploymentContext = {
    chainName,
    config,
    publicClient,
    walletClient,
    deployer: account.address,
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${chainName}] Starting V12 Core Deployment`);
  console.log(`[${chainName}] Chain ID: ${config.chain.id}`);
  console.log(`[${chainName}] Deployer: ${account.address}`);
  console.log(`${'='.repeat(60)}`);

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`[${chainName}] Balance: ${formatEther(balance)} ${config.chain.nativeCurrency.symbol}`);

  if (balance === 0n) {
    throw new Error(`[${chainName}] Deployer has zero balance! Fund the wallet first.`);
  }

  // Deploy core contracts only
  const core = await deployCoreContracts(ctx);

  const artifact: DeploymentArtifact = {
    chainId: config.chain.id,
    chainName,
    version: DEPLOYMENT_VERSION,
    timestamp: new Date().toISOString(),
    deployer: account.address,
    contracts: {
      MockUSDC: core.mockUSDC,
      ProtocolConfig: core.protocolConfig,
      Collateralizer: core.collateralizer,
      AMMEngine: core.ammEngine,
      SoothBook: core.soothBook,
      LaunchpadEngine: core.launchpadEngine,
    },
    markets: core.seedMarkets.map(m => ({
      address: m.address,
      name: m.name,
      symbol: '',
      yesToken: '',
      noToken: '',
      isGraduated: false,
      soothBookKey: m.marketKey,
    })),
  };

  // Save contracts-core artifact
  const artifactPath = path.join(__dirname, `../deployments/${chainName}.json`);
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
  console.log(`\n[${chainName}] ✓ Deployment artifact saved to: ${artifactPath}`);

  // Update frontend deployments.json
  const frontendPath = path.join(__dirname, '../../../apps/web/src/config/deployments.json');
  const frontendConfig: Record<string, unknown> = fs.existsSync(frontendPath)
    ? JSON.parse(fs.readFileSync(frontendPath, 'utf-8'))
    : { version: DEPLOYMENT_VERSION, networks: {} };

  (frontendConfig as any).version = DEPLOYMENT_VERSION;
  const networks = ((frontendConfig as any).networks ??= {});
  networks[chainName] = {
    chainId: config.chain.id,
    contracts: artifact.contracts,
    markets: core.seedMarkets.map(m => m.marketKey),
  };
  fs.writeFileSync(frontendPath, JSON.stringify(frontendConfig, null, 2) + '\n');
  console.log(`[${chainName}] ✓ Frontend deployments.json updated`);

  return artifact;
}

// ============================================
// Main Entry Point
// ============================================

async function main() {
  // Parse command line args
  const args = process.argv.slice(2);
  let targetChains: string[] = getAllChainNames();

  const chainsArg = args.find((a: string) => a.startsWith('--chains='));
  if (chainsArg) {
    targetChains = chainsArg.replace('--chains=', '').split(',');
  }

  // Get private key (try PRIVATE_KEY first, then PRIVATE_KEY_ALICE)
  const privateKey = (process.env.PRIVATE_KEY || process.env.PRIVATE_KEY_ALICE) as `0x${string}` | undefined;
  if (!privateKey) {
    console.error('ERROR: PRIVATE_KEY or PRIVATE_KEY_ALICE environment variable required');
    console.error('Usage: PRIVATE_KEY=0x... bun run script/deploy-multichain.ts [--chains=baseSepolia,monadTestnet]');
    process.exit(1);
  }

  // Ensure key has 0x prefix
  const formattedKey = privateKey.startsWith('0x')
    ? privateKey as `0x${string}`
    : `0x${privateKey}` as `0x${string}`;

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         SOOTH PROTOCOL V12 CORE CONTRACT DEPLOYMENT        ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║ Target Chains: ${targetChains.join(', ').padEnd(44)}║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Deploy in parallel
  const deployments = await Promise.allSettled(
    targetChains.map(chain => deployToChain(chain, formattedKey))
  );

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('DEPLOYMENT SUMMARY');
  console.log('='.repeat(60));

  for (let i = 0; i < targetChains.length; i++) {
    const chainName = targetChains[i];
    const result = deployments[i];

    if (result.status === 'fulfilled') {
      const artifact = result.value;
      console.log(`\n✅ ${chainName} (Chain ID: ${artifact.chainId})`);
      console.log(`   MockUSDC: ${artifact.contracts.MockUSDC}`);
      console.log(`   ProtocolConfig: ${artifact.contracts.ProtocolConfig}`);
      console.log(`   Collateralizer: ${artifact.contracts.Collateralizer}`);
      console.log(`   AMMEngine: ${artifact.contracts.AMMEngine}`);
      console.log(`   SoothBook: ${artifact.contracts.SoothBook}`);
      console.log(`   LaunchpadEngine: ${artifact.contracts.LaunchpadEngine}`);
    } else {
      console.log(`\n❌ ${chainName}: FAILED`);
      console.log(`   Error: ${result.reason}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Next steps:');
  console.log('1. Verify contracts on block explorers');
  console.log('2. Test seed markets via CLI: pnpm dev:cli:base');
  console.log('='.repeat(60));
}

main().catch(console.error);

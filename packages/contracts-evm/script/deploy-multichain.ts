#!/usr/bin/env bun
/**
 * Multi-Chain V9 Deployment Script
 * 
 * Deploys V9 Singleton architecture in parallel to multiple chains:
 * - Base Sepolia (testnet)
 * - MegaETH Frontier (mainnet beta)
 * - Monad Testnet
 * 
 * Includes post-deployment graduation trades for BTC market.
 * 
 * Usage:
 *   bun run script/deploy-multichain.ts [--chains baseSepolia,megaethFrontier,monadTestnet]
 * 
 * Environment:
 *   PRIVATE_KEY - Required (in .env or environment)
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  type PublicClient,
  type WalletClient,
  type Chain,
  formatEther,
  Abi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
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
  defaultMarkets,
  graduationTrades,
  type ChainConfig,
  type DeploymentArtifact,
  type MarketConfig,
} from './chainConfigs.js';

// ============================================
// Constants
// ============================================

const WAD = 10n ** 18n;
const LN2 = 693147180559945309n; // ln(2) in WAD

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

const ERC20_ABI = parseAbi([
  'function mint(address to, uint256 amount) external',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
]);

const LAUNCHPAD_ENGINE_ABI = parseAbi([
  'function createMarket(address market, uint256 initialLiquidity, string name, string symbol) external returns (uint256 lpTokens)',
  'function tradePositions(address market, uint8 outcome, int256 deltaShares, uint256 maxCost) external returns (uint256 actualCost)',
  'function getMarketState(address market) external view returns (address creator, uint256 bBase, uint256 bCurrent, uint256 totalLPSupply, bool isGraduated, uint256 floorValue)',
  'function getGraduationProgress(address market) external view returns (uint256 feesAccrued, uint256 threshold, uint256 progressBps)',
]);

const TRUTH_MARKET_ABI = parseAbi([
  'function activate() external',
  'function creator() external view returns (address)',
  'function isLive() external view returns (bool)',
]);

const COLLATERALIZER_ABI = parseAbi([
  'function registerMarket(address market, string name, string symbol) external returns (address yesToken, address noToken)',
  'function getOutcomeTokens(address market) external view returns (address yesToken, address noToken)',
  'function isMarketRegistered(address market) external view returns (bool)',
]);

const VAULT_ABI = parseAbi([
  'function setTickBook(address _tickBook) external',
]);

const POOL_MANAGER_ABI = parseAbi([
  'function setRegistrar(address _registrar) external',
]);

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

  const hash = await ctx.walletClient.deployContract({
    abi,
    bytecode,
    args: constructorArgs,
    chain: ctx.config.chain,
    account: ctx.walletClient.account!,
    ...gasOptions,
  });

  console.log(`  [${ctx.chainName}] TX: ${hash}`);

  const receipt = await ctx.publicClient.waitForTransactionReceipt({
    hash,
    confirmations: ctx.config.deploymentConfig.confirmations,
  });

  if (!receipt.contractAddress) {
    throw new Error(`Contract deployment failed: ${contractName}`);
  }

  console.log(`  [${ctx.chainName}] ✓ ${contractName}: ${receipt.contractAddress}`);
  return receipt.contractAddress;
}

// ============================================
// Deploy Core Infrastructure
// ============================================

interface CoreContracts {
  mockUSDC: `0x${string}`;
  collateralizer: `0x${string}`;
  ammEngine: `0x${string}`;
  tickBookVault: `0x${string}`;
  tickBookPoolManager: `0x${string}`;
  dynamicFeeHook: `0x${string}`;
  launchpadEngine: `0x${string}`;
}

async function deployCoreContracts(ctx: DeploymentContext): Promise<CoreContracts> {
  console.log(`\n[${ctx.chainName}] === Deploying Core V9 Contracts ===`);

  // 1. MockUSDC
  const mockUSDC = await deployContract(ctx, 'MockUSDC', ['Mock USDC', 'USDC']);

  // 2. Collateralizer
  const collateralizer = await deployContract(ctx, 'Collateralizer', [mockUSDC]);

  // 3. AMMEngine
  const ammEngine = await deployContract(ctx, 'AMMEngine', [mockUSDC, ctx.deployer]);

  // 4. Singleton TickBook Components
  const tickBookVault = await deployContract(ctx, 'TickBookVault', [mockUSDC, ctx.deployer]);
  const tickBookPoolManager = await deployContract(ctx, 'TickBookPoolManager', [tickBookVault]);
  const dynamicFeeHook = await deployContract(ctx, 'DynamicFeeHook', []);

  // 5. LaunchpadEngine
  const launchpadEngine = await deployContract(ctx, 'LaunchpadEngine', [
    mockUSDC,
    ammEngine,
    collateralizer,
    tickBookPoolManager,
    ctx.deployer, // Protocol Treasury
    ctx.deployer, // Initial owner
  ]);

  // 6. Configure Engines (Link up permissions)
  console.log(`\n[${ctx.chainName}] === Configuring Engines & Permissions ===`);

  console.log(`  [${ctx.chainName}] Linking Vault to PoolManager...`);
  const setVaultTickBookHash = await ctx.walletClient.writeContract({
    address: tickBookVault,
    abi: VAULT_ABI,
    functionName: 'setTickBook',
    args: [tickBookPoolManager],
    chain: ctx.config.chain,
    account: ctx.walletClient.account!,
    ...ctx.config.gasSettings,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash: setVaultTickBookHash });

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

  console.log(`  [${ctx.chainName}] Setting LaunchpadEngine as PoolManager registrar...`);
  const setRegistrarHash = await ctx.walletClient.writeContract({
    address: tickBookPoolManager,
    abi: POOL_MANAGER_ABI,
    functionName: 'setRegistrar',
    args: [launchpadEngine],
    chain: ctx.config.chain,
    account: ctx.walletClient.account!,
    ...ctx.config.gasSettings,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash: setRegistrarHash });

  return { mockUSDC, collateralizer, ammEngine, tickBookVault, tickBookPoolManager, dynamicFeeHook, launchpadEngine };
}

// ============================================
// Deploy Markets
// ============================================

interface DeployedMarket {
  address: `0x${string}`;
  name: string;
  symbol: string;
  yesToken: `0x${string}`;
  noToken: `0x${string}`;
  isGraduated: boolean;
  tickBookKey?: `0x${string}`;
}

async function deployMarket(
  ctx: DeploymentContext,
  core: CoreContracts,
  marketConfig: MarketConfig,
  adjudicator: `0x${string}`,
  guardian: `0x${string}`
): Promise<DeployedMarket> {
  console.log(`\n[${ctx.chainName}] --- Deploying Market: ${marketConfig.name} ---`);

  // Calculate deadline
  const deadline = BigInt(Math.floor(Date.now() / 1000) + marketConfig.deadlineDays * 24 * 60 * 60);

  // 1. Deploy TruthMarket
  const { abi: tmAbi, bytecode: tmBytecode } = loadArtifact('TruthMarket');

  const tmHash = await ctx.walletClient.deployContract({
    abi: tmAbi,
    bytecode: tmBytecode,
    args: [marketConfig.question, deadline, adjudicator, guardian],
    chain: ctx.config.chain,
    account: ctx.walletClient.account!,
    gas: ctx.config.gasSettings.gasLimit,
    ...ctx.config.gasSettings,
  });

  const tmReceipt = await ctx.publicClient.waitForTransactionReceipt({
    hash: tmHash,
    confirmations: ctx.config.deploymentConfig.confirmations,
  });

  const marketAddress = tmReceipt.contractAddress as `0x${string}`;
  console.log(`  [${ctx.chainName}] ✓ TruthMarket: ${marketAddress}`);

  // 2. Activate market
  const activateHash = await ctx.walletClient.writeContract({
    address: marketAddress,
    abi: TRUTH_MARKET_ABI,
    functionName: 'activate',
    chain: ctx.config.chain,
    account: ctx.walletClient.account!,
    ...ctx.config.gasSettings,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash: activateHash });
  console.log(`  [${ctx.chainName}] ✓ Market activated`);

  // 3. Register with Collateralizer
  const registerHash = await ctx.walletClient.writeContract({
    address: core.collateralizer,
    abi: COLLATERALIZER_ABI,
    functionName: 'registerMarket',
    args: [marketAddress, marketConfig.name, marketConfig.symbol],
    chain: ctx.config.chain,
    account: ctx.walletClient.account!,
    ...ctx.config.gasSettings,
  });
  const registerReceipt = await ctx.publicClient.waitForTransactionReceipt({ hash: registerHash });
  console.log(`  [${ctx.chainName}] registerMarket TX status: ${registerReceipt.status}`);
  if (registerReceipt.status !== 'success') {
    throw new Error(`registerMarket TX failed with status ${registerReceipt.status}: ${registerHash}`);
  }
  console.log(`  [${ctx.chainName}] ✓ Registered with Collateralizer (TX: ${registerHash})`);

  // Wait for RPC state propagation (Monad testnet needs longer wait)
  const waitTime = ctx.chainName === 'monadTestnet' ? 8000 : 2000;
  console.log(`  [${ctx.chainName}] Waiting ${waitTime / 1000}s for RPC state propagation...`);
  await new Promise(resolve => setTimeout(resolve, waitTime));

  // Get token addresses with retry for slow RPCs
  let yesToken: `0x${string}` | undefined;
  let noToken: `0x${string}` | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const tokens = await ctx.publicClient.readContract({
        address: core.collateralizer,
        abi: COLLATERALIZER_ABI,
        functionName: 'getOutcomeTokens',
        args: [marketAddress],
      }) as [`0x${string}`, `0x${string}`];
      yesToken = tokens[0];
      noToken = tokens[1];
      break;
    } catch (err) {
      console.log(`  [${ctx.chainName}] getOutcomeTokens attempt ${attempt + 1} failed, retrying in 3s...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  if (!yesToken || !noToken) {
    throw new Error(`Failed to get outcome tokens after 3 attempts for market ${marketAddress}`);
  }

  console.log(`  [${ctx.chainName}] YES Token: ${yesToken}`);
  console.log(`  [${ctx.chainName}] NO Token: ${noToken}`);

  // 4. Calculate deposit and mint USDC
  const deposit = (marketConfig.bBase * LN2) / WAD;
  const depositWithBuffer = deposit + (deposit / 10n); // 10% buffer for fees

  // Mint USDC for deposit
  const mintHash = await ctx.walletClient.writeContract({
    address: core.mockUSDC,
    abi: ERC20_ABI,
    functionName: 'mint',
    args: [ctx.deployer, depositWithBuffer],
    chain: ctx.config.chain,
    account: ctx.walletClient.account!,
    ...ctx.config.gasSettings,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash: mintHash });

  // 5. Approve LaunchpadEngine
  const approveHash = await ctx.walletClient.writeContract({
    address: core.mockUSDC,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [core.launchpadEngine, depositWithBuffer],
    chain: ctx.config.chain,
    account: ctx.walletClient.account!,
    ...ctx.config.gasSettings,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash: approveHash });

  // 6. Initialize LaunchpadEngine
  const createHash = await ctx.walletClient.writeContract({
    address: core.launchpadEngine,
    abi: LAUNCHPAD_ENGINE_ABI,
    functionName: 'createMarket',
    args: [marketAddress, marketConfig.bBase, marketConfig.name, marketConfig.symbol],
    chain: ctx.config.chain,
    account: ctx.walletClient.account!,
    ...ctx.config.gasSettings,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash: createHash });
  console.log(`  [${ctx.chainName}] ✓ LaunchpadEngine initialized`);

  return {
    address: marketAddress,
    name: marketConfig.name,
    symbol: marketConfig.symbol,
    yesToken,
    noToken,
    isGraduated: false,
  };
}

// ============================================
// Graduate Market via Trades
// ============================================

async function graduateMarket(
  ctx: DeploymentContext,
  core: CoreContracts,
  market: DeployedMarket
): Promise<void> {
  console.log(`\n[${ctx.chainName}] === Graduating Market: ${market.name} ===`);

  // Calculate total volume needed (with buffer)
  const totalVolume = 100000n * WAD; // 100k USDC for graduation trades

  // Mint USDC for trading
  console.log(`  [${ctx.chainName}] Minting 100,000 USDC for graduation trades...`);
  const gradMintHash = await ctx.walletClient.writeContract({
    address: core.mockUSDC,
    abi: ERC20_ABI,
    functionName: 'mint',
    args: [ctx.deployer, totalVolume],
    chain: ctx.config.chain,
    account: ctx.walletClient.account!,
    ...ctx.config.gasSettings,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash: gradMintHash });

  // Approve LaunchpadEngine
  const gradApproveHash = await ctx.walletClient.writeContract({
    address: core.mockUSDC,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [core.launchpadEngine, totalVolume],
    chain: ctx.config.chain,
    account: ctx.walletClient.account!,
    ...ctx.config.gasSettings,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash: gradApproveHash });

  // Execute graduation trades
  console.log(`  [${ctx.chainName}] Executing ${graduationTrades.length} graduation trades...`);

  for (let i = 0; i < graduationTrades.length; i++) {
    const deltaShares = graduationTrades[i];
    const isBuy = deltaShares > 0n;
    const absShares = isBuy ? deltaShares : -deltaShares;

    // Use large maxCost to ensure trade goes through
    const maxCost = absShares * 2n; // 200% buffer

    try {
      const tradeHash = await ctx.walletClient.writeContract({
        address: core.launchpadEngine,
        abi: LAUNCHPAD_ENGINE_ABI,
        functionName: 'tradePositions',
        args: [market.address, 1, deltaShares, maxCost], // outcome 1 = YES
        gas: 5_000_000n, // Support graduation deployment gas
        chain: ctx.config.chain,
        account: ctx.walletClient.account!,
        ...ctx.config.gasSettings,
      });
      await ctx.publicClient.waitForTransactionReceipt({ hash: tradeHash });

      const side = isBuy ? 'BUY' : 'SELL';
      console.log(`  [${ctx.chainName}] Trade ${i + 1}/${graduationTrades.length}: ${side} ${Number(absShares / WAD)} shares`);

      // Check graduation status
      const marketState = await ctx.publicClient.readContract({
        address: core.launchpadEngine,
        abi: LAUNCHPAD_ENGINE_ABI,
        functionName: 'getMarketState',
        args: [market.address],
      }) as any;

      const isGraduated = marketState[4]; // isGraduated is the 5th element (index 4)

      if (isGraduated) {
        console.log(`  [${ctx.chainName}] 🎓 Market GRADUATED after trade ${i + 1}!`);
        market.isGraduated = true;

        // Get graduation progress
        const [feesAccrued, threshold, progressBps] = await ctx.publicClient.readContract({
          address: core.launchpadEngine,
          abi: LAUNCHPAD_ENGINE_ABI,
          functionName: 'getGraduationProgress',
          args: [market.address],
        }) as [bigint, bigint, bigint];

        console.log(`  [${ctx.chainName}] Fees: ${Number(feesAccrued / WAD)} USDC, Threshold: ${Number(threshold / WAD)} USDC`);
        return;
      }
    } catch (error) {
      console.error(`  [${ctx.chainName}] Trade ${i + 1} failed:`, error);
      // Continue with next trade
    }
  }

  // Check final status
  const finalMarketState = await ctx.publicClient.readContract({
    address: core.launchpadEngine,
    abi: LAUNCHPAD_ENGINE_ABI,
    functionName: 'getMarketState',
    args: [market.address],
  }) as any;

  const finalGraduated = finalMarketState[4];

  if (finalGraduated) {
    market.isGraduated = true;
    console.log(`  [${ctx.chainName}] 🎓 Market graduated!`);
  } else {
    console.log(`  [${ctx.chainName}] ⚠️ Market NOT graduated after all trades`);
  }
}

// ============================================
// Full Chain Deployment
// ============================================

async function deployToChain(chainName: string, privateKey: `0x${string}`): Promise<DeploymentArtifact> {
  const config = getChainConfig(chainName);
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport: http(),
  });

  const ctx: DeploymentContext = {
    chainName,
    config,
    publicClient,
    walletClient,
    deployer: account.address,
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${chainName}] Starting V9 Singleton Deployment`);
  console.log(`[${chainName}] Chain ID: ${config.chain.id}`);
  console.log(`[${chainName}] Deployer: ${account.address}`);
  console.log(`${'='.repeat(60)}`);

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`[${chainName}] Balance: ${formatEther(balance)} ${config.chain.nativeCurrency.symbol}`);

  if (balance === 0n) {
    throw new Error(`[${chainName}] Deployer has zero balance! Fund the wallet first.`);
  }

  // Deploy core contracts
  const core = await deployCoreContracts(ctx);

  // Use deployer as adjudicator and guardian for testnet
  const adjudicator = ctx.deployer;
  const guardian = ctx.deployer;

  // Deploy markets
  const deployedMarkets: DeployedMarket[] = [];

  for (const marketConfig of defaultMarkets) {
    const market = await deployMarket(ctx, core, marketConfig, adjudicator, guardian);

    // Graduate if configured
    if (marketConfig.shouldGraduate) {
      await graduateMarket(ctx, core, market);
    }

    deployedMarkets.push(market);
  }

  // Create deployment artifact
  const artifact: DeploymentArtifact = {
    chainId: config.chain.id,
    chainName,
    timestamp: new Date().toISOString(),
    deployer: account.address,
    contracts: {
      MockUSDC: core.mockUSDC,
      Collateralizer: core.collateralizer,
      AMMEngine: core.ammEngine,
      TickBookVault: core.tickBookVault,
      TickBookPoolManager: core.tickBookPoolManager,
      TickBook: core.tickBookPoolManager, // Legacy alias
      LaunchpadEngine: core.launchpadEngine,
    },
    markets: deployedMarkets,
  };

  // Save artifact
  const artifactPath = path.join(__dirname, `../deployments/v9-${chainName}.json`);
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
  console.log(`\n[${chainName}] ✓ Deployment artifact saved to: ${artifactPath}`);

  return artifact;
}

// ============================================
// Main Entry Point
// ============================================

async function main() {
  // Parse command line args
  const args = process.argv.slice(2);
  let targetChains: string[] = getAllChainNames();

  const chainsArg = args.find(a => a.startsWith('--chains='));
  if (chainsArg) {
    targetChains = chainsArg.replace('--chains=', '').split(',');
  }

  // Get private key
  const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey) {
    console.error('ERROR: PRIVATE_KEY environment variable required');
    console.error('Usage: PRIVATE_KEY=0x... npx ts-node script/deploy-multichain.ts [--chains=baseSepolia,megaethFrontier,monadTestnet]');
    process.exit(1);
  }

  // Ensure key has 0x prefix
  const formattedKey = privateKey.startsWith('0x')
    ? privateKey as `0x${string}`
    : `0x${privateKey}` as `0x${string}`;

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           SOOTH PROTOCOL V9 MULTI-CHAIN DEPLOYMENT          ║');
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
      console.log(`   LaunchpadEngine: ${artifact.contracts.LaunchpadEngine}`);
      console.log(`   TickBookPoolManager: ${artifact.contracts.TickBookPoolManager}`);
      console.log(`   Markets:`);
      for (const market of artifact.markets) {
        const gradStatus = market.isGraduated ? '🎓 GRADUATED' : '📈 Pre-Grad';
        console.log(`     - ${market.name}: ${market.address} [${gradStatus}]`);
      }
    } else {
      console.log(`\n❌ ${chainName}: FAILED`);
      console.log(`   Error: ${result.reason}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Next steps:');
  console.log('1. Verify contracts on block explorers');
  console.log('2. Update frontend deployments.json');
  console.log('3. Run HFT benchmark: npx ts-node script/hft-benchmark.ts');
  console.log('='.repeat(60));
}

main().catch(console.error);



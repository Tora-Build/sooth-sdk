#!/usr/bin/env bun
/**
 * Multi-Chain V10 Core Deployment Script
 * 
 * Deploys V10 Singleton core contracts to multiple chains:
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

const DEPLOYMENT_VERSION = 'V10.8';

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

  console.log(`  [${ctx.chainName}] ✓ ${contractName}: ${receipt.contractAddress} (block ${receipt.blockNumber})`);
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
  console.log(`\n[${ctx.chainName}] === Deploying Core V10 Contracts ===`);

  // 1. MockUSDC
  const mockUSDC = await deployContract(ctx, 'MockUSDC', ['Mock USDC', 'USDC']);

  // 2. Collateralizer
  const collateralizer = await deployContract(ctx, 'Collateralizer', [mockUSDC]);

  // 3. AMMEngine
  const ammEngine = await deployContract(ctx, 'AMMEngine', [mockUSDC, ctx.deployer]);

  // 4. Singleton TickBook Components (V10 Unified Crossing)
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

  return {
    mockUSDC,
    collateralizer,
    ammEngine,
    tickBookVault,
    tickBookPoolManager,
    dynamicFeeHook,
    launchpadEngine,
  };
}

// ============================================
// Full Chain Deployment
// ============================================

async function deployToChain(chainName: string, privateKey: `0x${string}`): Promise<DeploymentArtifact> {
  const config = getChainConfig(chainName);
  const account = privateKeyToAccount(privateKey);

  // Get the RPC URL from the chain config
  const rpcUrl = config.chain.rpcUrls.default.http[0];
  console.log(`[${chainName}] Using RPC: ${rpcUrl}`);

  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport: http(rpcUrl),
  });

  const ctx: DeploymentContext = {
    chainName,
    config,
    publicClient,
    walletClient,
    deployer: account.address,
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${chainName}] Starting V10 Core Deployment`);
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

  // Create deployment artifact (no markets)
  const artifact: DeploymentArtifact = {
    chainId: config.chain.id,
    chainName,
    version: DEPLOYMENT_VERSION,
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
    markets: [], // Markets created separately via CLI or launchpad
  };

  // Save artifact
  const artifactPath = path.join(__dirname, `../deployments/${chainName}.json`);
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

  const chainsArg = args.find((a: string) => a.startsWith('--chains='));
  if (chainsArg) {
    targetChains = chainsArg.replace('--chains=', '').split(',');
  }

  // Get private key
  const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey) {
    console.error('ERROR: PRIVATE_KEY environment variable required');
    console.error('Usage: PRIVATE_KEY=0x... bun run script/deploy-multichain.ts [--chains=baseSepolia,monadTestnet]');
    process.exit(1);
  }

  // Ensure key has 0x prefix
  const formattedKey = privateKey.startsWith('0x')
    ? privateKey as `0x${string}`
    : `0x${privateKey}` as `0x${string}`;

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         SOOTH PROTOCOL V10 CORE CONTRACT DEPLOYMENT        ║');
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
      console.log(`   Collateralizer: ${artifact.contracts.Collateralizer}`);
      console.log(`   AMMEngine: ${artifact.contracts.AMMEngine}`);
      console.log(`   TickBookVault: ${artifact.contracts.TickBookVault}`);
      console.log(`   TickBookPoolManager: ${artifact.contracts.TickBookPoolManager}`);
      console.log(`   LaunchpadEngine: ${artifact.contracts.LaunchpadEngine}`);
    } else {
      console.log(`\n❌ ${chainName}: FAILED`);
      console.log(`   Error: ${result.reason}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Next steps:');
  console.log('1. Verify contracts on block explorers');
  console.log('2. Update frontend deployments.json');
  console.log('3. Create markets via CLI: pnpm interactive:monad');
  console.log('='.repeat(60));
}

main().catch(console.error);

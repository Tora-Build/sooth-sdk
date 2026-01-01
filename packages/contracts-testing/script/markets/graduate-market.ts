#!/usr/bin/env bun
/**
 * Quick script to graduate a market via trading
 */
import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from './chainConfigs';
import * as fs from 'fs';
import * as path from 'path';

// Load .env
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
        if (!process.env[key]) process.env[key] = value;
      }
    }
  }
}

const WAD = 10n ** 18n;
const MAX_UINT256 = 2n ** 256n - 1n;

// Contract addresses (Base Sepolia)
const MOCK_USDC = '0x0ed4eeb883634b7c811bec8191ee3a3cac0f3d50' as const;
const LAUNCHPAD_ENGINE = '0x63B625e2bB008699F518178E4aD2CF76EEcbd6aC' as const;
const BTC_MARKET = '0xe783ba6ACdF1Dd59032b39209bf0951A63599683' as const;

const ERC20_ABI = parseAbi([
  'function mint(address to, uint256 amount) external',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
]);

const LAUNCHPAD_ABI = parseAbi([
  'function tradePositions(address market, int256 deltaShares, uint256 maxCost) external returns (uint256 cost)',
  'function getMarketState(address market) external view returns (address, uint256, uint256, uint256, bool, uint256)',
  'function getGraduationProgress(address market) external view returns (uint256 feesAccrued, uint256 threshold, uint256 percentComplete)',
]);

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('PRIVATE_KEY not set');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log(`Deployer: ${account.address}`);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport: http(),
    account,
  });

  // Check current graduation status
  console.log('\n=== Checking graduation status ===');
  const [, , , , isGraduated] = await publicClient.readContract({
    address: LAUNCHPAD_ENGINE,
    abi: LAUNCHPAD_ABI,
    functionName: 'getMarketState',
    args: [BTC_MARKET],
  }) as [string, bigint, bigint, bigint, boolean, bigint];

  if (isGraduated) {
    console.log('✅ Market is already graduated!');
    return;
  }

  const [feesAccrued, threshold, percentComplete] = await publicClient.readContract({
    address: LAUNCHPAD_ENGINE,
    abi: LAUNCHPAD_ABI,
    functionName: 'getGraduationProgress',
    args: [BTC_MARKET],
  }) as [bigint, bigint, bigint];

  console.log(`Fees: ${Number(feesAccrued) / 1e18} USDC`);
  console.log(`Threshold: ${Number(threshold) / 1e18} USDC`);
  console.log(`Progress: ${Number(percentComplete)}%`);

  // Mint USDC
  console.log('\n=== Minting USDC ===');
  const mintAmount = 200000n * WAD; // 200k USDC
  const mintHash = await walletClient.writeContract({
    address: MOCK_USDC,
    abi: ERC20_ABI,
    functionName: 'mint',
    args: [account.address, mintAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: mintHash });
  console.log(`Minted ${Number(mintAmount / WAD)} USDC`);

  // Approve
  console.log('\n=== Approving LaunchpadEngine ===');
  const approveHash = await walletClient.writeContract({
    address: MOCK_USDC,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [LAUNCHPAD_ENGINE, MAX_UINT256],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  console.log('Approved');

  // Execute graduation trades
  console.log('\n=== Executing graduation trades ===');
  const trades = [
    15000n * WAD,   // buy 15k
    -10000n * WAD,  // sell 10k
    20000n * WAD,   // buy 20k
    -15000n * WAD,  // sell 15k
    25000n * WAD,   // buy 25k
    -20000n * WAD,  // sell 20k
    30000n * WAD,   // buy 30k
    -25000n * WAD,  // sell 25k
    35000n * WAD,   // buy 35k
  ];

  for (let i = 0; i < trades.length; i++) {
    const deltaShares = trades[i];
    const side = deltaShares > 0n ? 'BUY' : 'SELL';
    const amount = deltaShares > 0n ? deltaShares : -deltaShares;

    try {
      const tradeHash = await walletClient.writeContract({
        address: LAUNCHPAD_ENGINE,
        abi: LAUNCHPAD_ABI,
        functionName: 'tradePositions',
        args: [BTC_MARKET, deltaShares, MAX_UINT256],
      });
      await publicClient.waitForTransactionReceipt({ hash: tradeHash });
      console.log(`Trade ${i + 1}/${trades.length}: ${side} ${Number(amount / WAD)} shares`);

      // Check graduation
      const [, , , , graduated] = await publicClient.readContract({
        address: LAUNCHPAD_ENGINE,
        abi: LAUNCHPAD_ABI,
        functionName: 'getMarketState',
        args: [BTC_MARKET],
      }) as [string, bigint, bigint, bigint, boolean, bigint];

      if (graduated) {
        console.log('\n🎓 MARKET GRADUATED!');
        
        const [finalFees, finalThreshold] = await publicClient.readContract({
          address: LAUNCHPAD_ENGINE,
          abi: LAUNCHPAD_ABI,
          functionName: 'getGraduationProgress',
          args: [BTC_MARKET],
        }) as [bigint, bigint, bigint];
        
        console.log(`Final fees: ${Number(finalFees) / 1e18} USDC`);
        console.log(`Threshold: ${Number(finalThreshold) / 1e18} USDC`);
        return;
      }
    } catch (error) {
      console.error(`Trade ${i + 1} failed:`, error);
    }
  }

  // Final status
  const [finalFees, finalThreshold, finalPercent] = await publicClient.readContract({
    address: LAUNCHPAD_ENGINE,
    abi: LAUNCHPAD_ABI,
    functionName: 'getGraduationProgress',
    args: [BTC_MARKET],
  }) as [bigint, bigint, bigint];
  
  console.log(`\nFinal progress: ${Number(finalPercent)}%`);
  console.log(`Fees: ${Number(finalFees) / 1e18} / ${Number(finalThreshold) / 1e18} USDC`);
}

main().catch(console.error);

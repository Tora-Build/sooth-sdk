#!/usr/bin/env bun

/**
 * Fix Base Sepolia Market - Activate uninitiated TruthMarket
 *
 * Issue: Market was created in LaunchpadEngine but TruthMarket.activate() was never called
 * Fix: Call activate() from the creator address
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
const envPaths = [
  path.join(process.cwd(), '.env'),
  path.join(__dirname, '../../../.env'),
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
    console.log(`Loaded .env from ${envPath}`);
    break;
  }
}

const PRIVATE_KEY = process.env.PRIVATE_KEY as Address;
if (!PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY environment variable required');
}

const account = privateKeyToAccount(PRIVATE_KEY);

// The uninitiated market
const TRUTH_MARKET = '0x08a8ae8a9603acd5c7842343be172df681945d7d' as Address;

const TRUTH_MARKET_ABI = [
  {
    inputs: [],
    name: 'activate',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'state',
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'isLive',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'creator',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'question',
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
});

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
});

async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  Fix Base Sepolia Market - Activate TruthMarket║');
  console.log('╚════════════════════════════════════════════════╝\n');

  console.log(`Account:      ${account.address}`);
  console.log(`TruthMarket:  ${TRUTH_MARKET}\n`);

  // Check current state
  console.log('1️⃣  Checking current state...');

  const [question, creator, state, isLive] = await Promise.all([
    publicClient.readContract({
      address: TRUTH_MARKET,
      abi: TRUTH_MARKET_ABI,
      functionName: 'question',
    }),
    publicClient.readContract({
      address: TRUTH_MARKET,
      abi: TRUTH_MARKET_ABI,
      functionName: 'creator',
    }),
    publicClient.readContract({
      address: TRUTH_MARKET,
      abi: TRUTH_MARKET_ABI,
      functionName: 'state',
    }),
    publicClient.readContract({
      address: TRUTH_MARKET,
      abi: TRUTH_MARKET_ABI,
      functionName: 'isLive',
    }),
  ]);

  const stateNames = ['CREATED', 'LIVE', 'SETTLING', 'SETTLED'];

  console.log(`   Question:  ${question}`);
  console.log(`   Creator:   ${creator}`);
  console.log(`   State:     ${stateNames[state]} (${state})`);
  console.log(`   isLive:    ${isLive}\n`);

  if (isLive) {
    console.log('✅ Market is already live! No action needed.');
    return;
  }

  if (creator.toLowerCase() !== account.address.toLowerCase()) {
    console.error(`❌ Error: Only creator can activate the market.`);
    console.error(`   Creator: ${creator}`);
    console.error(`   Your account: ${account.address}`);
    process.exit(1);
  }

  if (state !== 0) {
    console.error(`❌ Error: Market must be in CREATED state to activate.`);
    console.error(`   Current state: ${stateNames[state]}`);
    process.exit(1);
  }

  // Activate the market
  console.log('2️⃣  Activating market...');

  const activateHash = await walletClient.writeContract({
    address: TRUTH_MARKET,
    abi: TRUTH_MARKET_ABI,
    functionName: 'activate',
  });

  console.log(`   Tx: ${activateHash}`);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: activateHash
  });

  if (receipt.status === 'success') {
    console.log(`   ✅ Transaction successful!\n`);
  } else {
    console.error(`   ❌ Transaction failed!`);
    process.exit(1);
  }

  // Verify new state (with RPC delay handling)
  console.log('3️⃣  Verifying new state (waiting for RPC propagation)...');

  // Base Sepolia can have RPC state propagation delays
  await new Promise(resolve => setTimeout(resolve, 3000));

  const [newState, newIsLive] = await Promise.all([
    publicClient.readContract({
      address: TRUTH_MARKET,
      abi: TRUTH_MARKET_ABI,
      functionName: 'state',
    }),
    publicClient.readContract({
      address: TRUTH_MARKET,
      abi: TRUTH_MARKET_ABI,
      functionName: 'isLive',
    }),
  ]);

  console.log(`   State:   ${stateNames[newState]} (${newState})`);
  console.log(`   isLive:  ${newIsLive}\n`);

  if (newIsLive) {
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║  ✅ SUCCESS - Market is now LIVE!             ║');
    console.log('╚════════════════════════════════════════════════╝\n');
    console.log('The market can now be traded on the AMM.');
    console.log('After graduation, it will be registered in PoolManager for orderbook trading.');
  } else {
    console.error('❌ Activation failed - market still not live');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});

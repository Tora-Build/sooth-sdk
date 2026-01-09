#!/usr/bin/env bun

import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    console.log(`📁 Loaded .env from ${envPath}`);
    break;
  }
}

const PRIVATE_KEY = process.env.PRIVATE_KEY as Address;
if (!PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY environment variable required');
}

const account = privateKeyToAccount(PRIVATE_KEY);

const CONTRACTS = {
  usdc: '0x937a3fae6a2b1702546e141f695d6f29df72c5cc' as Address,
  vault: '0x31a1a04ddc44957f5f0645d02f6a050e20bca6c0' as Address,
  launchpad: '0x5cec4acf4abfe1dea585bda8532b7f2fcdc52412' as Address,
  poolManager: '0x2f3464ca4a50a522786c3e72df94f12b02eec46b' as Address,
};

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
});

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
});

const TRUTH_MARKET_BYTECODE = await (async () => {
  const artifactPath = path.join(__dirname, '../out/TruthMarket.sol/TruthMarket.json');
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
  return artifact.bytecode.object;
})();

const TRUTH_MARKET_ABI = await (async () => {
  const artifactPath = path.join(__dirname, '../out/TruthMarket.sol/TruthMarket.json');
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
  return artifact.abi;
})();

async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  Create Market on Base Sepolia (V10.7)        ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  const QUESTION = 'Will Bitcoin reach $100k in 2025?';
  const DEADLINE = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60);
  const INITIAL_LIQUIDITY = parseEther('100');

  console.log(`Account: ${account.address}`);
  console.log(`Question: ${QUESTION}`);
  console.log(`Deadline: ${new Date(Number(DEADLINE) * 1000).toISOString()}`);
  console.log(`Initial Liquidity: 100 WAD\n`);

  console.log('1️⃣  Deploying TruthMarket contract...');
  const truthMarketHash = await walletClient.deployContract({
    abi: TRUTH_MARKET_ABI,
    bytecode: TRUTH_MARKET_BYTECODE as `0x${string}`,
    args: [
      QUESTION,
      DEADLINE,
      account.address,
      account.address,
    ],
  });

  const truthMarketReceipt = await publicClient.waitForTransactionReceipt({ 
    hash: truthMarketHash 
  });

  const truthMarket = truthMarketReceipt.contractAddress;
  if (!truthMarket) {
    throw new Error('Failed to deploy TruthMarket');
  }

  console.log(`   ✅ TruthMarket deployed: ${truthMarket}`);
  console.log(`   📝 Tx: ${truthMarketHash}\n`);

  console.log('2️⃣  Minting USDC...');
  const mintHash = await walletClient.writeContract({
    address: CONTRACTS.usdc,
    abi: [
      {
        inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
        name: 'mint',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    functionName: 'mint',
    args: [account.address, parseEther('1000000')],
  });
  await publicClient.waitForTransactionReceipt({ hash: mintHash });
  console.log(`   ✅ Minted 1,000,000 USDC\n`);

  console.log('3️⃣  Approving Vault...');
  const approveHash = await walletClient.writeContract({
    address: CONTRACTS.usdc,
    abi: [
      {
        inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
        name: 'approve',
        outputs: [{ type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    functionName: 'approve',
    args: [CONTRACTS.vault, parseEther('1000000')],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  console.log(`   ✅ Vault approved\n`);

  console.log('4️⃣  Depositing to Vault...');
  const depositHash = await walletClient.writeContract({
    address: CONTRACTS.vault,
    abi: [
      {
        inputs: [{ name: 'amountWad', type: 'uint256' }],
        name: 'depositUsdc',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    functionName: 'depositUsdc',
    args: [parseEther('10000')],
  });
  await publicClient.waitForTransactionReceipt({ hash: depositHash });
  console.log(`   ✅ Deposited 10,000 USDC\n`);

  console.log('5️⃣  Creating market in LaunchpadEngine...');
  const createMarketHash = await walletClient.writeContract({
    address: CONTRACTS.launchpad,
    abi: [
      {
        inputs: [
          { name: 'market', type: 'address' },
          { name: 'initialLiquidity', type: 'uint256' },
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
        ],
        name: 'createMarket',
        outputs: [{ name: 'lpTokens', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    functionName: 'createMarket',
    args: [truthMarket, INITIAL_LIQUIDITY, 'BTC100K', 'BTC100K-YES/NO'],
  });

  await publicClient.waitForTransactionReceipt({ hash: createMarketHash });
  console.log(`   ✅ Market created in LaunchpadEngine\n`);

  console.log('6️⃣  Registering market in PoolManager...');
  const registerHash = await walletClient.writeContract({
    address: CONTRACTS.poolManager,
    abi: [
      {
        inputs: [{ name: 'truthMarket', type: 'address' }],
        name: 'registerMarket',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    functionName: 'registerMarket',
    args: [truthMarket],
  });

  await publicClient.waitForTransactionReceipt({ hash: registerHash });
  console.log(`   ✅ Market registered in PoolManager\n`);

  console.log('7️⃣  Getting market key...');
  const marketKey = await publicClient.readContract({
    address: CONTRACTS.poolManager,
    abi: [
      {
        inputs: [{ name: 'truthMarket', type: 'address' }],
        name: 'getMarketKey',
        outputs: [{ name: '', type: 'bytes32' }],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    functionName: 'getMarketKey',
    args: [truthMarket],
  });

  console.log(`   🔑 Market Key: ${marketKey}\n`);

  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  ✅ SUCCESS - Base Sepolia Market Created      ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  console.log(`Question:      ${QUESTION}`);
  console.log(`TruthMarket:   ${truthMarket}`);
  console.log(`Market Key:    ${marketKey}`);
  console.log(`Chain:         Base Sepolia (84532)`);
  console.log(`\nIndexer should pick this up automatically! 🎉`);
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});

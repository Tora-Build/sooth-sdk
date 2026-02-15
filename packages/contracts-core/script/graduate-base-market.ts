#!/usr/bin/env bun

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

const TRUTH_MARKET = '0x08a8ae8a9603acd5c7842343be172df681945d7d' as Address;
const LAUNCHPAD = '0x5cec4acf4abfe1dea585bda8532b7f2fcdc52412' as Address;

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
  console.log('║  Graduate Base Sepolia Market (V12)            ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  console.log(`TruthMarket: ${TRUTH_MARKET}`);
  console.log(`Launchpad:   ${LAUNCHPAD}\n`);

  console.log('🎓 Graduating market...');
  const graduateHash = await walletClient.writeContract({
    address: LAUNCHPAD,
    abi: [
      {
        inputs: [{ name: 'market', type: 'address' }],
        name: 'graduateMarket',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    functionName: 'graduateMarket',
    args: [TRUTH_MARKET],
  });

  await publicClient.waitForTransactionReceipt({ hash: graduateHash });
  console.log(`   ✅ Graduated - tx: ${graduateHash}\n`);

  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  ✅ SUCCESS - Market Graduated!                ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  console.log('Market is now in orderbook (SoothBook) phase');
  console.log('Indexer should pick it up within ~10 seconds! 🎉');
  console.log('');
  console.log('Check with: curl "http://localhost:42069/markets/84532"');
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});

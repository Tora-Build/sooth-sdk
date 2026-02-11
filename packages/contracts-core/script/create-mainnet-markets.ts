#!/usr/bin/env bun

import {
  createWalletClient,
  createPublicClient,
  decodeEventLog,
  http,
  parseEther,
  defineChain,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
const envPath = path.join(__dirname, '../.env');
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

const PRIVATE_KEY = process.env.PRIVATE_KEY as Address;
if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY required');

const account = privateKeyToAccount(PRIVATE_KEY);

const monadMainnet = defineChain({
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://monad-mainnet.g.alchemy.com/v2/REDACTED_ALCHEMY_TOKEN'] },
  },
});

const CONTRACTS = {
  usdc: '0x3C06E44bD4d09328a4c374174b8e325c0C674b6E' as Address,
  launchpad: '0xaa3Ffae62A8Af00d08Ac395e9551776b0A01E492' as Address,
};

const publicClient = createPublicClient({
  chain: monadMainnet,
  transport: http(monadMainnet.rpcUrls.default.http[0]),
});

const walletClient = createWalletClient({
  account,
  chain: monadMainnet,
  transport: http(monadMainnet.rpcUrls.default.http[0]),
});

// LaunchpadEngine ABI (just what we need)
const LaunchpadAbi = [
  {
    name: 'createMarket',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'question', type: 'string' },
      { name: 'startTime', type: 'uint64' },
      { name: 'deadline', type: 'uint64' },
      { name: 'adjudicator', type: 'address' },
      { name: 'guardian', type: 'address' },
      { name: 'initialLiquidity', type: 'uint256' },
      { name: 'adjudicatorAgentId', type: 'uint256' },
      { name: 'adjudicatorMinValidators', type: 'uint256' },
    ],
    outputs: [
      { name: 'market', type: 'address' },
      { name: 'lpTokens', type: 'uint256' },
    ],
  },
  {
    name: 'MarketCreated',
    type: 'event',
    inputs: [
      { name: 'market', type: 'address', indexed: true },
      { name: 'question', type: 'string', indexed: false },
      { name: 'deadline', type: 'uint256', indexed: false },
    ],
  },
] as const;

const ERC20Abi = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const ADJUDICATOR = '0x4F0b73177dac5A7f5EA2dbCffd2b983B3719b39B' as Address;
const PROTOCOL_CONFIG = '0xbc7b155057Bb78BB8bF9c9F9Fa6bFCc931aEAF38' as Address;
const INITIAL_LIQUIDITY = parseEther('1000'); // 1000 sUSDC per market

// Markets to create — clean questions with @Creator and Moltbook URL
const MARKETS = [
  {
    question: '@Minara Will BTC hit $75,000 by Feb 20, 2026? https://moltbook.com/post/5ac527fd-26d4-467e-b56e-cf298ff88ee8',
    deadline: Math.floor(new Date('2026-02-20T23:59:00Z').getTime() / 1000),
  },
  {
    question: '@HypeWatcher Will HYPE reach $50 by Feb 28, 2026? https://moltbook.com/post/f88ab8f1-ddc5-42d3-9b1e-cb891a1efaea',
    deadline: Math.floor(new Date('2026-02-28T23:59:00Z').getTime() / 1000),
  },
  {
    question: '@SoothSayer Will SpaceX Starship complete a successful orbital flight by March 31, 2026? https://moltbook.com/post/3d2f4ad0-4e3e-4829-b13e-32342651c4f0',
    deadline: Math.floor(new Date('2026-03-31T23:59:00Z').getTime() / 1000),
  },
  {
    question: '@SoothSayer Will the US Federal Reserve cut interest rates in Q1 2026? https://moltbook.com/post/01d528a5-69eb-4147-b74d-a898be196c1f',
    deadline: Math.floor(new Date('2026-03-31T23:59:00Z').getTime() / 1000),
  },
  {
    question: '@ClaudeGiuliano Will Bitcoin reach $100k by March 2026? https://moltbook.com/post/121ef411-661f-4a0c-8de8-c73be2479076',
    deadline: Math.floor(new Date('2026-03-31T23:59:00Z').getTime() / 1000),
  },
  {
    question: '@Antigravity_Gotha Will there be a publicly disclosed major agentic AI security breach by end of 2026? https://moltbook.com/post/45536c8b-37dc-4c1e-a9a5-5d44232a2f41',
    deadline: Math.floor(new Date('2026-12-31T23:59:00Z').getTime() / 1000),
  },
  {
    question: '@Nex0 Will multi-agent production systems become mainstream by end of 2026? https://moltbook.com/post/9453d46d-69dd-4a49-bbd6-80ca5d2d3da1',
    deadline: Math.floor(new Date('2026-12-31T23:59:00Z').getTime() / 1000),
  },
  {
    question: '@PepperPotts Will an AI agent be legally recognized as a co-author on a patent by end of 2026? https://moltbook.com/post/8e6cb590-7b02-430d-b5cf-175432d738a1',
    deadline: Math.floor(new Date('2026-12-31T23:59:00Z').getTime() / 1000),
  },
  {
    question: '@MoltRingo Will Bitcoin reach $150,000 by December 31, 2026? https://moltbook.com/post/1cdb951b-f245-4b21-98b6-c5a9c5fea782',
    deadline: Math.floor(new Date('2026-12-31T23:59:00Z').getTime() / 1000),
  },
  {
    question: '@GagaTheCompanion Will a fully autonomous AI agent gig economy platform launch by end of 2026? https://moltbook.com/post/71e2e2b3-ff67-49e6-8880-013a0cb197dd',
    deadline: Math.floor(new Date('2026-12-31T23:59:00Z').getTime() / 1000),
  },
];

async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  Create Markets — Monad Mainnet (Chain 143)   ║');
  console.log('╚════════════════════════════════════════════════╝\n');
  console.log(`Deployer: ${account.address}`);
  console.log(`Markets to create: ${MARKETS.length}\n`);

  // Mint sUSDC for liquidity
  const totalNeeded = INITIAL_LIQUIDITY * BigInt(MARKETS.length);
  console.log(`Minting ${Number(totalNeeded) / 1e18} sUSDC...`);
  
  const mintHash = await walletClient.writeContract({
    address: CONTRACTS.usdc,
    abi: ERC20Abi,
    functionName: 'mint',
    args: [account.address, totalNeeded],
  });
  await publicClient.waitForTransactionReceipt({ hash: mintHash });
  console.log(`✅ Minted. Tx: ${mintHash}\n`);

  // Approve launchpad
  console.log('Approving LaunchpadEngine...');
  const approveHash = await walletClient.writeContract({
    address: CONTRACTS.usdc,
    abi: ERC20Abi,
    functionName: 'approve',
    args: [CONTRACTS.launchpad, totalNeeded],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  console.log(`✅ Approved. Tx: ${approveHash}\n`);

  // Create markets
  const results: { question: string; address: string; tx: string }[] = [];

  for (let i = 0; i < MARKETS.length; i++) {
    const m = MARKETS[i];
    console.log(`[${i + 1}/${MARKETS.length}] Creating: ${m.question.slice(0, 80)}...`);

    try {
      const hash = await walletClient.writeContract({
        address: CONTRACTS.launchpad,
        abi: LaunchpadAbi,
        functionName: 'createMarket',
        args: [m.question, 0n, BigInt(m.deadline), ADJUDICATOR, PROTOCOL_CONFIG, INITIAL_LIQUIDITY, 0n, 0n],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      // Find MarketCreated event
      let marketAddress = 'unknown';
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: LaunchpadAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'MarketCreated') {
            marketAddress = (decoded.args as any).market;
          }
        } catch {}
      }

      results.push({ question: m.question, address: marketAddress, tx: hash });
      console.log(`   ✅ Market: ${marketAddress}`);
      console.log(`   Tx: ${hash}\n`);
    } catch (e: any) {
      console.error(`   ❌ Failed: ${e.message}\n`);
    }
  }

  // Summary
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║  SUMMARY                                       ║');
  console.log('╚════════════════════════════════════════════════╝\n');
  for (const r of results) {
    console.log(`${r.address} | ${r.question.slice(0, 70)}`);
  }
  console.log(`\nTotal: ${results.length}/${MARKETS.length} markets created`);

  // Save results
  fs.writeFileSync(
    path.join(__dirname, '../deployments/mainnet-markets.json'),
    JSON.stringify(results, null, 2)
  );
  console.log('\nSaved to deployments/mainnet-markets.json');
}

main().catch(console.error);

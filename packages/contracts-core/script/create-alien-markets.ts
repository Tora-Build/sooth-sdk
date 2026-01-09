#!/usr/bin/env bun

import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
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

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
if (!PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY environment variable required');
}

const account = privateKeyToAccount(PRIVATE_KEY);

const MARKET_QUESTION = "Will aliens visit Earth by 2030?";
const INITIAL_LIQUIDITY = parseEther('6666');
const USDC_MINT_AMOUNT = parseEther('1000000');

const USDC_ABI = parseAbi([
  'function mint(address to, uint256 amount) external',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
]);

const VAULT_ABI = parseAbi([
  'function depositUsdc(uint256 amountWad) external',
]);

const LAUNCHPAD_ABI = parseAbi([
  'function createMarket(string calldata question, uint256 initialLiquidityWad) external returns (address truthMarket)',
  'function getMarketKey(address truthMarket) external view returns (bytes32)',
  'function graduate(bytes32 marketKey) external',
]);

interface ChainConfig {
  name: string;
  rpcUrl: string;
  chainId: number;
  contracts: {
    usdc: `0x${string}`;
    vault: `0x${string}`;
    launchpad: `0x${string}`;
  };
}

const CHAINS: Record<string, ChainConfig> = {
  baseSepolia: {
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    chainId: 84532,
    contracts: {
      usdc: '0x937a3fae6a2b1702546e141f695d6f29df72c5cc',
      vault: '0x31a1a04ddc44957f5f0645d02f6a050e20bca6c0',
      launchpad: '0x5cec4acf4abfe1dea585bda8532b7f2fcdc52412',
    },
  },
  monadTestnet: {
    name: 'Monad Testnet',
    rpcUrl: 'https://blue-stylish-friday.monad-testnet.quiknode.pro/REDACTED_QUICKNODE_TOKEN/',
    chainId: 10143,
    contracts: {
      usdc: '0x1efd2b42ec8178ce667149acce75083f113e27fa',
      vault: '0x95d9d278448f758397ce338cc250e9e6ab110268',
      launchpad: '0x341173887aad5f63dda5da509f3210f008caea85',
    },
  },
};

async function createAlienMarket(chainKey: string) {
  const config = CHAINS[chainKey];
  if (!config) {
    throw new Error(`Unknown chain: ${chainKey}`);
  }

  console.log(`\n🪐 Creating alien market on ${config.name}...`);

  const publicClient = createPublicClient({
    chain: { id: config.chainId, name: config.name, network: config.name, nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [config.rpcUrl] }, public: { http: [config.rpcUrl] } } },
    transport: http(config.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: { id: config.chainId, name: config.name, network: config.name, nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [config.rpcUrl] }, public: { http: [config.rpcUrl] } } },
    transport: http(config.rpcUrl),
  });

  console.log(`1️⃣  Minting ${USDC_MINT_AMOUNT} USDC...`);
  const mintHash = await walletClient.writeContract({
    address: config.contracts.usdc,
    abi: USDC_ABI,
    functionName: 'mint',
    args: [account.address, USDC_MINT_AMOUNT],
  });
  await publicClient.waitForTransactionReceipt({ hash: mintHash });
  console.log(`   ✅ Minted - tx: ${mintHash}`);

  console.log(`2️⃣  Approving LaunchpadEngine to spend USDC...`);
  const approveLaunchpadHash = await walletClient.writeContract({
    address: config.contracts.usdc,
    abi: USDC_ABI,
    functionName: 'approve',
    args: [config.contracts.launchpad, USDC_MINT_AMOUNT],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveLaunchpadHash });
  console.log(`   ✅ Approved Launchpad - tx: ${approveLaunchpadHash}`);

  console.log(`3️⃣  Approving vault to spend USDC...`);
  const approveHash = await walletClient.writeContract({
    address: config.contracts.usdc,
    abi: USDC_ABI,
    functionName: 'approve',
    args: [config.contracts.vault, USDC_MINT_AMOUNT],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  console.log(`   ✅ Approved Vault - tx: ${approveHash}`);

  console.log(`4️⃣  Depositing ${USDC_MINT_AMOUNT} USDC to vault...`);
  const depositHash = await walletClient.writeContract({
    address: config.contracts.vault,
    abi: VAULT_ABI,
    functionName: 'depositUsdc',
    args: [USDC_MINT_AMOUNT],
  });
  await publicClient.waitForTransactionReceipt({ hash: depositHash });
  console.log(`   ✅ Deposited - tx: ${depositHash}`);

  console.log(`5️⃣  Creating market: "${MARKET_QUESTION}"`);
  console.log(`   Initial liquidity: ${INITIAL_LIQUIDITY} WAD`);
  const createMarketHash = await walletClient.writeContract({
    address: config.contracts.launchpad,
    abi: LAUNCHPAD_ABI,
    functionName: 'createMarket',
    args: [MARKET_QUESTION, INITIAL_LIQUIDITY],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: createMarketHash });
  console.log(`   ✅ Market created - tx: ${createMarketHash}`);

  const truthMarketAddress = receipt.logs[0]?.address;
  if (!truthMarketAddress) {
    throw new Error('Failed to extract TruthMarket address from logs');
  }
  console.log(`   📍 TruthMarket: ${truthMarketAddress}`);

  console.log(`6️⃣  Getting market key...`);
  const marketKey = await publicClient.readContract({
    address: config.contracts.launchpad,
    abi: LAUNCHPAD_ABI,
    functionName: 'getMarketKey',
    args: [truthMarketAddress],
  });
  console.log(`   🔑 Market key: ${marketKey}`);

  console.log(`7️⃣  Graduating market...`);
  const graduateHash = await walletClient.writeContract({
    address: config.contracts.launchpad,
    abi: LAUNCHPAD_ABI,
    functionName: 'graduate',
    args: [marketKey],
  });
  await publicClient.waitForTransactionReceipt({ hash: graduateHash });
  console.log(`   ✅ Graduated - tx: ${graduateHash}`);

  console.log(`\n✨ ${config.name} alien market complete!`);
  console.log(`   Question: ${MARKET_QUESTION}`);
  console.log(`   Market Key: ${marketKey}`);
  console.log(`   TruthMarket: ${truthMarketAddress}`);
}

const targetChains = process.argv.slice(2);
if (targetChains.length === 0) {
  console.log('Usage: bun run create-alien-markets.ts [baseSepolia] [monadTestnet]');
  process.exit(1);
}

console.log('👽 Alien Market Creator');
console.log('======================');

for (const chain of targetChains) {
  try {
    await createAlienMarket(chain);
  } catch (error) {
    console.error(`❌ Failed on ${chain}:`, error);
    process.exit(1);
  }
}

console.log('\n🎉 All alien markets created successfully!');

#!/usr/bin/env bun

import {
  createPublicClient,
  http,
  parseAbi,
} from 'viem';
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

const POOL_MANAGER_ABI = parseAbi([
  'function owner() external view returns (address)',
  'function vault() external view returns (address)',
]);

const VAULT_ABI = parseAbi([
  'function usdc() external view returns (address)',
  'function owner() external view returns (address)',
]);

interface ChainConfig {
  name: string;
  rpcUrl: string;
  chainId: number;
  contracts: {
    poolManager: `0x${string}`;
    vault: `0x${string}`;
  };
}

const CHAINS: Record<string, ChainConfig> = {
  monadTestnet: {
    name: 'Monad Testnet',
    rpcUrl: 'https://blue-stylish-friday.monad-testnet.quiknode.pro/e8b690b8d333c538f85bab9c93a2a3b512a4cb9a/',
    chainId: 10143,
    contracts: {
      poolManager: '0x4e9731f61c4e40e80e997a87a12c8a1dc50ec208',
      vault: '0x95d9d278448f758397ce338cc250e9e6ab110268',
    },
  },
  baseSepolia: {
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    chainId: 84532,
    contracts: {
      poolManager: '0x2f3464ca4a50a522786c3e72df94f12b02eec46b',
      vault: '0x31a1a04ddc44957f5f0645d02f6a050e20bca6c0',
    },
  },
};

async function verifyDeployment(chainKey: string) {
  const config = CHAINS[chainKey];
  if (!config) {
    throw new Error(`Unknown chain: ${chainKey}`);
  }

  console.log(`\n🔍 Verifying V10.7 on ${config.name}`);
  console.log('='.repeat(60));

  const publicClient = createPublicClient({
    chain: { 
      id: config.chainId, 
      name: config.name, 
      network: config.name, 
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, 
      rpcUrls: { 
        default: { http: [config.rpcUrl] }, 
        public: { http: [config.rpcUrl] } 
      } 
    },
    transport: http(config.rpcUrl),
  });

  // Check PoolManager
  console.log(`\n📋 PoolManager: ${config.contracts.poolManager}`);
  try {
    const poolManagerOwner = await publicClient.readContract({
      address: config.contracts.poolManager,
      abi: POOL_MANAGER_ABI,
      functionName: 'owner',
    });
    console.log(`   ✅ Owner: ${poolManagerOwner}`);

    const poolManagerVault = await publicClient.readContract({
      address: config.contracts.poolManager,
      abi: POOL_MANAGER_ABI,
      functionName: 'vault',
    });
    console.log(`   ✅ Vault: ${poolManagerVault}`);
    
    if (poolManagerVault.toLowerCase() !== config.contracts.vault.toLowerCase()) {
      console.log(`   ⚠️  Warning: Vault mismatch!`);
      console.log(`      Expected: ${config.contracts.vault}`);
      console.log(`      Got: ${poolManagerVault}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Failed to read PoolManager: ${error.message}`);
    return false;
  }

  // Check Vault
  console.log(`\n📋 Vault: ${config.contracts.vault}`);
  try {
    const vaultOwner = await publicClient.readContract({
      address: config.contracts.vault,
      abi: VAULT_ABI,
      functionName: 'owner',
    });
    console.log(`   ✅ Owner: ${vaultOwner}`);

    const vaultUsdc = await publicClient.readContract({
      address: config.contracts.vault,
      abi: VAULT_ABI,
      functionName: 'usdc',
    });
    console.log(`   ✅ USDC: ${vaultUsdc}`);
  } catch (error: any) {
    console.log(`   ❌ Failed to read Vault: ${error.message}`);
    return false;
  }

  console.log(`\n✅ ${config.name} V10.7 deployment verified!`);
  return true;
}

console.log('🔬 V10.7 Deployment Verification');
console.log('='.repeat(60));

const results: Record<string, boolean> = {};

for (const chainKey of ['monadTestnet', 'baseSepolia']) {
  try {
    results[chainKey] = await verifyDeployment(chainKey);
  } catch (error) {
    console.error(`\n❌ Verification failed for ${chainKey}:`, error);
    results[chainKey] = false;
  }
}

console.log('\n' + '='.repeat(60));
console.log('📊 Summary:');
console.log('='.repeat(60));
for (const [chain, success] of Object.entries(results)) {
  const status = success ? '✅' : '❌';
  console.log(`${status} ${CHAINS[chain].name}`);
}

const allSuccess = Object.values(results).every(v => v);
if (allSuccess) {
  console.log('\n✅ All deployments verified successfully!\n');
} else {
  console.log('\n❌ Some deployments failed verification.\n');
  process.exit(1);
}

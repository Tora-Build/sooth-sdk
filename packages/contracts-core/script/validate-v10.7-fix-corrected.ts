#!/usr/bin/env bun

import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  parseEther,
  formatEther,
  encodeDeployData,
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

const TRUTH_MARKET_BYTECODE = '0x60806040523461038b57610ef2803803806100198161038f565b92833981019060608183031261038b5780516001600160401b03811161038b57010182601f8201121561038b578051906001600160401b0382116102a85761006a601f8301601f191660200161038f565b938285526020838301011161038b57815f9260208093018387015e8401015260208101516001600160401b038116919082900361038b576100b960606100b2604084016103b4565b92016103b4565b42831115610346576001600160a01b03821615610301576001600160a01b03169182156102bc5783516001600160401b0381116102a857600154600181811c9116801561029e575b602082101461028a57601f8111610227575b50602094601f82116001146101c4579481929394955f926101b9575b50508160011b915f199060031b1c1916176001555b600280546001600160e01b03191690911733604090811b600160401b600160e01b039081169290921790925560038054600160401b600160e01b03191693831b90911692909217909155600480546001600160a01b031916929092179091555f805460ff1916905551610b2990816103c98239f35b015190505f8061012f565b601f1982169560015f52805f20915f5b88811061020f575083600195969798106101f7575b505050811b01600155610144565b01515f1960f88460031b161c191690555f80806101e9565b919260206001819286850151815501940192016101d4565b60015f527fb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6601f830160051c81019160208410610280575b601f0160051c01905b8181106102755750610113565b5f8155600101610268565b909150819061025f565b634e487b7160e01b5f52602260045260245ffd5b90607f1690610101565b634e487b7160e01b5f52604160045260245ffd5b60405162461bcd60e51b815260206004820152601a60248201527f54727574684d61726b65743a207a65726f20677561726469616e0000000000006044820152606490fd5b60405162461bcd60e51b815260206004820152601d60248201527f54727574684d61726b65743a207a65726f2061646a7564696361746f720000006044820152606490fd5b60405162461bcd60e51b815260206004820152601d60248201527f54727574684d61726b65743a20646561646c696e6520696e20706173740000006044820152606490fd5b5f80fd5b6040519190601f01601f191682016001600160401b038111838210176102a857604052565b51906001600160a01b038216820361038b5756fe6080...';

const USDC_ABI = parseAbi([
  'function mint(address to, uint256 amount) external',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
]);

const VAULT_ABI = parseAbi([
  'function depositUsdc(uint256 amountWad) external',
  'function getInternalOutcomes(address market, address user) external view returns (uint256 yesShares, uint256 noShares)',
]);

const TRUTH_MARKET_ABI = parseAbi([
  'function activate() external',
  'function creator() view returns (address)',
  'constructor(string question, uint64 deadline, address adjudicator, address guardian)',
]);

const LAUNCHPAD_ABI = parseAbi([
  'function createMarket(address market, uint256 initialLiquidity, string name, string symbol) external returns (uint256 lpTokens)',
  'function getMarketKey(address truthMarket) external view returns (bytes32)',
  'function graduate(bytes32 marketKey) external',
]);

const POOL_MANAGER_ABI = parseAbi([
  'function placeSpotSell(bytes32 marketKey, uint8 outcome, uint256 shares, uint16 tickLower, uint16 tickUpper) external returns (uint256 sellId)',
  'function placeOrder(bytes32 marketKey, uint8 outcome, uint256 shares, uint16 tickLower, uint16 tickUpper, uint256 maxCost) external returns (uint256 orderId, uint256 filledShares, uint256 filledCost, uint256 restingShares)',
  'function getSpotSellOrder(bytes32 marketKey, uint256 sellId) external view returns (address owner, uint8 outcome, uint16 tickLower, uint16 tickUpper, bool active, uint128 sharesTotal, uint128 sharesFilled, uint128 proceedsWad)',
]);

const COLLATERALIZER_ABI = parseAbi([
  'function split(address market, uint256 usdcAmount) external',
]);

interface ChainConfig {
  name: string;
  rpcUrl: string;
  chainId: number;
  contracts: {
    usdc: `0x${string}`;
    vault: `0x${string}`;
    launchpad: `0x${string}`;
    poolManager: `0x${string}`;
    collateralizer: `0x${string}`;
  };
}

const CHAINS: Record<string, ChainConfig> = {
  monadTestnet: {
    name: 'Monad Testnet',
    rpcUrl: 'https://blue-stylish-friday.monad-testnet.quiknode.pro/REDACTED_QUICKNODE_TOKEN/',
    chainId: 10143,
    contracts: {
      usdc: '0x1efd2b42ec8178ce667149acce75083f113e27fa',
      vault: '0x95d9d278448f758397ce338cc250e9e6ab110268',
      launchpad: '0x341173887aad5f63dda5da509f3210f008caea85',
      poolManager: '0x4e9731f61c4e40e80e997a87a12c8a1dc50ec208',
      collateralizer: '0xa1a9abaf228b91d85d35da744af4b585a4bf9a84',
    },
  },
  baseSepolia: {
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    chainId: 84532,
    contracts: {
      usdc: '0x937a3fae6a2b1702546e141f695d6f29df72c5cc',
      vault: '0x31a1a04ddc44957f5f0645d02f6a050e20bca6c0',
      launchpad: '0x5cec4acf4abfe1dea585bda8532b7f2fcdc52412',
      poolManager: '0x2f3464ca4a50a522786c3e72df94f12b02eec46b',
      collateralizer: '0x2fc82e6a2b285141366f07635285453221934942',
    },
  },
};

async function validateFix(chainKey: string) {
  const config = CHAINS[chainKey];
  if (!config) {
    throw new Error(`Unknown chain: ${chainKey}`);
  }

  console.log(`\n🧪 V10.7 Fix Validation on ${config.name}`);
  console.log('='.repeat(60));

  const publicClient = createPublicClient({
    chain: { id: config.chainId, name: config.name, network: config.name, nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [config.rpcUrl] }, public: { http: [config.rpcUrl] } } },
    transport: http(config.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: { id: config.chainId, name: config.name, network: config.name, nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [config.rpcUrl] }, public: { http: [config.rpcUrl] } } },
    transport: http(config.rpcUrl),
  });

  console.log(`\n📋 Test Scenario:`);
  console.log(`   1. Deploy TruthMarket contract`);
  console.log(`   2. Activate TruthMarket`);
  console.log(`   3. Initialize in LaunchpadEngine`);
  console.log(`   4. Graduate market`);
  console.log(`   5. Split USDC → NO shares`);
  console.log(`   6. Place NO spot sell at ticks 100-110 (low price)`);
  console.log(`   7. Place NO buy order at ticks 1-500 (willing to pay up to 50%)`);
  console.log(`   8. Verify spot sell was crossed ✅`);
  console.log('');

  const mintAmount = parseEther('100000');
  const liquidityWad = parseEther('100');
  const splitAmount = parseEther('10000');
  const spotSellShares = parseEther('1000');
  const buyOrderShares = parseEther('5000');

  console.log(`1️⃣  Minting ${formatEther(mintAmount)} USDC...`);
  const mintHash = await walletClient.writeContract({
    address: config.contracts.usdc,
    abi: USDC_ABI,
    functionName: 'mint',
    args: [account.address, mintAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: mintHash });
  console.log(`   ✅ tx: ${mintHash}`);

  console.log(`\n2️⃣  Deploying TruthMarket...`);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60);
  const deployData = encodeDeployData({
    abi: TRUTH_MARKET_ABI,
    bytecode: TRUTH_MARKET_BYTECODE,
    args: ['V10.7 Spot Sell Fix Test', deadline, account.address, account.address],
  });
  
  const deployHash = await walletClient.sendTransaction({
    data: deployData,
    gas: 1500000n,
  });
  
  const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const truthMarketAddress = deployReceipt.contractAddress as `0x${string}`;
  
  if (!truthMarketAddress) {
    throw new Error('Failed to deploy TruthMarket - no contract address');
  }
  console.log(`   ✅ TruthMarket: ${truthMarketAddress}`);

  console.log(`\n3️⃣  Activating TruthMarket...`);
  const activateHash = await walletClient.writeContract({
    address: truthMarketAddress,
    abi: TRUTH_MARKET_ABI,
    functionName: 'activate',
  });
  await publicClient.waitForTransactionReceipt({ hash: activateHash });
  console.log(`   ✅ Activated`);

  console.log(`\n4️⃣  Approving USDC for LaunchpadEngine...`);
  const approveLaunchpadHash = await walletClient.writeContract({
    address: config.contracts.usdc,
    abi: USDC_ABI,
    functionName: 'approve',
    args: [config.contracts.launchpad, mintAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveLaunchpadHash });
  console.log(`   ✅ Approved`);

  console.log(`\n5️⃣  Creating market in LaunchpadEngine...`);
  const createMarketHash = await walletClient.writeContract({
    address: config.contracts.launchpad,
    abi: LAUNCHPAD_ABI,
    functionName: 'createMarket',
    args: [truthMarketAddress, liquidityWad, 'V10.7 Fix Test', 'V107TEST'],
    gas: 2000000n,
  });
  await publicClient.waitForTransactionReceipt({ hash: createMarketHash });
  console.log(`   ✅ Market created`);

  const marketKey = await publicClient.readContract({
    address: config.contracts.launchpad,
    abi: LAUNCHPAD_ABI,
    functionName: 'getMarketKey',
    args: [truthMarketAddress],
  });
  console.log(`   🔑 Key: ${marketKey}`);

  console.log(`\n6️⃣  Approving USDC for Vault...`);
  const approveVaultHash = await walletClient.writeContract({
    address: config.contracts.usdc,
    abi: USDC_ABI,
    functionName: 'approve',
    args: [config.contracts.vault, mintAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveVaultHash });

  const depositHash = await walletClient.writeContract({
    address: config.contracts.vault,
    abi: VAULT_ABI,
    functionName: 'depositUsdc',
    args: [mintAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: depositHash });
  console.log(`   ✅ Deposited to vault`);

  console.log(`\n7️⃣  Graduating market...`);
  const graduateHash = await walletClient.writeContract({
    address: config.contracts.launchpad,
    abi: LAUNCHPAD_ABI,
    functionName: 'graduate',
    args: [marketKey],
    gas: 2000000n,
  });
  await publicClient.waitForTransactionReceipt({ hash: graduateHash });
  console.log(`   ✅ Graduated`);

  console.log(`\n8️⃣  Splitting ${formatEther(splitAmount)} USDC → NO shares...`);
  const approveCollatHash = await walletClient.writeContract({
    address: config.contracts.usdc,
    abi: USDC_ABI,
    functionName: 'approve',
    args: [config.contracts.collateralizer, splitAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveCollatHash });

  const splitHash = await walletClient.writeContract({
    address: config.contracts.collateralizer,
    abi: COLLATERALIZER_ABI,
    functionName: 'split',
    args: [truthMarketAddress, splitAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: splitHash });

  const [, noShares] = await publicClient.readContract({
    address: config.contracts.vault,
    abi: VAULT_ABI,
    functionName: 'getInternalOutcomes',
    args: [truthMarketAddress, account.address],
  });
  console.log(`   ✅ NO shares: ${formatEther(noShares)}`);

  console.log(`\n9️⃣  Placing NO spot sell at ticks 100-110...`);
  const spotSellHash = await walletClient.writeContract({
    address: config.contracts.poolManager,
    abi: POOL_MANAGER_ABI,
    functionName: 'placeSpotSell',
    args: [marketKey, 0, spotSellShares, 100, 110],
    gas: 2000000n,
  });
  await publicClient.waitForTransactionReceipt({ hash: spotSellHash });
  const sellId = 1n;
  console.log(`   ✅ Spot sell ID: ${sellId}`);

  console.log(`\n🔟 Placing NO buy order at ticks 1-500...`);
  const orderHash = await walletClient.writeContract({
    address: config.contracts.poolManager,
    abi: POOL_MANAGER_ABI,
    functionName: 'placeOrder',
    args: [marketKey, 0, buyOrderShares, 1, 500, parseEther('10000')],
    gas: 2000000n,
  });
  await publicClient.waitForTransactionReceipt({ hash: orderHash });
  console.log(`   ✅ Order placed: ${orderHash}`);

  console.log(`\n1️⃣1️⃣  Checking if spot sell was filled...`);
  const spotOrderData = await publicClient.readContract({
    address: config.contracts.poolManager,
    abi: POOL_MANAGER_ABI,
    functionName: 'getSpotSellOrder',
    args: [marketKey, sellId],
  }) as [string, number, number, number, boolean, bigint, bigint, bigint];

  const spotOrder = {
    owner: spotOrderData[0],
    outcome: spotOrderData[1],
    tickLower: spotOrderData[2],
    tickUpper: spotOrderData[3],
    active: spotOrderData[4],
    sharesTotal: spotOrderData[5],
    sharesFilled: spotOrderData[6],
    proceedsWad: spotOrderData[7],
  };

  console.log(`\n📊 Results:`);
  console.log(`   Spot Sell Total: ${formatEther(spotOrder.sharesTotal)}`);
  console.log(`   Spot Sell Filled: ${formatEther(spotOrder.sharesFilled)}`);
  console.log(`   Fill %: ${(Number(spotOrder.sharesFilled) / Number(spotOrder.sharesTotal) * 100).toFixed(2)}%`);

  if (spotOrder.sharesFilled > 0n) {
    console.log(`\n✅ SUCCESS: V10.7 fix validated!`);
    console.log(`   Spot sell at low ticks (100-110) WAS crossed by high-range order (1-500)`);
    console.log(`   This proves the full-range search is working correctly.`);
  } else {
    console.log(`\n❌ FAILURE: Spot sell was NOT filled`);
    console.log(`   The bug still exists - spot sells at better prices are being missed.`);
  }

  console.log(`\n🔗 Market: ${truthMarketAddress}`);
  console.log(`🔗 Key: ${marketKey}`);
}

const targetChain = process.argv[2];
if (!targetChain || !CHAINS[targetChain]) {
  console.log('Usage: bun run validate-v10.7-fix-corrected.ts [monadTestnet|baseSepolia]');
  process.exit(1);
}

console.log('🔬 V10.7 Spot Sell Fix Validation (CORRECTED)');
console.log('='.repeat(60));

try {
  await validateFix(targetChain);
  console.log('\n✅ Validation complete!\n');
} catch (error) {
  console.error('\n❌ Validation failed:', error);
  process.exit(1);
}

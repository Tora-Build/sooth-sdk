/**
 * V10.7 Validation Script for Base Sepolia
 * 
 * Tests that spot sells can be crossed by range orders (full-range search fix)
 * 
 * Test scenario:
 * 1. Create graduated market
 * 2. Warm up orderbook with initial liquidity
 * 3. Place NO spot sell at ticks 100-110 (asking 10-11%)
 * 4. Place NO buy order at ticks 50-200 (willing to pay up to 20%)
 * 5. Verify spot sell was filled (proves V10.7 full-range search works)
 */

import { createPublicClient, createWalletClient, http, parseUnits, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import deployments from '../../../apps/web/src/config/deployments.json';

// ABIs
const USDC_ABI = [
  {
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    name: 'approve',
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const POOL_MANAGER_ABI = [
  {
    inputs: [
      { name: 'marketId', type: 'bytes32' },
      { name: 'outcome', type: 'uint8' },
      { name: 'tickLower', type: 'uint16' },
      { name: 'tickUpper', type: 'uint16' },
      { name: 'shares', type: 'uint256' },
    ],
    name: 'placeSpotSell',
    outputs: [{ name: 'sellId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'marketId', type: 'bytes32' },
      { name: 'outcome', type: 'uint8' },
      { name: 'tickLower', type: 'uint16' },
      { name: 'tickUpper', type: 'uint16' },
      { name: 'liquidity', type: 'uint128' },
    ],
    name: 'placeOrder',
    outputs: [{ name: 'orderId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'sellId', type: 'uint256' }],
    name: 'getSpotSell',
    outputs: [
      {
        components: [
          { name: 'owner', type: 'address' },
          { name: 'marketId', type: 'bytes32' },
          { name: 'outcome', type: 'uint8' },
          { name: 'tickLower', type: 'uint16' },
          { name: 'tickUpper', type: 'uint16' },
          { name: 'shares', type: 'uint256' },
          { name: 'sharesFilled', type: 'uint256' },
          { name: 'collateralEarned', type: 'uint256' },
        ],
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const LAUNCHPAD_ABI = [
  {
    inputs: [
      { name: 'question', type: 'string' },
      { name: 'initialLiquidity', type: 'uint256' },
    ],
    name: 'createMarket',
    outputs: [{ name: 'marketId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'marketId', type: 'bytes32' }],
    name: 'graduateMarket',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Setup
const PRIVATE_KEY = process.env.PRIVATE_KEY as Address;
if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY not set');

const account = privateKeyToAccount(PRIVATE_KEY);
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
});

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
});

const contracts = deployments.networks.baseSepolia.contracts;

async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  V10.7 Validation - Base Sepolia              ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  console.log(`Account: ${account.address}`);
  console.log(`Pool Manager: ${contracts.TickBookPoolManager}`);
  console.log(`Launchpad: ${contracts.LaunchpadEngine}\n`);

  // Step 1: Check USDC balance and approve
  console.log('📊 Step 1: Check USDC balance...');
  const balance = await publicClient.readContract({
    address: contracts.MockUSDC as Address,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });

  console.log(`   Balance: ${Number(balance) / 1e6} USDC`);

  if (balance < parseUnits('200', 6)) {
    throw new Error('Insufficient USDC balance (need at least 200 USDC)');
  }

  // Approve Launchpad
  console.log('\n💰 Step 2: Approve Launchpad...');
  const approveTx = await walletClient.writeContract({
    address: contracts.MockUSDC as Address,
    abi: USDC_ABI,
    functionName: 'approve',
    args: [contracts.LaunchpadEngine as Address, parseUnits('200', 6)],
  });

  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  console.log(`   ✅ Approved`);

  // Step 3: Create market
  console.log('\n🎯 Step 3: Create market...');
  const createTx = await walletClient.writeContract({
    address: contracts.LaunchpadEngine as Address,
    abi: LAUNCHPAD_ABI,
    functionName: 'createMarket',
    args: ['Will Bitcoin reach $100k by 2025?', parseUnits('100', 6)],
  });

  const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createTx });
  
  // Extract marketId from logs (assuming it's emitted in the first log)
  const marketId = createReceipt.logs[0]?.topics[1];
  if (!marketId) throw new Error('Failed to extract marketId from logs');

  console.log(`   ✅ Market created: ${marketId}`);

  // Step 4: Graduate market
  console.log('\n🎓 Step 4: Graduate market...');
  const graduateTx = await walletClient.writeContract({
    address: contracts.LaunchpadEngine as Address,
    abi: LAUNCHPAD_ABI,
    functionName: 'graduateMarket',
    args: [marketId],
  });

  await publicClient.waitForTransactionReceipt({ hash: graduateTx });
  console.log(`   ✅ Graduated`);

  // Step 5: Place spot sell (NO at ticks 100-110 = asking 10-11%)
  console.log('\n💸 Step 5: Place NO spot sell at ticks 100-110...');
  const spotSellTx = await walletClient.writeContract({
    address: contracts.TickBookPoolManager as Address,
    abi: POOL_MANAGER_ABI,
    functionName: 'placeSpotSell',
    args: [marketId, 0, 100, 110, parseUnits('1000', 18)], // NO outcome = 0
  });

  const spotSellReceipt = await publicClient.waitForTransactionReceipt({ hash: spotSellTx });
  
  // Get sellId from receipt (first log topic after event signature)
  const sellId = BigInt(spotSellReceipt.logs[0]?.topics[1] || '0');
  console.log(`   ✅ Spot sell placed: #${sellId}`);

  // Step 6: Place buy order (NO at ticks 50-200 = willing to pay 5-20%)
  console.log('\n📈 Step 6: Place NO buy order at ticks 50-200...');
  const orderTx = await walletClient.writeContract({
    address: contracts.TickBookPoolManager as Address,
    abi: POOL_MANAGER_ABI,
    functionName: 'placeOrder',
    args: [marketId, 0, 50, 200, parseUnits('500', 18) as unknown as bigint],
  });

  await publicClient.waitForTransactionReceipt({ hash: orderTx });
  console.log(`   ✅ Order placed`);

  // Step 7: Check spot sell status
  console.log('\n🔍 Step 7: Check spot sell status...');
  const spotSell = await publicClient.readContract({
    address: contracts.TickBookPoolManager as Address,
    abi: POOL_MANAGER_ABI,
    functionName: 'getSpotSell',
    args: [sellId],
  });

  console.log(`\n╔════════════════════════════════════════════════╗`);
  console.log(`║  VALIDATION RESULTS                            ║`);
  console.log(`╚════════════════════════════════════════════════╝\n`);

  console.log(`Spot Sell #${sellId}:`);
  console.log(`  Shares:        ${Number(spotSell.shares) / 1e18}`);
  console.log(`  Shares Filled: ${Number(spotSell.sharesFilled) / 1e18}`);
  console.log(`  Fill Rate:     ${((Number(spotSell.sharesFilled) / Number(spotSell.shares)) * 100).toFixed(2)}%`);

  if (spotSell.sharesFilled > 0n) {
    console.log(`\n✅ SUCCESS: V10.7 full-range search is working!`);
    console.log(`   Spot sell was found and crossed by range order.`);
  } else {
    console.log(`\n❌ FAILURE: V10.7 fix not working!`);
    console.log(`   Spot sell should have been filled but wasn't.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});

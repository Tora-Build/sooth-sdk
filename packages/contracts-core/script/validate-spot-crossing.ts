/**
 * V11 Validation Script for Base Sepolia
 *
 * Tests that spot sells can be crossed by range orders (full-range search fix)
 *
 * Test scenario:
 * 1. Create market (LaunchpadEngine)
 * 2. Trade on AMM until market graduates (TickBook registers)
 * 3. Seed orderbook, buy shares, then place spot sell
 * 4. Place range order to cross spot sell
 * 5. Verify spot sell was filled
 */

import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeAbiParameters,
  http,
  keccak256,
  parseUnits,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import deployments from '../../../apps/web/src/config/deployments.json';

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
  {
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

const LAUNCHPAD_ABI = [
  {
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
    name: 'createMarket',
    outputs: [
      { name: 'market', type: 'address' },
      { name: 'lpTokens', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'protocolConfig',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'market', type: 'address' },
      { name: 'outcome', type: 'uint8' },
      { name: 'deltaShares', type: 'int256' },
      { name: 'maxCostOrMinProceeds', type: 'uint256' },
    ],
    name: 'tradePositions',
    outputs: [{ name: 'actualCost', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'market', type: 'address' }],
    name: 'getMarketState',
    outputs: [
      { name: 'creator', type: 'address' },
      { name: 'bBase', type: 'uint256' },
      { name: 'bCurrent', type: 'uint256' },
      { name: 'totalLPSupply', type: 'uint256' },
      { name: 'isGraduated', type: 'bool' },
      { name: 'floorValue', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'market', type: 'address' }],
    name: 'getGraduationProgress',
    outputs: [
      { name: 'feesAccrued', type: 'uint256' },
      { name: 'threshold', type: 'uint256' },
      { name: 'progressBps', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'market', type: 'address' },
      { indexed: true, name: 'creator', type: 'address' },
      { indexed: false, name: 'initialLiquidity', type: 'uint256' },
      { indexed: false, name: 'deposit', type: 'uint256' },
      { indexed: false, name: 'lpTokens', type: 'uint256' },
    ],
    name: 'MarketCreated',
    type: 'event',
  },
] as const;

const COLLATERALIZER_ABI = [
  {
    inputs: [{ name: 'market', type: 'address' }],
    name: 'getOutcomeTokens',
    outputs: [
      { name: 'yesToken', type: 'address' },
      { name: 'noToken', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const TICKBOOK_VAULT_ABI = [
  {
    inputs: [{ name: 'amountAsset', type: 'uint256' }],
    name: 'depositUsdc',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'market', type: 'address' },
      { name: 'user', type: 'address' },
    ],
    name: 'getInternalOutcomes',
    outputs: [
      { name: 'yesSharesWad', type: 'uint256' },
      { name: 'noSharesWad', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const POOL_MANAGER_ABI = [
  {
    inputs: [
      { name: 'marketKey', type: 'bytes32' },
      { name: 'outcome', type: 'uint8' },
      { name: 'shares', type: 'uint256' },
      { name: 'tickLower', type: 'uint16' },
      { name: 'tickUpper', type: 'uint16' },
    ],
    name: 'placeSpotSell',
    outputs: [{ name: 'sellId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'marketKey', type: 'bytes32' },
      { name: 'outcome', type: 'uint8' },
      { name: 'shares', type: 'uint256' },
      { name: 'tickLower', type: 'uint16' },
      { name: 'tickUpper', type: 'uint16' },
      { name: 'maxCost', type: 'uint256' },
    ],
    name: 'placeOrder',
    outputs: [
      { name: 'orderId', type: 'uint256' },
      { name: 'filledShares', type: 'uint256' },
      { name: 'filledCost', type: 'uint256' },
      { name: 'restingShares', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'marketKey', type: 'bytes32' },
      { name: 'sellId', type: 'uint256' },
    ],
    name: 'getSpotSellOrder',
    outputs: [
      {
        components: [
          { name: 'owner', type: 'address' },
          { name: 'outcome', type: 'uint8' },
          { name: 'tickLower', type: 'uint16' },
          { name: 'tickUpper', type: 'uint16' },
          { name: 'active', type: 'bool' },
          { name: 'sharesTotal', type: 'uint128' },
          { name: 'sharesFilled', type: 'uint128' },
          { name: 'proceedsWad', type: 'uint256' },
        ],
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'marketKey', type: 'bytes32' },
      { name: 'user', type: 'address' },
    ],
    name: 'getUserSpotSells',
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'marketKey', type: 'bytes32' }],
    name: 'getMarketInfo',
    outputs: [
      { name: 'market', type: 'address' },
      { name: 'yesToken', type: 'address' },
      { name: 'noToken', type: 'address' },
      { name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'marketKey', type: 'bytes32' },
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: false, name: 'sellId', type: 'uint256' },
      { indexed: false, name: 'outcome', type: 'uint8' },
      { indexed: false, name: 'tickLower', type: 'uint16' },
      { indexed: false, name: 'tickUpper', type: 'uint16' },
      { indexed: false, name: 'shares', type: 'uint256' },
    ],
    name: 'SpotSellPlaced',
    type: 'event',
  },
] as const;

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
  console.log('║  V11 Validation - Base Sepolia               ║');
  console.log('╚════════════════════════════════════════════════╝
');

  console.log(`Account: ${account.address}`);
  console.log(`Launchpad: ${contracts.LaunchpadEngine}`);
  console.log(`TickBook: ${contracts.TickBookPoolManager}`);
  console.log(`Vault: ${contracts.TickBookVault}
`);

  const targetUsdc = parseUnits('5000', 6);

  console.log('📊 Step 1: Check USDC balance...');
  const balance = await publicClient.readContract({
    address: contracts.MockUSDC as Address,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });

  if (balance < targetUsdc) {
    const mintAmount = targetUsdc - balance;
    console.log(`   Minting ${mintAmount} USDC...`);
    const mintTx = await walletClient.writeContract({
      address: contracts.MockUSDC as Address,
      abi: USDC_ABI,
      functionName: 'mint',
      args: [account.address, mintAmount],
    });
    await publicClient.waitForTransactionReceipt({ hash: mintTx });
  }
  console.log(`   Balance: ${Number(balance) / 1e6} USDC`);

  console.log('
💰 Step 2: Approve Launchpad and Vault...');
  const approveLaunchpad = await walletClient.writeContract({
    address: contracts.MockUSDC as Address,
    abi: USDC_ABI,
    functionName: 'approve',
    args: [contracts.LaunchpadEngine as Address, targetUsdc],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveLaunchpad });

  const approveVault = await walletClient.writeContract({
    address: contracts.MockUSDC as Address,
    abi: USDC_ABI,
    functionName: 'approve',
    args: [contracts.TickBookVault as Address, targetUsdc],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveVault });
  console.log('   ✅ Approved');

  console.log('
🎯 Step 3: Create market...');
  const protocolConfig = await publicClient.readContract({
    address: contracts.LaunchpadEngine as Address,
    abi: LAUNCHPAD_ABI,
    functionName: 'protocolConfig',
  });

  const createTx = await walletClient.writeContract({
    address: contracts.LaunchpadEngine as Address,
    abi: LAUNCHPAD_ABI,
    functionName: 'createMarket',
    args: [
      'Will Bitcoin reach $100k by 2025?',
      0,
      Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
      account.address,
      protocolConfig as Address,
      parseUnits('20', 18),
      0,
      0,
    ],
  });

  const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createTx });
  let marketAddress: Address | undefined;
  for (const log of createReceipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: LAUNCHPAD_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'MarketCreated') {
        marketAddress = decoded.args.market as Address;
        break;
      }
    } catch {
      continue;
    }
  }
  if (!marketAddress) throw new Error('Failed to extract market address from logs');
  console.log(`   ✅ Market created: ${marketAddress}`);

  console.log('
🎓 Step 4: Trade until graduation...');
  const maxLoops = 10;
  for (let i = 0; i < maxLoops; i++) {
    const progress = await publicClient.readContract({
      address: contracts.LaunchpadEngine as Address,
      abi: LAUNCHPAD_ABI,
      functionName: 'getGraduationProgress',
      args: [marketAddress],
    }) as readonly [bigint, bigint, bigint];

    const progressBps = progress[2];
    console.log(`   Progress: ${Number(progressBps) / 100}%`);
    if (progressBps >= 10000n) break;

    const tradeTx = await walletClient.writeContract({
      address: contracts.LaunchpadEngine as Address,
      abi: LAUNCHPAD_ABI,
      functionName: 'tradePositions',
      args: [marketAddress, 0, parseUnits('200', 18), parseUnits('2000', 18)],
    });
    await publicClient.waitForTransactionReceipt({ hash: tradeTx });
  }

  const marketState = await publicClient.readContract({
    address: contracts.LaunchpadEngine as Address,
    abi: LAUNCHPAD_ABI,
    functionName: 'getMarketState',
    args: [marketAddress],
  }) as readonly [Address, bigint, bigint, bigint, boolean, bigint];

  if (!marketState[4]) {
    throw new Error('Market did not graduate after trades; increase trade size or loop count.');
  }
  console.log('   ✅ Market graduated');

  const [yesToken, noToken] = await publicClient.readContract({
    address: contracts.Collateralizer as Address,
    abi: COLLATERALIZER_ABI,
    functionName: 'getOutcomeTokens',
    args: [marketAddress],
  }) as readonly [Address, Address];

  if (yesToken === '0x0000000000000000000000000000000000000000' || noToken === '0x0000000000000000000000000000000000000000') {
    throw new Error('Outcome tokens not registered; graduation did not register collateralizer.');
  }

  const marketKey = keccak256(encodeAbiParameters(
    [
      { type: 'address', name: 'market' },
      { type: 'address', name: 'yesToken' },
      { type: 'address', name: 'noToken' },
    ],
    [marketAddress, yesToken, noToken]
  ));

  const marketInfo = await publicClient.readContract({
    address: contracts.TickBookPoolManager as Address,
    abi: POOL_MANAGER_ABI,
    functionName: 'getMarketInfo',
    args: [marketKey],
  }) as readonly [Address, Address, Address, boolean];

  if (!marketInfo[3]) {
    throw new Error('TickBook market not active; graduation did not register TickBook.');
  }
  console.log(`   ✅ TickBook registered: ${marketKey}`);

  console.log('
🏦 Step 5: Deposit USDC into TickBookVault...');
  const depositTx = await walletClient.writeContract({
    address: contracts.TickBookVault as Address,
    abi: TICKBOOK_VAULT_ABI,
    functionName: 'depositUsdc',
    args: [parseUnits('2000', 6)],
  });
  await publicClient.waitForTransactionReceipt({ hash: depositTx });
  console.log('   ✅ Deposited');

  console.log('
📘 Step 6: Seed range liquidity for self-trade...');
  const seedOrderTx = await walletClient.writeContract({
    address: contracts.TickBookPoolManager as Address,
    abi: POOL_MANAGER_ABI,
    functionName: 'placeOrder',
    args: [marketKey, 0, parseUnits('200', 18), 50, 200, parseUnits('1000', 18)],
  });
  await publicClient.waitForTransactionReceipt({ hash: seedOrderTx });
  console.log('   ✅ Seed order placed');

  console.log('
🛒 Step 7: Buy shares to enable spot sell...');
  const buyOrderTx = await walletClient.writeContract({
    address: contracts.TickBookPoolManager as Address,
    abi: POOL_MANAGER_ABI,
    functionName: 'placeOrder',
    args: [marketKey, 0, parseUnits('50', 18), 1, 999, parseUnits('1000', 18)],
  });
  await publicClient.waitForTransactionReceipt({ hash: buyOrderTx });

  const internalOutcomes = await publicClient.readContract({
    address: contracts.TickBookVault as Address,
    abi: TICKBOOK_VAULT_ABI,
    functionName: 'getInternalOutcomes',
    args: [marketAddress, account.address],
  }) as readonly [bigint, bigint];

  const noShares = internalOutcomes[1];
  if (noShares == 0n) {
    throw new Error('No internal NO shares credited; cannot place spot sell.');
  }
  console.log(`   ✅ NO shares acquired: ${noShares}`);

  const spotSellShares = noShares > parseUnits('10', 18) ? parseUnits('10', 18) : noShares;

  console.log('
💸 Step 8: Place NO spot sell at ticks 100-110...');
  const spotSellTx = await walletClient.writeContract({
    address: contracts.TickBookPoolManager as Address,
    abi: POOL_MANAGER_ABI,
    functionName: 'placeSpotSell',
    args: [marketKey, 0, spotSellShares, 100, 110],
  });
  await publicClient.waitForTransactionReceipt({ hash: spotSellTx });

  const userSellIds = await publicClient.readContract({
    address: contracts.TickBookPoolManager as Address,
    abi: POOL_MANAGER_ABI,
    functionName: 'getUserSpotSells',
    args: [marketKey, account.address],
  }) as readonly bigint[];

  const sellId = userSellIds[userSellIds.length - 1];
  console.log(`   ✅ Spot sell placed: #${sellId}`);

  console.log('
📈 Step 9: Place NO buy order at ticks 50-200...');
  const crossOrderTx = await walletClient.writeContract({
    address: contracts.TickBookPoolManager as Address,
    abi: POOL_MANAGER_ABI,
    functionName: 'placeOrder',
    args: [marketKey, 0, spotSellShares, 50, 200, parseUnits('1000', 18)],
  });
  await publicClient.waitForTransactionReceipt({ hash: crossOrderTx });
  console.log('   ✅ Range order placed');

  console.log('
🔍 Step 10: Check spot sell status...');
  const spotSell = await publicClient.readContract({
    address: contracts.TickBookPoolManager as Address,
    abi: POOL_MANAGER_ABI,
    functionName: 'getSpotSellOrder',
    args: [marketKey, sellId],
  }) as any;

  console.log(`
╔════════════════════════════════════════════════╗`);
  console.log(`║  VALIDATION RESULTS                            ║`);
  console.log(`╚════════════════════════════════════════════════╝
`);

  console.log(`Spot Sell #${sellId}:`);
  console.log(`  Shares:        ${Number(spotSell.sharesTotal) / 1e18}`);
  console.log(`  Shares Filled: ${Number(spotSell.sharesFilled) / 1e18}`);
  console.log(`  Fill Rate:     ${((Number(spotSell.sharesFilled) / Number(spotSell.sharesTotal)) * 100).toFixed(2)}%`);

  if (spotSell.sharesFilled > 0n) {
    console.log(`
✅ SUCCESS: V11 full-range search is working!`);
    console.log(`   Spot sell was found and crossed by range order.`);
  } else {
    console.log(`
❌ FAILURE: V11 fix not working!`);
    console.log(`   Spot sell should have been filled but wasn't.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('
❌ Error:', err.message);
  process.exit(1);
});

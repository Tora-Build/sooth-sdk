/**
 * Market Commands
 * create, graduate, status
 */

import type { CommandContext, CommandResult } from './types';
import { ABIS, WAD, MAX_UINT256 } from '../config';
import {
  formatWad,
  parseWad,
  shortAddress,
  shortTx,
  Spinner,
  success,
  error,
  dim,
  bold,
  info,
  warn,
  printTable,
  sleep,
  decodeError,
  isTransientError,
  readContractWithRpcFallback,
} from '../cli-utils';
import { decodeEventLog, parseAbi, encodeFunctionData } from 'viem';

const TruthMarketAbi = parseAbi([
  'function question() view returns (string)',
  'function questionHash() view returns (bytes32)',
  'function startTime() view returns (uint64)',
  'function deadline() view returns (uint64)',
  'function creator() view returns (address)',
  'function adjudicator() view returns (address)',
  'function launchpadEngine() view returns (address)',
  'function isLive() view returns (bool)',
  'function isResolving() view returns (bool)',
  'function isAttested() view returns (bool)',
  'function isSettled() view returns (bool)',
  'function winningOutcome() view returns (uint8)',
  'function tStar() view returns (uint64)',
  'function getRedemptionValue(uint8 outcome) view returns (uint256)',
  'function resolve(uint8 outcome, uint64 tStar) external',
  'function attest() external',
  'function settle() external',
  'function veto() external',
  'event MarketCreated(address indexed market, bytes32 questionHash, string question, uint64 startTime, uint64 deadline)',
]);

const OrderEngineAbi = parseAbi([
  'function getPosition(address market, address user) view returns (uint256 yesShares, uint256 noShares)',
  'function isMarketRegistered(address market) view returns (bool)',
  'function getCollateralBacking(address market) view returns (uint256)',
]);

const ERC20Abi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
]);

const LaunchpadEngineAbi = parseAbi([
  'function createMarket(string question, uint64 startTime, uint64 deadline, address adjudicator, uint256 bBase, uint256 initialProbabilityWad) external returns (address market, address lpToken)',
  'function markets(address) view returns (address creator, address lpToken, uint256 bBase, uint256 creatorDeposit, uint64 graduatedAt)',
  'function isGraduated(address market) view returns (bool)',
  'function isTrialExpiredWithoutGraduation(address market) view returns (bool)',
  'function getLPToken(address market) view returns (address)',
  'function dismissMarket(address market) external',
  'function claimRefund(address market) external returns (uint256)',
]);

const AMMEngineAbi = parseAbi([
  'function tradePositions(address market, uint8 outcome, int256 deltaShares, uint256 maxCostOrMinProceeds) external returns (uint256)',
  'function getPosition(address market, address user) view returns (uint256 yesShares, uint256 noShares)',
  'function getMarketState(address market) view returns (uint256 qYes, uint256 qNo, uint256 price)',
  'function settlePosition(address market) external returns (uint256 payout)',
  'function redeemLP(address market, uint256 lpAmount) external returns (uint256 tokenAmount)',
  'function protocolTreasury() view returns (address)',
]);

const MARKET_TEMPLATES: Record<string, { question: string; name: string; deadline: string }> = {
  alien: {
    question: 'The UN officially confirm extraterrestrial life.',
    name: 'UN Confirms Alien Life',
    deadline: 'infinite',
  },
  btcath: {
    question: 'Will BTC/USD reach a new all-time high in 2026? (Chainlink 6H TWAP)',
    name: 'BTC All-Time High',
    deadline: '2026-12-31',
  },
  lakers: {
    question: 'Will the LA Lakers win the 2025-26 NBA Championship?',
    name: 'Lakers 2026 Championship',
    deadline: '2026-07-01',
  },
  btc75k: {
    question: '@SoothSayer predicts: Will BTC hit $75,000 by February 20, 2026? Source: https://www.moltbook.com/post/5ac527fd-26d4-467e-b56e-cf298ff88ee8',
    name: 'BTC $75K by Feb 2026',
    deadline: '2026-02-20',
  },
};

/**
 * Create a new market from scratch
 * Usage: createmarket <template> [liquidity]
 *
 * Example: createmarket alien 500
 * Example: createmarket btc100k 1000
 */
export async function createmarket(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment } = ctx;
  const walletClient = actorManager.currentWalletClient();
  const address = actorManager.currentAddress();
  const publicClient = actorManager.getPublicClient();

  if (!walletClient || !address) {
    return { success: false, message: 'No actor selected' };
  }

  if (args.length < 1) {
    console.log(`
  ${bold('Create Market')}

  Usage: createmarket <template> [liquidity] [--adjudicator=<actor>]

  Templates: ${Object.keys(MARKET_TEMPLATES).join(', ')}

  ${info('Examples:')}
    createmarket alien 500                   Create ALIEN market with creator as adjudicator
    createmarket alien 500 --adjudicator=david   Create ALIEN market with david as adjudicator

  ${dim('This will:')}
    1. Approve USDC
    2. Create market via LaunchpadEngine
`);
    return { success: true };
  }

  const templateName = args[0].toLowerCase();
  const template = MARKET_TEMPLATES[templateName];

  let adjudicatorAddress = address;
  const adjudicatorFlag = args.find(a => a.startsWith('--adjudicator='));
  if (adjudicatorFlag) {
    const adjudicatorName = adjudicatorFlag.split('=')[1];
    const adjudicatorActor = actorManager.listActors().find(a => a.name.toLowerCase() === adjudicatorName.toLowerCase());
    if (!adjudicatorActor) {
      return { success: false, message: `Unknown actor: ${adjudicatorName}. Available: ${actorManager.listActors().map(a => a.name).join(', ')}` };
    }
    adjudicatorAddress = adjudicatorActor.account.address;
  }

  if (!template) {
    return { success: false, message: `Unknown template: ${templateName}. Available: ${Object.keys(MARKET_TEMPLATES).join(', ')}` };
  }

  if (templateName === 'custom') {
    return { success: false, message: 'Custom template not yet supported. Use alien or btc100k.' };
  }

  const liquidityArg = args.find((a, i) => i > 0 && !a.startsWith('--'));
  const liquidityWad = liquidityArg ? BigInt(Math.floor(parseFloat(liquidityArg))) * WAD : 500n * WAD;

  console.log(`\n  ${bold('Creating Market: ' + template.name)}`);
  console.log('  ' + '═'.repeat(50));
  console.log(`  Question:  ${template.question}`);
  console.log(`  Name:      ${template.name}`);
  console.log(`  Liquidity: ${formatWad(liquidityWad)} (b parameter)`);
  console.log(`  Deadline:  ${template.deadline}`);
  if (adjudicatorAddress !== address) {
    const adjName = actorManager.listActors().find(a => a.account.address === adjudicatorAddress)?.name || 'unknown';
    console.log(`  Adjudicator: ${adjName} (${shortAddress(adjudicatorAddress)})`);
  }
  console.log('');

  try {
    // Step 1: Check USDC balance
    const usdcBalance = await readContractWithRpcFallback<bigint>(
      ctx.config.chain,
      ctx.config.rpc,
      {
        address: deployment.contracts.BaseToken as `0x${string}`,
        abi: ABIS.BaseToken,
        functionName: 'balanceOf',
        args: [address],
      },
    );

    // Estimate required USDC: b × ln(2) (MockUSDC uses 18 decimals like WAD)
    // LaunchpadEngine calculates: depositWad = (b × LN2_WAD) / WAD
    const LN2_WAD = 693147180559945309n; // ln(2) × 1e18
    const required = (liquidityWad * LN2_WAD) / WAD; // Result is in WAD (18 decimals) = MockUSDC (18 decimals)
    if (usdcBalance < required) {
      console.log(warn(`  Insufficient USDC. Minting ${formatWad(required)} USDC...`));
      const mintHash = await walletClient.writeContract({
        address: deployment.contracts.BaseToken as `0x${string}`,
        abi: ABIS.BaseToken,
        functionName: 'mint',
        args: [address, required * 2n],
        gas: 500000n,
      });
      await actorManager.waitForTransactionReceipt(mintHash);
      console.log(success('  Minted USDC'));
    }

    const spinner1 = new Spinner('[1/2] Approving USDC...');
    spinner1.start();

    const approveHash = await walletClient.writeContract({
      address: deployment.contracts.BaseToken as `0x${string}`,
      abi: ABIS.BaseToken,
      functionName: 'approve',
      args: [deployment.contracts.LaunchpadEngine as `0x${string}`, MAX_UINT256],
      gas: 500000n,
    });
    await actorManager.waitForTransactionReceipt(approveHash);
    spinner1.succeed('USDC approved');

    const spinner2 = new Spinner('[2/2] Creating market in LaunchpadEngine...');
    spinner2.start();

    const startTime = 0n;
    const deadline = template.deadline === 'infinite'
      ? BigInt('7258118399')
      : BigInt(Math.floor(new Date(template.deadline + 'T23:59:59Z').getTime() / 1000));

    // Gas limits vary by chain. Base Sepolia limits ~15M, MegaETH needs ~30M for code deployment
    const isMegaETH = ctx.config.chain.id === 6343;
    const createGas = isMegaETH ? 30_000_000n : 10_000_000n;
    const createHash = await walletClient.writeContract({
      address: deployment.contracts.LaunchpadEngine as `0x${string}`,
      abi: LaunchpadEngineAbi,
      functionName: 'createMarket',
      args: [template.question, startTime, deadline, adjudicatorAddress, liquidityWad, 500000000000000000n],
      gas: createGas,
    });

    const createReceipt = await actorManager.waitForTransactionReceipt(createHash);
    let marketAddress: `0x${string}` | undefined;

    for (const log of createReceipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: TruthMarketAbi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === 'MarketCreated') {
          marketAddress = decoded.args.market as `0x${string}`;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!marketAddress) {
      spinner2.fail('MarketCreated event not found');
      return { success: false, message: 'MarketCreated event not found' };
    }

    spinner2.succeed(`Market created ${dim(`(gas: ${createReceipt.gasUsed})`)}`);

    console.log('');
    console.log('  ' + '═'.repeat(50));
    console.log(`  ${success('MARKET CREATED SUCCESSFULLY!')}`);
    console.log('');
    console.log(`  TruthMarket: ${marketAddress}`);
    console.log(`  Name:        ${template.name}`);
    console.log('');
    console.log(`  ${info('Next steps:')}`);
    console.log(`    setmarket ${marketAddress}`);
    console.log(`    marketstatus`);
    console.log('');

    return {
      success: true,
      txHash: createHash,
      data: { marketAddress }
    };
  } catch (err) {
    return { success: false, message: `Market creation failed: ${(err as Error).message}` };
  }
}

/**
 * Graduate a market by executing trades to accumulate fees
 * Usage: graduate [steps]
 * Example: graduate      (default 8 steps)
 * Example: graduate 5    (5 steps to reach 110% of threshold)
 *
 * Auto-calculates trade size to reach 110% of graduation threshold
 */
export async function graduate(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketAddress } = ctx;
  const walletClient = actorManager.currentWalletClient();
  const address = actorManager.currentAddress();
  const publicClient = actorManager.getPublicClient();

  if (!walletClient || !address) {
    return { success: false, message: 'No actor selected' };
  }

  if (!marketAddress) {
    return { success: false, message: 'No market selected. Use: setmarket <address>' };
  }

  // Check if already graduated
  let isGraduated: boolean;
  try {
    isGraduated = await publicClient.readContract({
      address: deployment.contracts.LaunchpadEngine as `0x${string}`,
      abi: LaunchpadEngineAbi,
      functionName: 'isGraduated',
      args: [marketAddress],
    }) as boolean;
  } catch (err) {
    return { success: false, message: `Market not found in LaunchpadEngine: ${(err as Error).message}` };
  }

  console.log(`\n  ${bold('Graduation Status')}`);
  console.log('  ' + '─'.repeat(40));
  console.log(`  Graduated:    ${isGraduated ? success('Yes') : warn('No')}`);

  if (isGraduated) {
    console.log(`\n  ${success('Market is already graduated!')}\n`);
    return { success: true };
  }

  // Parse number of steps (default 8)
  const numTrades = args[0] ? parseInt(args[0], 10) : 8;

  // Use a reasonable default trade size (graduation details no longer queryable)
  const tradeSize = 500n * WAD;

  console.log(`  Trade size:            ${formatWad(tradeSize)} shares`);
  console.log(`  Steps:                 ${numTrades}`);
  console.log('');

  // Ensure sufficient USDC
  const requiredUsdc = tradeSize * BigInt(numTrades) * 2n; // Rough estimate
  const usdcBalance = await readContractWithRpcFallback<bigint>(
    ctx.config.chain,
    ctx.config.rpc,
    {
      address: deployment.contracts.BaseToken as `0x${string}`,
      abi: ABIS.BaseToken,
      functionName: 'balanceOf',
      args: [address],
    },
  );

  if (usdcBalance < requiredUsdc) {
    console.log(warn(`  Low USDC balance. Minting more...`));
    const mintHash = await walletClient.writeContract({
      address: deployment.contracts.BaseToken as `0x${string}`,
      abi: ABIS.BaseToken,
      functionName: 'mint',
      args: [address, requiredUsdc * 2n],
      gas: 500000n, // High gas for Monad testnet
    });
    await actorManager.waitForTransactionReceipt(mintHash);
    console.log(success('  Minted USDC'));
  }

  // Approve AMMEngine (tradePositions moved to AMMEngine in v0.1.0)
  const approveHash = await walletClient.writeContract({
    address: deployment.contracts.BaseToken as `0x${string}`,
    abi: ABIS.BaseToken,
    functionName: 'approve',
    args: [deployment.contracts.AMMEngine as `0x${string}`, MAX_UINT256],
    gas: 500000n, // High gas for Monad testnet
  });
  await actorManager.waitForTransactionReceipt(approveHash);

  // Execute graduation trades
  console.log('  ' + '─'.repeat(40));
  let totalGas = 0n;
  let tradesExecuted = 0;
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 3; // Stop after 3 consecutive failures to save gas

  for (let i = 0; i < numTrades; i++) {
    // ...
    const isBuy = i % 2 === 0;
    const outcome = 1; // YES
    const delta = isBuy ? tradeSize : -tradeSize / 2n;

    const spinner = new Spinner(`  Trade ${i + 1}/${numTrades}: ${isBuy ? 'BUY' : 'SELL'} ${formatWad(delta > 0n ? delta : -delta)} shares...`);
    spinner.start();

    let success_trade = false;
    let attempts = 0;
    const maxAttempts = 3;
    const isMegaETH = ctx.config.chain.id === 6343;

    while (!success_trade && attempts < maxAttempts) {
      attempts++;
      try {
        // For BUY (positive delta): maxCost = MAX_UINT256 (accept any cost)
        // For SELL (negative delta): maxCost = 0 (accept any proceeds, i.e., min proceeds = 0)
        const maxCostOrMinProceeds = isBuy ? MAX_UINT256 : 0n;

        // Determine gas limit
        const gasLimit = isMegaETH ? 60_000_000n : 10_000_000n;

        // Check if already graduated before trading
        if (!isMegaETH) {
          const graduated = await publicClient.readContract({
            address: deployment.contracts.LaunchpadEngine as `0x${string}`,
            abi: LaunchpadEngineAbi,
            functionName: 'isGraduated',
            args: [marketAddress],
          }) as boolean;

          if (graduated) {
            spinner.succeed(`Trade ${i + 1}: ${isBuy ? 'BUY' : 'SELL'} skipped (already graduated)`);
            console.log(`\n  ${success('MARKET GRADUATED!')} after ${tradesExecuted} trades\n`);
            return { success: true, data: { tradesExecuted, totalGas } };
          }
        }

        let hash: `0x${string}`;
        if (isMegaETH) {
          // MegaETH: use raw sendTransaction to bypass viem simulation
          const data = encodeFunctionData({
            abi: AMMEngineAbi,
            functionName: 'tradePositions',
            args: [marketAddress, outcome, delta, maxCostOrMinProceeds],
          });
          hash = await walletClient.sendTransaction({
            to: deployment.contracts.AMMEngine as `0x${string}`,
            data,
            gas: gasLimit,
          });
        } else {
          hash = await walletClient.writeContract({
            address: deployment.contracts.AMMEngine as `0x${string}`,
            abi: AMMEngineAbi,
            functionName: 'tradePositions',
            args: [marketAddress, outcome, delta, maxCostOrMinProceeds],
            gas: gasLimit,
          });
        }

        const receipt = await actorManager.waitForTransactionReceipt(hash);
        totalGas += receipt.gasUsed;
        tradesExecuted++;
        success_trade = true;

        spinner.succeed(`Trade ${i + 1}: ${isBuy ? 'BUY' : 'SELL'} ${formatWad(delta > 0n ? delta : -delta)} ${dim(`(gas: ${receipt.gasUsed})`)}`);

        // Check if graduated (MegaETH: wait for state to settle first)
        if (isMegaETH) {
          await sleep(2000);
        }
        // Always check isGraduated flag directly
        const graduated = await publicClient.readContract({
          address: deployment.contracts.LaunchpadEngine as `0x${string}`,
          abi: LaunchpadEngineAbi,
          functionName: 'isGraduated',
          args: [marketAddress],
        }) as boolean;
        if (graduated) {
          console.log(`\n  ${success('MARKET GRADUATED!')} after ${tradesExecuted} trades\n`);
          return { success: true, data: { tradesExecuted, totalGas } };
        }
        consecutiveFailures = 0; // Reset on success
      } catch (err) {
        const decoded = decodeError(err as Error);

        try {
          const graduatedCheck = await readContractWithRpcFallback<boolean>(
            ctx.config.chain,
            ctx.config.rpc,
            {
              address: deployment.contracts.LaunchpadEngine as `0x${string}`,
              abi: LaunchpadEngineAbi,
              functionName: 'isGraduated',
              args: [marketAddress],
            },
          );
          if (graduatedCheck) {
            spinner.succeed(`Trade ${i + 1}: ${isBuy ? 'BUY' : 'SELL'} rejected (post-graduation)`);
            console.log(`\n  ${success('MARKET GRADUATED!')} after ${tradesExecuted} trades\n`);
            return { success: true, data: { tradesExecuted, totalGas } };
          }
        } catch {
        }

        // If it looks like a node glitch (random address or MegaETH garbage), retry
        const isGlitch = decoded.includes('RPC error (returned address)') 
          || decoded.includes('Internal Error')
          || (isMegaETH && decoded.includes('Unknown error'));

        if (isGlitch && attempts < maxAttempts) {
          await sleep(isMegaETH ? 3000 : 1000);
          continue;
        }

        spinner.fail(`Trade ${i + 1} failed: ${decoded}`);
        consecutiveFailures++;
        break; // Exit retry loop on hard error
      }
    }

    if (!success_trade && consecutiveFailures >= maxConsecutiveFailures) {
      console.log(warn(`  Stopping early after ${maxConsecutiveFailures} consecutive failures to save gas`));
      break;
    }

    // MegaETH has 10ms mini-blocks; wait for state to settle
    await sleep(ctx.config.chain.id === 6343 ? 2000 : 500);
  }

  // Final status
  const finalGraduated = await publicClient.readContract({
    address: deployment.contracts.LaunchpadEngine as `0x${string}`,
    abi: LaunchpadEngineAbi,
    functionName: 'isGraduated',
    args: [marketAddress],
  }) as boolean;

  console.log(`\n  Graduated: ${finalGraduated ? success('YES') : warn('NO')}`);
  console.log(`  Total gas used: ${totalGas.toString()}`);
  console.log('');

  return { success: true, data: { tradesExecuted, totalGas, graduated: finalGraduated } };
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export async function simulate(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketKey } = ctx;
  const walletClient = actorManager.currentWalletClient();
  const address = actorManager.currentAddress();

  if (!walletClient || !address) {
    return { success: false, message: 'No actor selected' };
  }

  if (!marketKey) {
    return { success: false, message: 'No market key selected. Use: setmarket <key>' };
  }

  const soothBook = deployment.contracts.SoothBook as `0x${string}` | undefined;
  if (!soothBook) {
    return { success: false, message: 'SoothBook address not found in deployment' };
  }

  const numOrders = args[0] ? Number.parseInt(args[0], 10) : 100;
  const avgSize = args[1] ? parseWad(args[1]) : 100n * WAD;
  const seed = args[2] ? Number.parseInt(args[2], 10) : Date.now();

  if (!Number.isInteger(numOrders) || numOrders <= 0) {
    return { success: false, message: 'numOrders must be a positive integer' };
  }
  if (avgSize <= 0n) {
    return { success: false, message: 'avgSize must be > 0' };
  }
  if (!Number.isFinite(seed)) {
    return { success: false, message: 'seed must be a number' };
  }

  const rng = mulberry32(seed);

  console.log(`\n  ${bold('Orderbook Simulation')}`);
  console.log('  ' + '─'.repeat(40));
  console.log(`  Orders:   ${numOrders}`);
  console.log(`  Avg Size: ${formatWad(avgSize)}`);
  console.log(`  Seed:     ${seed}`);
  console.log(`  ${dim('Press Enter to stop early')}`);

  const estimatedUsdcNeeded = avgSize * BigInt(numOrders) * 2n;
  const usdcBalance = await readContractWithRpcFallback<bigint>(
    ctx.config.chain,
    ctx.config.rpc,
    {
      address: deployment.contracts.BaseToken as `0x${string}`,
      abi: ABIS.BaseToken,
      functionName: 'balanceOf',
      args: [address],
    },
  );

  if (usdcBalance < estimatedUsdcNeeded) {
    const mintAmount = estimatedUsdcNeeded - usdcBalance + avgSize * 5n;
    const mintSpinner = new Spinner(`Minting ${formatWad(mintAmount)} USDC...`);
    mintSpinner.start();
    const mintHash = await walletClient.writeContract({
      address: deployment.contracts.BaseToken as `0x${string}`,
      abi: ABIS.BaseToken,
      functionName: 'mint',
      args: [address, mintAmount],
      gas: 500000n,
    });
    await actorManager.waitForTransactionReceipt(mintHash);
    mintSpinner.succeed(`Minted ${formatWad(mintAmount)} USDC`);
  }

  const approveSpinner = new Spinner('Approving SoothBook + OrderEngine...');
  approveSpinner.start();
  const approveSBHash = await walletClient.writeContract({
    address: deployment.contracts.BaseToken as `0x${string}`,
    abi: ABIS.BaseToken,
    functionName: 'approve',
    args: [soothBook, MAX_UINT256],
    gas: 500000n,
  });
  await actorManager.waitForTransactionReceipt(approveSBHash);
  const approveOEHash = await walletClient.writeContract({
    address: deployment.contracts.BaseToken as `0x${string}`,
    abi: ABIS.BaseToken,
    functionName: 'approve',
    args: [deployment.contracts.OrderEngine as `0x${string}`, MAX_UINT256],
    gas: 500000n,
  });
  await actorManager.waitForTransactionReceipt(approveOEHash);
  approveSpinner.succeed('SoothBook + OrderEngine approved');

  let stopRequested = false;
  const onStopInput = (data: Buffer | string) => {
    const input = data.toString();
    if (input.includes('\n') || input.includes('\r')) {
      stopRequested = true;
    }
  };
  process.stdin.on('data', onStopInput);

  let totalGas = 0n;
  let ordersPlaced = 0;
  let ordersCrossed = 0;
  let consecutiveFailures = 0;

  try {
    for (let i = 0; i < numOrders; i++) {
      if (stopRequested) {
        console.log(warn(`\n  Early stop requested after ${i} orders`));
        break;
      }

      const r = rng();
      const sizeMultiplierBps = 500n + BigInt(Math.floor(rng() * 1001));
      const amount = ((avgSize * sizeMultiplierBps) / 1000n) || WAD;
      const tick = 100 + Math.floor(rng() * 801);

      let action: 'buyyes' | 'buyno' | 'mint' | 'merge' = 'buyyes';
      if (r < 0.4) {
        action = 'buyyes';
      } else if (r < 0.8) {
        action = 'buyno';
      } else if (r < 0.9) {
        action = 'mint';
      } else {
        action = 'merge';
      }

      const spinner = new Spinner(`  Order ${i + 1}/${numOrders}: ${action.toUpperCase()} ${action === 'buyyes' || action === 'buyno' ? `@${tick} ` : ''}${formatWad(amount)}`);
      spinner.start();

      let successOrder = false;
      let attempts = 0;
      const maxAttempts = 3;

      while (!successOrder && attempts < maxAttempts) {
        attempts++;
        try {
          let likelyCross = false;
          let hash: `0x${string}`;

          if (action === 'buyyes') {
            const bestNoTick = await readContractWithRpcFallback<number>(ctx.config.chain, ctx.config.rpc, {
              address: soothBook,
              abi: ABIS.SoothBook,
              functionName: 'getBestTick',
              args: [marketKey, 0],
            });
            likelyCross = bestNoTick > 0 && tick + bestNoTick >= 1000;
            hash = await walletClient.writeContract({
              address: soothBook,
              abi: ABIS.SoothBook,
              functionName: 'buyYes',
              args: [marketKey, tick, amount, false, 0],
            });
          } else if (action === 'buyno') {
            const bestYesTick = await readContractWithRpcFallback<number>(ctx.config.chain, ctx.config.rpc, {
              address: soothBook,
              abi: ABIS.SoothBook,
              functionName: 'getBestTick',
              args: [marketKey, 1],
            });
            likelyCross = bestYesTick > 0 && tick + bestYesTick >= 1000;
            hash = await walletClient.writeContract({
              address: soothBook,
              abi: ABIS.SoothBook,
              functionName: 'buyNo',
              args: [marketKey, tick, amount, false, 0],
            });
          } else if (action === 'mint') {
            hash = await walletClient.writeContract({
              address: soothBook,
              abi: ABIS.SoothBook,
              functionName: 'mint',
              args: [marketKey, amount],
            });
          } else {
            const balances = await readContractWithRpcFallback<readonly [bigint, bigint]>(ctx.config.chain, ctx.config.rpc, {
              address: soothBook,
              abi: ABIS.SoothBook,
              functionName: 'getBalance',
              args: [marketKey, address],
            });
            const mergeAmount = balances[0] < balances[1] ? balances[0] : balances[1];
            if (mergeAmount <= 0n) {
              spinner.succeed(`Order ${i + 1}: MERGE skipped (no complete sets)`);
              successOrder = true;
              consecutiveFailures = 0;
              break;
            }
            hash = await walletClient.writeContract({
              address: soothBook,
              abi: ABIS.SoothBook,
              functionName: 'merge',
              args: [marketKey, mergeAmount < amount ? mergeAmount : amount],
            });
          }

          const receipt = await actorManager.waitForTransactionReceipt(hash);
          totalGas += receipt.gasUsed;
          ordersPlaced++;
          if (likelyCross) {
            ordersCrossed++;
          }
          spinner.succeed(`Order ${i + 1}: ${action.toUpperCase()} ${dim(`(gas: ${receipt.gasUsed})`)}`);
          successOrder = true;
          consecutiveFailures = 0;
        } catch (err) {
          const decoded = decodeError(err as Error);
          const transient = isTransientError(err as Error)
            || decoded.includes('Unknown error')
            || decoded.includes('Internal Error')
            || decoded.includes('nonce');

          if (transient && attempts < maxAttempts) {
            await sleep(1000);
            continue;
          }

          spinner.fail(`Order ${i + 1} failed: ${decoded}`);
          consecutiveFailures++;
          break;
        }
      }

      if (!successOrder && consecutiveFailures >= 3) {
        console.log(warn('  Stopping after 3 consecutive failures'));
        break;
      }

      await sleep(300);
    }
  } finally {
    process.stdin.off('data', onStopInput);
  }

  console.log('\n  ' + '─'.repeat(40));
  console.log(`  ${bold('Simulation Complete')}`);
  console.log(`  Orders placed: ${ordersPlaced}`);
  console.log(`  Orders crossed: ${ordersCrossed}`);
  console.log(`  Total gas used: ${totalGas.toString()}`);
  console.log('');

  return {
    success: true,
    data: {
      ordersPlaced,
      ordersCrossed,
      totalGas,
    },
  };
}

/**
 * Show comprehensive market status
 * Usage: marketstatus [address]
 */
export async function marketstatus(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketAddress: ctxMarket } = ctx;
  const publicClient = actorManager.getPublicClient();

  const marketAddress = args[0] ? args[0] as `0x${string}` : ctxMarket;

  if (!marketAddress) {
    return { success: false, message: 'No market address. Use: marketstatus <address> or setmarket first' };
  }

  console.log(`\n  ${bold('Market Status')}: ${shortAddress(marketAddress)}`);
  console.log('  ' + '═'.repeat(50));

  // 1. TruthMarket Status
  console.log(`\n  ${info('TruthMarket')}`);
  console.log('  ' + '─'.repeat(40));

  try {
    const [questionHash, startTime, deadline, creator, adjudicator, isLive, isResolving, isAttested, isSettled] = await Promise.all([
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'questionHash' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'startTime' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'deadline' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'creator' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'adjudicator' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'isLive' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'isResolving' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'isAttested' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'isSettled' }),
    ]);

    const startDate = new Date(Number(startTime) * 1000);
    const deadlineDate = new Date(Number(deadline) * 1000);

    const statusDisplay = isSettled ? success('SETTLED') : isAttested ? success('ATTESTED') : isResolving ? warn('RESOLVING') : isLive ? success('LIVE') : warn('INACTIVE');

    console.log(`  QuestionHash: ${(questionHash as string).slice(0, 18)}...`);
    console.log(`  Creator:    ${shortAddress(creator as string)}`);
    console.log(`  Adjudicator: ${shortAddress(adjudicator as string)}`);
    console.log(`  Starts:     ${startDate.toISOString().slice(0, 10)}`);
    console.log(`  Deadline:   ${Number(deadline) > 4102444800 ? 'No expiry' : deadlineDate.toISOString().slice(0, 10)}`);
    console.log(`  Status:     ${statusDisplay}`);

    if (isSettled || isAttested || isResolving) {
      const winningOutcome = await publicClient.readContract({
        address: marketAddress,
        abi: TruthMarketAbi,
        functionName: 'winningOutcome',
      });
      console.log(`  Outcome:    ${winningOutcome === 1 ? 'YES' : winningOutcome === 0 ? 'NO' : 'INVALID'}`);
    }
  } catch (err) {
    console.log(`  ${error('Not a TruthMarket or not deployed')}`);
    return { success: false, message: 'Failed to read TruthMarket' };
  }

  // 2. OrderEngine Status
  console.log(`\n  ${info('OrderEngine')}`);
  console.log('  ' + '─'.repeat(40));

  try {
    const isRegistered = await publicClient.readContract({
      address: deployment.contracts.OrderEngine as `0x${string}`,
      abi: OrderEngineAbi,
      functionName: 'isMarketRegistered',
      args: [marketAddress],
    }) as boolean;

    console.log(`  Registered: ${isRegistered ? success('YES') : warn('NO (pre-graduation)')}`);
  } catch {
    console.log(`  Registered: ${warn('NO')}`);
  }

  // 3. LaunchpadEngine Status
  console.log(`\n  ${info('LaunchpadEngine (AMM)')}`);
  console.log('  ' + '─'.repeat(40));

  try {
    const marketState = await publicClient.readContract({
      address: deployment.contracts.LaunchpadEngine as `0x${string}`,
      abi: LaunchpadEngineAbi,
      functionName: 'markets',
      args: [marketAddress],
    }) as [string, string, bigint, bigint, bigint];

    const initialized = marketState[0] !== '0x0000000000000000000000000000000000000000';

    if (initialized) {
      const [creator, lpToken, bBase, creatorDeposit, graduatedAt] = marketState;
      const isGraduated = await publicClient.readContract({
        address: deployment.contracts.LaunchpadEngine as `0x${string}`,
        abi: LaunchpadEngineAbi,
        functionName: 'isGraduated',
        args: [marketAddress],
      }) as boolean;

      console.log(`  Initialized: ${success('YES')}`);
      console.log(`  Creator:     ${shortAddress(creator)}`);
      console.log(`  LP Token:    ${shortAddress(lpToken)}`);
      console.log(`  bBase:       ${formatWad(bBase)}`);
      console.log(`  Deposit:     ${formatWad(creatorDeposit)} USDC`);
      console.log(`  Graduated:   ${isGraduated ? success('YES') : warn('NO')}`);
      if (graduatedAt > 0n) {
        console.log(`  Graduated At: ${new Date(Number(graduatedAt) * 1000).toISOString().slice(0, 10)}`);
      }

      // Get current price from AMMEngine
      try {
        const [, , price] = await publicClient.readContract({
          address: deployment.contracts.AMMEngine as `0x${string}`,
          abi: AMMEngineAbi,
          functionName: 'getMarketState',
          args: [marketAddress],
        }) as [bigint, bigint, bigint];

        console.log(`  YES Price:   ${(Number(price) / 1e18 * 100).toFixed(2)}%`);
      } catch {
        // Price not available
      }
    } else {
      console.log(`  Initialized: ${warn('NO')}`);
    }
  } catch {
    console.log(`  Initialized: ${warn('NO')}`);
  }

  console.log('');
  return { success: true };
}

/**
 * Settle a market (adjudicator only)
 * Usage: settle <outcome>
 * outcome: yes (1), no (0), invalid (2)
 */
export async function settle(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketAddress } = ctx;
  const walletClient = actorManager.currentWalletClient();
  const address = actorManager.currentAddress();

  if (!walletClient || !address) {
    return { success: false, message: 'No actor selected' };
  }

  if (!marketAddress) {
    return { success: false, message: 'No market selected. Use setmarket first.' };
  }

  if (args.length < 1) {
    console.log(`
  ${bold('Settle Market')}

  Usage: settle <outcome>

  Outcomes:
    yes, 1     - YES wins
    no, 0      - NO wins
    invalid, 2 - Market invalid (50/50 split)

  ${dim('Only the adjudicator can settle the market.')}
`);
    return { success: true };
  }

  const outcomeArg = args[0].toLowerCase();
  let outcome: number;
  switch (outcomeArg) {
    case 'yes':
    case '1':
      outcome = 1;
      break;
    case 'no':
    case '0':
      outcome = 0;
      break;
    case 'invalid':
    case '2':
      outcome = 2;
      break;
    default:
      return { success: false, message: `Invalid outcome: ${outcomeArg}. Use yes, no, or invalid.` };
  }

  const spinner = new Spinner(`Settling market as ${['NO', 'YES', 'INVALID'][outcome]}...`);
  spinner.start();

  try {
    const settleHash = await walletClient.writeContract({
      address: marketAddress,
      abi: TruthMarketAbi,
      functionName: 'settle',
      args: [outcome, 0n],
      gas: 500000n,
    });
    await actorManager.waitForTransactionReceipt(settleHash);
    spinner.succeed(`Market settled as ${['NO', 'YES', 'INVALID'][outcome]} ${dim(`(tx: ${settleHash.slice(0, 10)}...)`)}`);
    return { success: true, txHash: settleHash };
   } catch (err) {
     spinner.fail(`Settlement failed`);
     return { success: false, message: `Settlement failed: ${(err as Error).message}` };
   }
 }

 /**
  * Finalize a settled market (adjudicator only)
  * Usage: finalize
  */
 export async function finalize(ctx: CommandContext, args: string[]): Promise<CommandResult> {
   const { actorManager, deployment, marketAddress } = ctx;
   const walletClient = actorManager.currentWalletClient();
   const address = actorManager.currentAddress();

   if (!walletClient || !address) {
     return { success: false, message: 'No actor selected' };
   }

   if (!marketAddress) {
     return { success: false, message: 'No market selected. Use setmarket first.' };
   }

   const spinner = new Spinner(`Finalizing market...`);
   spinner.start();

   try {
     const finalizeHash = await walletClient.writeContract({
       address: marketAddress,
       abi: TruthMarketAbi,
       functionName: 'finalize',
       args: [],
       gas: 500000n,
     });
     await actorManager.waitForTransactionReceipt(finalizeHash);
     spinner.succeed(`Market finalized ${dim(`(tx: ${finalizeHash.slice(0, 10)}...)`)}`);
     return { success: true, txHash: finalizeHash };
   } catch (err) {
     spinner.fail(`Finalization failed`);
     return { success: false, message: `Finalization failed: ${(err as Error).message}` };
   }
 }

 /**
  * Redeem winning outcome tokens for USDC after settlement
  * Also redeems internal vault outcomes
  * Usage: redeem
  */
export async function redeem(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketAddress } = ctx;
  const walletClient = actorManager.currentWalletClient();
  const address = actorManager.currentAddress();
  const publicClient = actorManager.getPublicClient();

  if (!walletClient || !address) {
    return { success: false, message: 'No actor selected' };
  }

  if (!marketAddress) {
    return { success: false, message: 'No market selected. Use setmarket first.' };
  }

  const isSettled = await publicClient.readContract({
    address: deployment.contracts.OrderEngine as `0x${string}`,
    abi: OrderEngineAbi,
    functionName: 'isMarketSettled',
    args: [marketAddress],
  });

  if (!isSettled) {
    return { success: false, message: 'Market is not settled yet.' };
  }

  const winningOutcome = await publicClient.readContract({
    address: marketAddress,
    abi: TruthMarketAbi,
    functionName: 'winningOutcome',
  }) as number;

  console.log(`\n  ${bold('Redeeming Positions')}`);
  console.log('  ' + '─'.repeat(40));
  console.log(`  Winner: ${['NO', 'YES', 'INVALID'][winningOutcome]}`);

  const [yesBalance, noBalance] = await publicClient.readContract({
    address: deployment.contracts.OrderEngine as `0x${string}`,
    abi: OrderEngineAbi,
    functionName: 'getBalances',
    args: [marketAddress, address],
  }) as [bigint, bigint];

  console.log(`  ERC20 YES:    ${formatWad(yesBalance)}`);
  console.log(`  ERC20 NO:     ${formatWad(noBalance)}`);

  const totalTokens = yesBalance + noBalance;

  if (totalTokens > 0n) {
    const spinner = new Spinner('Redeeming ERC20 outcome tokens...');
    spinner.start();

    try {
      const hash = await walletClient.writeContract({
        address: deployment.contracts.OrderEngine as `0x${string}`,
        abi: OrderEngineAbi,
        functionName: 'redeem',
        args: [marketAddress, totalTokens],
        gas: 500000n,
      });
      await actorManager.waitForTransactionReceipt(hash);
      
      spinner.succeed(`Redeemed ${formatWad(totalTokens)} tokens ${dim(`(tx: ${shortTx(hash)})`)}`);
    } catch (err) {
      spinner.fail(`Token redeem failed: ${(err as Error).message.slice(0, 50)}`);
    }
  }

  const tokenValue = winningOutcome === 1 ? yesBalance : winningOutcome === 0 ? noBalance : (yesBalance + noBalance) / 2n;

  if (totalTokens === 0n) {
    console.log(`\n  ${warn('No positions to redeem')}`);
  } else {
    console.log(`\n  ${success(`Total redeemed: ~${formatWad(tokenValue)} USDC`)}`);
  }

  console.log('');
  return { success: true, data: { totalRedeemed: tokenValue } };
}

export async function redeemamm(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketAddress } = ctx;
  const walletClient = actorManager.currentWalletClient();
  const address = actorManager.currentAddress();
  const publicClient = actorManager.getPublicClient();

  if (!walletClient || !address) {
    return { success: false, message: 'No actor selected' };
  }

  if (!marketAddress) {
    return { success: false, message: 'No market selected. Use setmarket first.' };
  }

  const isSettled = await publicClient.readContract({
    address: marketAddress,
    abi: TruthMarketAbi,
    functionName: 'isSettled',
  }).catch(() => false);

  if (!isSettled) {
    return { success: false, message: 'Market is not settled yet.' };
  }

  const [ammYes, ammNo] = await publicClient.readContract({
    address: deployment.contracts.AMMEngine as `0x${string}`,
    abi: AMMEngineAbi,
    functionName: 'getPosition',
    args: [marketAddress, address],
  }) as [bigint, bigint];

  if (ammYes === 0n && ammNo === 0n) {
    console.log(`\n  ${warn('No AMM position to redeem')}`);
    return { success: true, data: { payout: 0n } };
  }

  console.log(`\n  ${bold('Redeeming AMM Position')}`);
  console.log('  ' + '─'.repeat(40));
  console.log(`  AMM YES: ${formatWad(ammYes)}`);
  console.log(`  AMM NO:  ${formatWad(ammNo)}`);

  const spinner = new Spinner('Settling AMM position...');
  spinner.start();

  try {
    const hash = await walletClient.writeContract({
      address: deployment.contracts.AMMEngine as `0x${string}`,
      abi: AMMEngineAbi,
      functionName: 'settlePosition',
      args: [marketAddress],
      gas: 300000n,
    });
    const receipt = await actorManager.waitForTransactionReceipt(hash);
    
    const winningOutcome = await publicClient.readContract({
      address: marketAddress,
      abi: TruthMarketAbi,
      functionName: 'winningOutcome',
    }) as number;
    
    const payout = winningOutcome === 1 ? ammYes : winningOutcome === 0 ? ammNo : (ammYes + ammNo) / 2n;
    spinner.succeed(`Settled AMM position for ${formatWad(payout)} USDC ${dim(`(tx: ${shortTx(hash)})`)}`);
    
    console.log('');
    return { success: true, data: { payout } };
  } catch (err) {
    spinner.fail(`AMM settle failed: ${(err as Error).message.slice(0, 60)}`);
    return { success: false, message: (err as Error).message };
  }
}

export async function redeemlp(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketAddress } = ctx;
  const walletClient = actorManager.currentWalletClient();
  const address = actorManager.currentAddress();
  const publicClient = actorManager.getPublicClient();

  if (!walletClient || !address) {
    return { success: false, message: 'No actor selected' };
  }

  if (!marketAddress) {
    return { success: false, message: 'No market selected. Use setmarket first.' };
  }

  const lpTokenAddress = await publicClient.readContract({
    address: deployment.contracts.LaunchpadEngine as `0x${string}`,
    abi: LaunchpadEngineAbi,
    functionName: 'getLPToken',
    args: [marketAddress],
  }) as `0x${string}`;

  if (lpTokenAddress === '0x0000000000000000000000000000000000000000') {
    return { success: false, message: 'Market not found in LaunchpadEngine' };
  }

  const lpBalance = await publicClient.readContract({
    address: lpTokenAddress as `0x${string}`,
    abi: ERC20Abi,
    functionName: 'balanceOf',
    args: [address],
  }) as bigint;

  if (lpBalance === 0n) {
    console.log(`\n  ${warn('No LP tokens to redeem')}`);
    return { success: true };
  }

  const amountArg = args[0]?.toLowerCase();
  let amount = lpBalance;
  if (amountArg && amountArg !== 'max' && amountArg !== 'all') {
    amount = parseWad(amountArg);
    if (amount > lpBalance) {
      return { success: false, message: `Insufficient LP balance: ${formatWad(lpBalance)}` };
    }
  }

  console.log(`\n  ${bold('Redeeming LP Tokens')}`);
  console.log('  ' + '─'.repeat(40));
  console.log(`  LP Balance:    ${formatWad(lpBalance)}`);
  console.log(`  Redeeming:     ${formatWad(amount)}`);

  const spinner = new Spinner('Redeeming LP tokens...');
  spinner.start();

  try {
    const hash = await walletClient.writeContract({
      address: deployment.contracts.AMMEngine as `0x${string}`,
      abi: AMMEngineAbi,
      functionName: 'redeemLP',
      args: [marketAddress, amount],
      gas: 1000000n,
    });
    const receipt = await actorManager.waitForTransactionReceipt(hash);
    spinner.succeed(`Redeemed ${formatWad(amount)} LP tokens ${dim(`(tx: ${shortTx(hash)})`)}`);
    console.log('');
    return { success: true, txHash: hash };
  } catch (err) {
    spinner.fail(`LP redemption failed`);
    return { success: false, message: `LP redemption failed: ${(err as Error).message}` };
  }
}

/**
 * Show profit/loss summary for current actor
 * Usage: pnl
 */
export async function pnl(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketAddress } = ctx;
  const address = actorManager.currentAddress();
  const publicClient = actorManager.getPublicClient();
  const actorName = actorManager.currentActor()?.name || 'unknown';

  if (!address) {
    return { success: false, message: 'No actor selected' };
  }

  if (!marketAddress) {
    return { success: false, message: 'No market selected. Use setmarket first.' };
  }

  let initialInvestment = 0n;
  if (args.length > 0 && args[0]) {
    const initialStr = args[0].replace(/,/g, '');
    const initialNum = parseFloat(initialStr);
    if (!isNaN(initialNum) && initialNum > 0) {
      initialInvestment = BigInt(Math.floor(initialNum * 1e18));
    }
  }

  console.log(`\n  ${bold(`P&L Summary: ${actorName}`)}`);
  console.log('  ' + '═'.repeat(50));

  const walletUsdc = await publicClient.readContract({
    address: deployment.contracts.BaseToken as `0x${string}`,
    abi: ERC20Abi,
    functionName: 'balanceOf',
    args: [address],
  }) as bigint;

  let yesTokens = 0n;
  let noTokens = 0n;
  try {
    [yesTokens, noTokens] = await publicClient.readContract({
      address: deployment.contracts.OrderEngine as `0x${string}`,
      abi: OrderEngineAbi,
      functionName: 'getBalances',
      args: [marketAddress, address],
    }) as [bigint, bigint];
  } catch {}

  let lpBalance = 0n;
  let lpValue = 0n;
  let creatorDeposit = 0n;
  let feesAccrued = 0n;
  let totalLPSupply = 0n;
  let lpYieldPool = 0n;
  let isGraduated = false;
  try {
    const marketState = await publicClient.readContract({
      address: deployment.contracts.LaunchpadEngine as `0x${string}`,
      abi: LaunchpadEngineAbi,
      functionName: 'markets',
      args: [marketAddress],
    }) as [string, string, bigint, bigint, bigint];

    const [, lpTokenAddress, , deposit] = marketState;
    creatorDeposit = deposit;

    isGraduated = await publicClient.readContract({
      address: deployment.contracts.LaunchpadEngine as `0x${string}`,
      abi: LaunchpadEngineAbi,
      functionName: 'isGraduated',
      args: [marketAddress],
    }) as boolean;

    if (lpTokenAddress !== '0x0000000000000000000000000000000000000000') {
      lpBalance = await publicClient.readContract({
        address: lpTokenAddress as `0x${string}`,
        abi: ERC20Abi,
        functionName: 'balanceOf',
        args: [address],
      }) as bigint;

      if (lpBalance > 0n) {
        lpValue = lpBalance; // LP token value approximation
      }
    }
  } catch {}

  let isSettled = false;
  let winningOutcome = -1;
  try {
    isSettled = await publicClient.readContract({
      address: marketAddress,
      abi: TruthMarketAbi,
      functionName: 'isSettled',
    }) as boolean;

    if (isSettled) {
      winningOutcome = await publicClient.readContract({
        address: marketAddress,
        abi: TruthMarketAbi,
        functionName: 'winningOutcome',
      }) as number;
    }
  } catch {}

  let yesValue = 0n;
  let noValue = 0n;

  if (isSettled) {
    if (winningOutcome === 1) {
      yesValue = yesTokens;
    } else if (winningOutcome === 0) {
      noValue = noTokens;
    } else {
      yesValue = yesTokens / 2n;
      noValue = noTokens / 2n;
    }
  } else {
    yesValue = yesTokens / 2n;
    noValue = noTokens / 2n;
  }

  const totalPositionValue = yesValue + noValue + lpValue;
  const totalValue = walletUsdc + totalPositionValue;

  console.log(`\n  ${info('USDC Holdings')}`);
  console.log('  ' + '─'.repeat(40));
  console.log(`  Wallet:        ${formatWad(walletUsdc).padStart(15)} USDC`);

  console.log(`\n  ${info('Positions')} ${isSettled ? dim(`(settled: ${['NO', 'YES', 'INVALID'][winningOutcome]})`) : dim('(live)')}`);
  console.log('  ' + '─'.repeat(40));
  
  if (yesTokens > 0n || noTokens > 0n) {
    console.log(`  YES tokens:    ${formatWad(yesTokens).padStart(15)} → ${formatWad(yesValue)} USDC`);
    console.log(`  NO tokens:     ${formatWad(noTokens).padStart(15)} → ${formatWad(noValue)} USDC`);
  }
  
  if (lpBalance > 0n) {
    console.log(`  LP tokens:     ${formatWad(lpBalance).padStart(15)} → ~${formatWad(lpValue)} USDC`);
  }

  if (yesTokens === 0n && noTokens === 0n && lpBalance === 0n) {
    console.log(dim('  No positions'));
  }

  if (creatorDeposit > 0n) {
    console.log(`\n  ${info('Pool')}`);
    console.log('  ' + '─'.repeat(40));
    console.log(`  Creator Deposit: ${formatWad(creatorDeposit).padStart(13)} USDC`);
  }

  console.log(`\n  ${info('Summary')}`);
  console.log('  ' + '─'.repeat(40));
  
  const liquidUsdc = walletUsdc;
  console.log(`  Liquid USDC:   ${formatWad(liquidUsdc).padStart(15)} USDC`);
  
  if (totalPositionValue > 0n) {
    console.log(`  Position Value:${formatWad(totalPositionValue).padStart(15)} USDC`);
  }
  
  console.log(`  ${bold('Total Value:')}   ${bold(formatWad(totalValue).padStart(15))} ${bold('USDC')}`);

  if (initialInvestment > 0n) {
    const pnlAmount = totalValue - initialInvestment;
    const pnlPercent = Number(pnlAmount * 10000n / initialInvestment) / 100;
    const pnlSign = pnlAmount >= 0n ? '+' : '';
    const pnlColor = pnlAmount >= 0n ? success : error;
    
    console.log('  ' + '─'.repeat(40));
    console.log(`  Initial:       ${formatWad(initialInvestment).padStart(15)} USDC`);
    console.log(`  ${bold('P&L:')}            ${pnlColor(`${pnlSign}${formatWad(pnlAmount).padStart(13)}`)} ${bold('USDC')} ${dim(`(${pnlSign}${pnlPercent.toFixed(2)}%)`)}`);
  }

  if (isSettled && (yesTokens > 0n || noTokens > 0n)) {
    console.log(`\n  ${warn('Unredeemed positions! Run: redeem')}`);
  }

  if (lpBalance > 0n && isSettled) {
    console.log(`\n  ${warn('Unredeemed LP! Run: redeemlp max')}`);
  }

  console.log('');
  return { success: true, data: { walletUsdc, yesValue, noValue, lpValue, totalValue, initialInvestment, pnl: totalValue - initialInvestment } };
}

/**
 * Transfer LP tokens to another actor
 * Usage: transferlp <actor> <amount|max>
 */
export async function transferlp(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketAddress } = ctx;
  const walletClient = actorManager.currentWalletClient();
  const address = actorManager.currentAddress();
  const publicClient = actorManager.getPublicClient();

  if (!walletClient || !address) {
    return { success: false, message: 'No actor selected' };
  }

  if (!marketAddress) {
    return { success: false, message: 'No market selected. Use setmarket first.' };
  }

  if (args.length < 2) {
    console.log(`
  ${bold('Transfer LP Tokens')}

  Usage: transferlp <actor> <amount|max>

  Examples:
    transferlp ellen 100    Transfer 100 LP tokens to ellen
    transferlp ellen max    Transfer all LP tokens to ellen

  ${dim('LP tokens can only be transferred BEFORE settlement.')}
`);
    return { success: true };
  }

  const targetActorName = args[0].toLowerCase();
  const targetActor = actorManager.listActors().find(a => a.name.toLowerCase() === targetActorName);
  if (!targetActor) {
    return { success: false, message: `Actor not found: ${targetActorName}. Available: ${actorManager.listActors().map(a => a.name).join(', ')}` };
  }

  const targetAddress = targetActor.account.address;
  if (targetAddress === address) {
    return { success: false, message: 'Cannot transfer to yourself' };
  }

  const lpTokenAddress = await publicClient.readContract({
    address: deployment.contracts.LaunchpadEngine as `0x${string}`,
    abi: LaunchpadEngineAbi,
    functionName: 'getLPToken',
    args: [marketAddress],
  }) as `0x${string}`;

  if (lpTokenAddress === '0x0000000000000000000000000000000000000000') {
    return { success: false, message: 'Market not found in LaunchpadEngine' };
  }

  const lpBalance = await publicClient.readContract({
    address: lpTokenAddress as `0x${string}`,
    abi: ERC20Abi,
    functionName: 'balanceOf',
    args: [address],
  }) as bigint;

  if (lpBalance === 0n) {
    return { success: false, message: 'No LP tokens to transfer' };
  }

  const amountArg = args[1]?.toLowerCase();
  let amount = lpBalance;
  if (amountArg && amountArg !== 'max' && amountArg !== 'all') {
    amount = parseWad(amountArg);
    if (amount > lpBalance) {
      return { success: false, message: `Insufficient LP balance: ${formatWad(lpBalance)}` };
    }
  }

  const spinner = new Spinner(`Transferring ${formatWad(amount)} LP to ${targetActorName}...`);
  spinner.start();

  try {
    const LPTokenTransferAbi = parseAbi([
      'function transfer(address to, uint256 amount) external returns (bool)',
    ]);

    const hash = await walletClient.writeContract({
      address: lpTokenAddress as `0x${string}`,
      abi: LPTokenTransferAbi,
      functionName: 'transfer',
      args: [targetAddress, amount],
      gas: 200000n,
    });
    await actorManager.waitForTransactionReceipt(hash);
    spinner.succeed(`Transferred ${formatWad(amount)} LP to ${targetActorName} ${dim(`(tx: ${shortTx(hash)})`)}`);
    return { success: true, txHash: hash };
  } catch (err) {
    const errMsg = (err as Error).message;
    if (errMsg.includes('TransfersLocked')) {
      spinner.fail('LP transfers are locked (market is settled)');
      return { success: false, message: 'LP transfers are locked after settlement' };
    }
    spinner.fail(`Transfer failed: ${errMsg.slice(0, 50)}`);
    return { success: false, message: errMsg };
  }
}

/**
 * Show trial period status for current market
 * Usage: trialstatus
 */
export async function trialstatus(ctx: CommandContext, _args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketAddress } = ctx;
  const publicClient = actorManager.getPublicClient();

  if (!marketAddress) {
    return { success: false, message: 'No market selected. Use setmarket first.' };
  }

  try {
    const [isGraduated, isTrialExpired] = await Promise.all([
      publicClient.readContract({
        address: deployment.contracts.LaunchpadEngine as `0x${string}`,
        abi: LaunchpadEngineAbi,
        functionName: 'isGraduated',
        args: [marketAddress],
      }) as Promise<boolean>,
      publicClient.readContract({
        address: deployment.contracts.LaunchpadEngine as `0x${string}`,
        abi: LaunchpadEngineAbi,
        functionName: 'isTrialExpiredWithoutGraduation',
        args: [marketAddress],
      }).catch(() => false) as Promise<boolean>,
    ]);

    const canDismiss = isTrialExpired && !isGraduated;

    console.log(`
  ${bold('Trial Period Status')}
  ────────────────────────────────────────
  Market:           ${shortAddress(marketAddress)}
  Is Graduated:     ${isGraduated ? success('YES') : 'NO'}
  Trial Expired:    ${isTrialExpired ? warn('YES') : 'NO'}
  Can Dismiss:      ${canDismiss ? warn('YES (trial expired, not graduated)') : 'NO'}
`);

    return {
      success: true,
      data: { isGraduated, isTrialExpired, canDismiss }
    };
  } catch (err) {
    return { success: false, message: `Failed to fetch trial status: ${(err as Error).message}` };
  }
}

/**
 * Dismiss market during trial period (creator only)
 * Usage: dismiss
 */
export async function dismiss(ctx: CommandContext, _args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketAddress } = ctx;
  const walletClient = actorManager.currentWalletClient();
  const address = actorManager.currentAddress();
  const publicClient = actorManager.getPublicClient();

  if (!walletClient || !address) {
    return { success: false, message: 'No actor selected' };
  }

  if (!marketAddress) {
    return { success: false, message: 'No market selected. Use setmarket first.' };
  }

  const isTrialExpired = await publicClient.readContract({
    address: deployment.contracts.LaunchpadEngine as `0x${string}`,
    abi: LaunchpadEngineAbi,
    functionName: 'isTrialExpiredWithoutGraduation',
    args: [marketAddress],
  }).catch(() => false) as boolean;

  if (!isTrialExpired) {
    return { success: false, message: 'Market cannot be dismissed (trial not expired or already graduated)' };
  }

  const spinner = new Spinner('Dismissing market...');
  spinner.start();

  try {
    const hash = await walletClient.writeContract({
      address: deployment.contracts.LaunchpadEngine as `0x${string}`,
      abi: LaunchpadEngineAbi,
      functionName: 'dismissMarket',
      args: [marketAddress],
      gas: 200000n,
    });

    await actorManager.waitForTransactionReceipt(hash);
    await sleep(3000);
    spinner.succeed(`Market dismissed! Traders can now claim refunds ${dim(`(tx: ${shortTx(hash)})`)}`);
    return { success: true, txHash: hash };
  } catch (err) {
    const errMsg = (err as Error).message;
    if (errMsg.includes('OnlyCreator')) {
      spinner.fail('Only the market creator can dismiss');
      return { success: false, message: 'Only creator can dismiss market' };
    }
    if (errMsg.includes('trial not ended')) {
      spinner.fail('Trial period has not ended yet');
      return { success: false, message: 'Trial period has not ended yet' };
    }
    spinner.fail(`Dismiss failed: ${errMsg.slice(0, 80)}`);
    return { success: false, message: errMsg };
  }
}

/**
 * Claim refund after market dismissal
 * Usage: claimrefund
 */
export async function claimrefund(ctx: CommandContext, _args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketAddress } = ctx;
  const walletClient = actorManager.currentWalletClient();
  const address = actorManager.currentAddress();
  const publicClient = actorManager.getPublicClient();

  if (!walletClient || !address) {
    return { success: false, message: 'No actor selected' };
  }

  if (!marketAddress) {
    return { success: false, message: 'No market selected. Use setmarket first.' };
  }

  const spinner = new Spinner('Claiming refund...');
  spinner.start();

  try {
    const hash = await walletClient.writeContract({
      address: deployment.contracts.LaunchpadEngine as `0x${string}`,
      abi: LaunchpadEngineAbi,
      functionName: 'claimRefund',
      args: [marketAddress],
      gas: 200000n,
    });

    await actorManager.waitForTransactionReceipt(hash);
    await sleep(3000);
    spinner.succeed(`Refunded ${formatWad(userLocked)} USDC ${dim(`(tx: ${shortTx(hash)})`)}`);
    return { success: true, txHash: hash, data: { refundAmount: userLocked } };
  } catch (err) {
    const errMsg = (err as Error).message;
    if (errMsg.includes('not dismissed')) {
      spinner.fail('Market is not dismissed');
      return { success: false, message: 'Market must be dismissed first' };
    }
    spinner.fail(`Claim refund failed: ${errMsg.slice(0, 80)}`);
    return { success: false, message: errMsg };
  }
}

export const marketCommands = {
  createmarket,
  graduate,
  simulate,
  marketstatus,
  settle,
  finalize,
  redeem,
  redeemamm,
  redeemlp,
  transferlp,
  pnl,
  trialstatus,
  dismiss,
  claimrefund,
};

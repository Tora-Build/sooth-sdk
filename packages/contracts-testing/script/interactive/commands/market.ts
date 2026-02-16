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
} from '../utils';
import { decodeEventLog, parseAbi, encodeFunctionData } from 'viem';

const TruthMarketAbi = parseAbi([
  'function question() view returns (string)',
  'function startTime() view returns (uint64)',
  'function deadline() view returns (uint64)',
  'function creator() view returns (address)',
  'function adjudicator() view returns (address)',
  'function isLive() view returns (bool)',
  'function isSettled() view returns (bool)',
  'function isFinalized() view returns (bool)',
  'function winningOutcome() view returns (uint8)',
  'function settle(uint8 outcome, uint64 tStar) external',
  'function finalize() external',
  'event MarketCreated(address indexed market, string question, uint64 startTime, uint64 deadline)',
]);

const CollateralizerAbi = parseAbi([
  'function registerMarket(address market, string name, string symbol) external returns (address yesToken, address noToken)',
  'function getOutcomeTokens(address market) view returns (address yesToken, address noToken)',
  'function isMarketRegistered(address market) view returns (bool)',
  'function redeem(address market, uint256 amount) external returns (uint256)',
  'function getBalances(address market, address user) view returns (uint256 yesBalance, uint256 noBalance)',
  'function isMarketSettled(address market) view returns (bool)',
]);

const ERC20Abi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
]);

const LaunchpadEngineAbi = parseAbi([
  'function createMarket(string question, uint64 startTime, uint64 deadline, address adjudicator, address guardian, uint256 initialLiquidity, uint256 adjudicatorAgentId, uint256 adjudicatorMinValidators) external returns (address market, uint256 lpTokens)',
  'function protocolConfig() view returns (address)',
  'function markets(address) view returns (address creator, address lpToken, uint256 bBase, uint256 bCurrent, uint256 creatorDeposit, uint256 feesAccrued, uint256 totalLPSupply, uint256 lpYieldPool, bool isGraduated, uint64 createdAt, uint64 graduatedAt)',
  'function getGraduationProgress(address market) view returns (uint256 feesAccrued, uint256 threshold, uint256 percentComplete)',
  'function tradePositions(address market, uint8 outcome, int256 deltaShares, uint256 maxCost) external returns (uint256)',
  'function preGradFeeBps() view returns (uint16)',
  'function postGradFeeBps() view returns (uint16)',
  'function protocolShareBps() view returns (uint16)',
  'function redeemLP(address market, uint256 lpAmount) external returns (uint256 usdcReturned)',
  // V11: Trial Period Functions
  'function dismissMarket(address market) external',
  'function claimRefund(address market) external returns (uint256)',
  'function trialStates(address market) view returns (uint64 trialEndTime, bool isDismissed, uint256 totalLockedCost)',
  'function userLockedCost(address market, address user) view returns (uint256)',
  'function DEFAULT_TRIAL_PERIOD() view returns (uint64)',
]);

const AMMEngineAbi = parseAbi([
  'function getPrice(address market, uint8 outcome) view returns (uint256)',
  'function getPosition(address market, address user) view returns (uint256 yesShares, uint256 noShares)',
  'function settlePosition(address market) external returns (uint256 payout)',
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
        address: deployment.contracts.MockUSDC as `0x${string}`,
        abi: ABIS.MockUSDC,
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
        address: deployment.contracts.MockUSDC as `0x${string}`,
        abi: ABIS.MockUSDC,
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
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
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
    const protocolConfig = await readContractWithRpcFallback<`0x${string}`>(
      ctx.config.chain,
      ctx.config.rpc,
      {
        address: deployment.contracts.LaunchpadEngine as `0x${string}`,
        abi: LaunchpadEngineAbi,
        functionName: 'protocolConfig',
        args: [],
      },
    );

    const createHash = await walletClient.writeContract({
      address: deployment.contracts.LaunchpadEngine as `0x${string}`,
      abi: LaunchpadEngineAbi,
      functionName: 'createMarket',
      args: [template.question, startTime, deadline, adjudicatorAddress, protocolConfig, liquidityWad, 0n, 0n],
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

  // Get current graduation status
  let progress: [bigint, bigint, bigint];
  try {
    progress = await publicClient.readContract({
      address: deployment.contracts.LaunchpadEngine as `0x${string}`,
      abi: LaunchpadEngineAbi,
      functionName: 'getGraduationProgress',
      args: [marketAddress],
    }) as [bigint, bigint, bigint];
  } catch (err) {
    return { success: false, message: `Market not found in LaunchpadEngine: ${(err as Error).message}` };
  }

  const [feesAccrued, threshold, percentComplete] = progress;

  // Also check if actually graduated on-chain
  const marketState = await publicClient.readContract({
    address: deployment.contracts.LaunchpadEngine as `0x${string}`,
    abi: LaunchpadEngineAbi,
    functionName: 'markets',
    args: [marketAddress],
  }) as [string, string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, bigint, bigint];
  const isGraduated = marketState[8];

  // percentComplete is in basis points (10000 = 100%)
  const progressPct = Number(percentComplete) / 100;

  console.log(`\n  ${bold('Graduation Status')}`);
  console.log('  ' + '─'.repeat(40));
  console.log(`  Fees Accrued: ${formatWad(feesAccrued)} USDC`);
  console.log(`  Threshold:    ${formatWad(threshold)} USDC`);
  console.log(`  Progress:     ${progressPct.toFixed(1)}%`);
  console.log(`  Graduated:    ${isGraduated ? success('Yes') : warn('No')}`);

  if (isGraduated) {
    console.log(`\n  ${success('Market is already graduated!')}\n`);
    return { success: true };
  }

  // If fees >= threshold but not graduated, do one small trade to trigger graduation
  if (percentComplete >= 10000n) {
    console.log(`\n  ${warn('Fees reached threshold but not graduated yet. Triggering graduation...')}`);

    // Approve and do a tiny trade to trigger graduation
    const tinyTrade = WAD; // 1 share
    await walletClient.writeContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'approve',
      args: [deployment.contracts.LaunchpadEngine as `0x${string}`, MAX_UINT256],
      gas: 500000n, // High gas for Monad testnet
    });

    const hash = await walletClient.writeContract({
      address: deployment.contracts.LaunchpadEngine as `0x${string}`,
      abi: LaunchpadEngineAbi,
      functionName: 'tradePositions',
      args: [marketAddress, 1, tinyTrade, MAX_UINT256],
      gas: 5000000n,
    });
    await actorManager.waitForTransactionReceipt(hash);

    console.log(`  ${success('MARKET GRADUATED!')}\n`);
    return { success: true };
  }

  // Parse number of steps (default 8)
  const numTrades = args[0] ? parseInt(args[0], 10) : 8;

  // Get fee rate to calculate required volume
  const feeBpsRaw = await publicClient.readContract({
    address: deployment.contracts.LaunchpadEngine as `0x${string}`,
    abi: LaunchpadEngineAbi,
    functionName: 'preGradFeeBps',
  });
  const feeBps = BigInt(Number(feeBpsRaw));

  // Calculate trade size to reach 110% of threshold
  // Fee = cost * feeBps / 10000
  // Total volume needed = targetFees * 10000 / feeBps
  // Each round-trip has 2 trades (buy + sell), so divide by numTrades * 2
  const remaining = threshold - feesAccrued;
  const targetFees = (remaining * 110n) / 100n; // 110% of remaining

  const numTradesBigInt = BigInt(numTrades);
  // Volume needed = targetFees * 10000 / feeBps
  // IMPORTANT: tradeSize is in SHARES, but fee is charged on COST (USDC spent)
  // With LMSR at ~50% price, cost ≈ 0.5 × shares
  // So we need to double the share amount to get the target cost/fees
  //
  // With alternating BUY/SELL where SELL is half size:
  // - numTrades/2 BUY trades at tradeSize (cost ≈ tradeSize * 0.5)
  // - numTrades/2 SELL trades at tradeSize/2 (cost ≈ tradeSize * 0.25)
  // Total cost ≈ (numTrades/2) * tradeSize * 0.5 + (numTrades/2) * tradeSize * 0.25
  //            = numTrades * tradeSize * 0.375
  // So: tradeSize = volumeNeeded / (0.375 * numTrades) = volumeNeeded * 8 / (3 * numTrades)
  const volumeNeeded = (targetFees * 10000n) / feeBps;
  const tradeSize = (volumeNeeded * 8n) / (3n * numTradesBigInt);

  console.log(`\n  Remaining to graduate: ${formatWad(remaining)} USDC`);
  console.log(`  Target fees (110%):    ${formatWad(targetFees)} USDC`);
  console.log(`  Fee rate:              ${Number(feeBps) / 100}%`);
  console.log(`  Trade size:            ${formatWad(tradeSize)} shares`);
  console.log(`  Steps:                 ${numTrades}`);
  console.log('');

  // Ensure sufficient USDC
  const requiredUsdc = tradeSize * BigInt(numTrades) * 2n; // Rough estimate
  const usdcBalance = await readContractWithRpcFallback<bigint>(
    ctx.config.chain,
    ctx.config.rpc,
    {
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'balanceOf',
      args: [address],
    },
  );

  if (usdcBalance < requiredUsdc) {
    console.log(warn(`  Low USDC balance. Minting more...`));
    const mintHash = await walletClient.writeContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'mint',
      args: [address, requiredUsdc * 2n],
      gas: 500000n, // High gas for Monad testnet
    });
    await actorManager.waitForTransactionReceipt(mintHash);
    console.log(success('  Minted USDC'));
  }

  // Approve LaunchpadEngine
  const approveHash = await walletClient.writeContract({
    address: deployment.contracts.MockUSDC as `0x${string}`,
    abi: ABIS.MockUSDC,
    functionName: 'approve',
    args: [deployment.contracts.LaunchpadEngine as `0x${string}`, MAX_UINT256],
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
        // MegaETH (chain 6343): skip mid-trade reads to avoid RPC corruption, use high gas always
        // Other chains: check progress and use higher gas near graduation threshold
        let gasLimit = 10_000_000n;
        
        if (isMegaETH) {
          // MegaETH: 60M gas for graduation tx (code deposit = 10k gas/byte, 2 contracts ~4.4KB = 44M storage gas)
          gasLimit = 60_000_000n;
        } else {
          const [, , currentPercent] = await publicClient.readContract({
            address: deployment.contracts.LaunchpadEngine as `0x${string}`,
            abi: LaunchpadEngineAbi,
            functionName: 'getGraduationProgress',
            args: [marketAddress],
          }) as [bigint, bigint, bigint];

          if (currentPercent >= 10000n) {
            spinner.succeed(`Trade ${i + 1}: ${isBuy ? 'BUY' : 'SELL'} skipped (already graduated)`);
            console.log(`\n  ${success('MARKET GRADUATED!')} after ${tradesExecuted} trades\n`);
            return { success: true, data: { tradesExecuted, totalGas } };
          }

          // Use 30M if we are > 90% progress, otherwise 5M is enough for trades
          gasLimit = currentPercent > 9000n ? 30_000_000n : 5_000_000n;
        }

        let hash: `0x${string}`;
        if (isMegaETH) {
          // MegaETH: use raw sendTransaction to bypass viem simulation
          const data = encodeFunctionData({
            abi: LaunchpadEngineAbi,
            functionName: 'tradePositions',
            args: [marketAddress, outcome, delta, maxCostOrMinProceeds],
          });
          hash = await walletClient.sendTransaction({
            to: deployment.contracts.LaunchpadEngine as `0x${string}`,
            data,
            gas: gasLimit,
          });
        } else {
          hash = await walletClient.writeContract({
            address: deployment.contracts.LaunchpadEngine as `0x${string}`,
            abi: LaunchpadEngineAbi,
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
        // Always check isGraduated flag directly - don't rely on percent
        // (after graduation, getGraduationProgress may return 0% as fees reset)
        const mktState = await publicClient.readContract({
          address: deployment.contracts.LaunchpadEngine as `0x${string}`,
          abi: LaunchpadEngineAbi,
          functionName: 'markets',
          args: [marketAddress],
        }) as [string, string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, bigint, bigint];
        if (mktState[8]) {
          console.log(`\n  ${success('MARKET GRADUATED!')} after ${tradesExecuted} trades\n`);
          return { success: true, data: { tradesExecuted, totalGas } };
        }
        consecutiveFailures = 0; // Reset on success
      } catch (err) {
        const decoded = decodeError(err as Error);

        try {
          const mktState = await readContractWithRpcFallback<readonly [string, string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, bigint, bigint]>(
            ctx.config.chain,
            ctx.config.rpc,
            {
              address: deployment.contracts.LaunchpadEngine as `0x${string}`,
              abi: LaunchpadEngineAbi,
              functionName: 'markets',
              args: [marketAddress],
            },
          );
          if (mktState[8]) {
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
  const [finalFees, finalThreshold, finalPercent] = await publicClient.readContract({
    address: deployment.contracts.LaunchpadEngine as `0x${string}`,
    abi: LaunchpadEngineAbi,
    functionName: 'getGraduationProgress',
    args: [marketAddress],
  }) as [bigint, bigint, bigint];

  console.log(`\n  Final Progress: ${(Number(finalPercent) / 100).toFixed(1)}%`);
  console.log(`  Fees: ${formatWad(finalFees)} / ${formatWad(finalThreshold)} USDC`);
  console.log(`  Total gas used: ${totalGas.toString()}`);
  console.log('');

  return { success: true, data: { tradesExecuted, totalGas, percentComplete: Number(finalPercent) / 100 } };
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
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'balanceOf',
      args: [address],
    },
  );

  if (usdcBalance < estimatedUsdcNeeded) {
    const mintAmount = estimatedUsdcNeeded - usdcBalance + avgSize * 5n;
    const mintSpinner = new Spinner(`Minting ${formatWad(mintAmount)} USDC...`);
    mintSpinner.start();
    const mintHash = await walletClient.writeContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'mint',
      args: [address, mintAmount],
      gas: 500000n,
    });
    await actorManager.waitForTransactionReceipt(mintHash);
    mintSpinner.succeed(`Minted ${formatWad(mintAmount)} USDC`);
  }

  const approveSpinner = new Spinner('Approving SoothBook spending...');
  approveSpinner.start();
  const approveHash = await walletClient.writeContract({
    address: deployment.contracts.MockUSDC as `0x${string}`,
    abi: ABIS.MockUSDC,
    functionName: 'approve',
    args: [soothBook, MAX_UINT256],
    gas: 500000n,
  });
  await actorManager.waitForTransactionReceipt(approveHash);
  approveSpinner.succeed('SoothBook approved');

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
              args: [marketKey, tick, amount, false, 0n],
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
              args: [marketKey, tick, amount, false, 0n],
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
    const [question, startTime, deadline, creator, adjudicator, isLive, isSettled, isFinalized] = await Promise.all([
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'question' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'startTime' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'deadline' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'creator' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'adjudicator' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'isLive' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'isSettled' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'isFinalized' }),
    ]);

    const startDate = new Date(Number(startTime) * 1000);
    const deadlineDate = new Date(Number(deadline) * 1000);
    const isActive = isLive && !isSettled;

    console.log(`  Question:   ${(question as string).slice(0, 50)}${(question as string).length > 50 ? '...' : ''}`);
    console.log(`  Creator:    ${shortAddress(creator as string)}`);
    console.log(`  Adjudicator: ${shortAddress(adjudicator as string)}`);
    console.log(`  Starts:     ${startDate.toISOString().slice(0, 10)}`);
    console.log(`  Deadline:   ${deadlineDate.toISOString().slice(0, 10)}`);
    console.log(`  Status:     ${isActive ? success('LIVE') : isFinalized ? success('FINALIZED') : isSettled ? dim('SETTLED') : warn('INACTIVE')}`);

    if (isSettled) {
      const winningOutcome = await publicClient.readContract({
        address: marketAddress,
        abi: TruthMarketAbi,
        functionName: 'winningOutcome',
      });
      console.log(`  Winner:     ${winningOutcome === 1 ? 'YES' : winningOutcome === 0 ? 'NO' : 'INVALID'}`);
    }
  } catch (err) {
    console.log(`  ${error('Not a TruthMarket or not deployed')}`);
    return { success: false, message: 'Failed to read TruthMarket' };
  }

  // 2. Collateralizer Status
  console.log(`\n  ${info('Collateralizer')}`);
  console.log('  ' + '─'.repeat(40));

  try {
    const [yesToken, noToken] = await publicClient.readContract({
      address: deployment.contracts.Collateralizer as `0x${string}`,
      abi: CollateralizerAbi,
      functionName: 'getOutcomeTokens',
      args: [marketAddress],
    }) as [string, string];

    const registered = yesToken !== '0x0000000000000000000000000000000000000000';
    console.log(`  Registered: ${registered ? success('YES') : warn('NO')}`);
    if (registered) {
      console.log(`  YES Token:  ${shortAddress(yesToken)}`);
      console.log(`  NO Token:   ${shortAddress(noToken)}`);
    }
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
    }) as any;

    const initialized = marketState[0] !== '0x0000000000000000000000000000000000000000';

    if (initialized) {
      console.log(`  Initialized: ${success('YES')}`);
      console.log(`  Creator:     ${shortAddress(marketState[0])}`);
      console.log(`  LP Token:    ${shortAddress(marketState[1])}`);
      console.log(`  bBase:       ${formatWad(marketState[2])}`);
      console.log(`  bCurrent:    ${formatWad(marketState[3])}`);
      console.log(`  Deposit:     ${(Number(marketState[4]) / 1e6).toFixed(2)} USDC`);
      console.log(`  Fees:        ${formatWad(marketState[5])} USDC`);
      console.log(`  LP Supply:   ${formatWad(marketState[6])}`);
      console.log(`  Graduated:   ${marketState[8] ? success('YES') : warn('NO')}`);

      if (!marketState[8]) {
        const [feesAccrued, threshold, percent] = await publicClient.readContract({
          address: deployment.contracts.LaunchpadEngine as `0x${string}`,
          abi: LaunchpadEngineAbi,
          functionName: 'getGraduationProgress',
          args: [marketAddress],
        }) as [bigint, bigint, bigint];

        console.log(`  Progress:    ${(Number(percent) / 100).toFixed(1)}% (${formatWad(feesAccrued)}/${formatWad(threshold)} USDC)`);
      }

      // Get current price
      try {
        const yesPrice = await publicClient.readContract({
          address: deployment.contracts.AMMEngine as `0x${string}`,
          abi: AMMEngineAbi,
          functionName: 'getPrice',
          args: [marketAddress, 1],
        }) as bigint;

        console.log(`  YES Price:   ${(Number(yesPrice) / 1e18 * 100).toFixed(2)}%`);
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
    address: deployment.contracts.Collateralizer as `0x${string}`,
    abi: CollateralizerAbi,
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
    address: deployment.contracts.Collateralizer as `0x${string}`,
    abi: CollateralizerAbi,
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
        address: deployment.contracts.Collateralizer as `0x${string}`,
        abi: CollateralizerAbi,
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

  const marketState = await publicClient.readContract({
    address: deployment.contracts.LaunchpadEngine as `0x${string}`,
    abi: LaunchpadEngineAbi,
    functionName: 'markets',
    args: [marketAddress],
  }) as [string, string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, bigint, bigint];

  const [, lpTokenAddress, , , , , totalLPSupply] = marketState;

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
  console.log(`  Total Supply:  ${formatWad(totalLPSupply)}`);
  console.log(`  Share:         ${((Number(amount) / Number(totalLPSupply)) * 100).toFixed(2)}%`);

  const spinner = new Spinner('Redeeming LP tokens...');
  spinner.start();

  try {
    const hash = await walletClient.writeContract({
      address: deployment.contracts.LaunchpadEngine as `0x${string}`,
      abi: LaunchpadEngineAbi,
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
    address: deployment.contracts.MockUSDC as `0x${string}`,
    abi: ERC20Abi,
    functionName: 'balanceOf',
    args: [address],
  }) as bigint;

  let yesTokens = 0n;
  let noTokens = 0n;
  try {
    [yesTokens, noTokens] = await publicClient.readContract({
      address: deployment.contracts.Collateralizer as `0x${string}`,
      abi: CollateralizerAbi,
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
  let protocolShareBps = 2000n;
  try {
    const marketState = await publicClient.readContract({
      address: deployment.contracts.LaunchpadEngine as `0x${string}`,
      abi: LaunchpadEngineAbi,
      functionName: 'markets',
      args: [marketAddress],
    }) as [string, string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, bigint, bigint];

    const [, lpTokenAddress, , , deposit, fees, supply, yieldPool, graduated] = marketState;
    creatorDeposit = deposit;
    feesAccrued = fees;
    totalLPSupply = supply;
    lpYieldPool = yieldPool;
    isGraduated = graduated;

    try {
      const rawProtocolShareBps = await publicClient.readContract({
        address: deployment.contracts.LaunchpadEngine as `0x${string}`,
        abi: LaunchpadEngineAbi,
        functionName: 'protocolShareBps',
      }) as unknown;
      protocolShareBps = BigInt(Number(rawProtocolShareBps));
    } catch {}

    if (lpTokenAddress !== '0x0000000000000000000000000000000000000000') {
      lpBalance = await publicClient.readContract({
        address: lpTokenAddress as `0x${string}`,
        abi: ERC20Abi,
        functionName: 'balanceOf',
        args: [address],
      }) as bigint;

      if (lpBalance > 0n && totalLPSupply > 0n) {
        const poolValue = creatorDeposit + feesAccrued;
        lpValue = (poolValue * lpBalance) / totalLPSupply;
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

  if (feesAccrued > 0n || lpYieldPool > 0n) {
    console.log(`\n  ${info('Fee Distribution')}`);
    console.log('  ' + '─'.repeat(40));
    
    const lpShareBps = 10000n - protocolShareBps;
    const postGradFees = lpShareBps > 0n ? (lpYieldPool * 10000n) / lpShareBps : 0n;
    const protocolEarnings = postGradFees - lpYieldPool;
    const preGradFees = feesAccrued - postGradFees;
    
    if (preGradFees > 0n) {
      console.log(`  Pre-grad fees: ${formatWad(preGradFees).padStart(15)} USDC ${dim('(→ LP Pool)')}`);
    }
    
    if (isGraduated && postGradFees > 0n) {
      console.log(`  Post-grad fees:${formatWad(postGradFees).padStart(15)} USDC`);
      console.log(`    → LP Pool:   ${formatWad(lpYieldPool).padStart(15)} USDC ${dim(`(${100 - Number(protocolShareBps) / 100}%)`)}`);
      console.log(`    → Protocol:  ${formatWad(protocolEarnings).padStart(15)} USDC ${dim(`(${Number(protocolShareBps) / 100}%)`)}`);
    }
    
    console.log(`  Pool Total:    ${formatWad(creatorDeposit + feesAccrued).padStart(15)} USDC`);
    
    if (lpBalance > 0n && totalLPSupply > 0n) {
      const userFeeShare = (feesAccrued * lpBalance) / totalLPSupply;
      console.log(`  Your Share:    ${formatWad(userFeeShare).padStart(15)} USDC ${dim(`(${((Number(lpBalance) / Number(totalLPSupply)) * 100).toFixed(1)}% of pool)`)}`);
    }
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

  const marketState = await publicClient.readContract({
    address: deployment.contracts.LaunchpadEngine as `0x${string}`,
    abi: LaunchpadEngineAbi,
    functionName: 'markets',
    args: [marketAddress],
  }) as [string, string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, bigint, bigint];

  const lpTokenAddress = marketState[1];
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
    const trialState = await publicClient.readContract({
      address: deployment.contracts.LaunchpadEngine as `0x${string}`,
      abi: LaunchpadEngineAbi,
      functionName: 'trialStates',
      args: [marketAddress],
    }) as readonly [bigint, boolean, bigint];

    const [trialEndTime, isDismissed, totalLockedCost] = trialState;

    const trialDurationSeconds = await publicClient.readContract({
      address: deployment.contracts.LaunchpadEngine as `0x${string}`,
      abi: LaunchpadEngineAbi,
      functionName: 'DEFAULT_TRIAL_PERIOD',
      args: [],
    }) as bigint;

    const now = BigInt(Math.floor(Date.now() / 1000));
    const isInTrialPeriod = now < trialEndTime && !isDismissed;
    const trialEnded = now >= trialEndTime;
    const trialEndDate = new Date(Number(trialEndTime) * 1000);

    // Check graduation status
    const mktState = await publicClient.readContract({
      address: deployment.contracts.LaunchpadEngine as `0x${string}`,
      abi: LaunchpadEngineAbi,
      functionName: 'markets',
      args: [marketAddress],
    }) as readonly [string, string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, bigint, bigint];
    const isGraduated = mktState[8];

    // Dismiss is allowed: after trial ends AND not graduated AND not already dismissed
    const canDismiss = trialEnded && !isGraduated && !isDismissed;

    console.log(`
  ${bold('Trial Period Status')}
  ────────────────────────────────────────
  Market:           ${shortAddress(marketAddress)}
  Trial Duration:   ${Number(trialDurationSeconds) / 86400} days
  Trial End Time:   ${trialEndDate.toISOString()}
  Trial Ended:      ${trialEnded ? success('YES') : 'NO'}
  Is Graduated:     ${isGraduated ? success('YES') : 'NO'}
  Is Dismissed:     ${isDismissed ? warn('YES') : 'NO'}
  Can Dismiss:      ${canDismiss ? warn('YES (trial ended, not graduated)') : 'NO'}
  Total Locked:     ${formatWad(totalLockedCost)} USDC
`);

    const actors = actorManager.listActors();
    const lockedCosts: { name: string; locked: bigint }[] = [];

    for (const actor of actors) {
      const userLocked = await publicClient.readContract({
        address: deployment.contracts.LaunchpadEngine as `0x${string}`,
        abi: LaunchpadEngineAbi,
        functionName: 'userLockedCost',
        args: [marketAddress, actor.account.address],
      }) as bigint;

      if (userLocked > 0n) {
        lockedCosts.push({ name: actor.name, locked: userLocked });
      }
    }

    if (lockedCosts.length > 0) {
      console.log(`  ${bold('User Locked Costs:')}`);
      for (const { name, locked } of lockedCosts) {
        console.log(`    ${name}: ${formatWad(locked)} USDC`);
      }
      console.log('');
    }

    return {
      success: true,
      data: { trialEndTime, isDismissed, totalLockedCost, isInTrialPeriod, trialEnded, isGraduated, canDismiss }
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

  const trialState = await publicClient.readContract({
    address: deployment.contracts.LaunchpadEngine as `0x${string}`,
    abi: LaunchpadEngineAbi,
    functionName: 'trialStates',
    args: [marketAddress],
  }) as readonly [bigint, boolean, bigint];

  const [trialEndTime, isDismissed, totalLockedCost] = trialState;

  if (isDismissed) {
    return { success: false, message: 'Market already dismissed' };
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now < trialEndTime) {
    return { success: false, message: 'Trial period not ended yet' };
  }

  const spinner = new Spinner(`Dismissing market (${formatWad(totalLockedCost)} USDC locked)...`);
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

  const trialState = await publicClient.readContract({
    address: deployment.contracts.LaunchpadEngine as `0x${string}`,
    abi: LaunchpadEngineAbi,
    functionName: 'trialStates',
    args: [marketAddress],
  }) as readonly [bigint, boolean, bigint];

  const [, isDismissed] = trialState;

  if (!isDismissed) {
    return { success: false, message: 'Market is not dismissed. Cannot claim refund.' };
  }

  const userLocked = await publicClient.readContract({
    address: deployment.contracts.LaunchpadEngine as `0x${string}`,
    abi: LaunchpadEngineAbi,
    functionName: 'userLockedCost',
    args: [marketAddress, address],
  }) as bigint;

  if (userLocked === 0n) {
    return { success: false, message: 'No locked cost to refund' };
  }

  const spinner = new Spinner(`Claiming refund of ${formatWad(userLocked)} USDC...`);
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

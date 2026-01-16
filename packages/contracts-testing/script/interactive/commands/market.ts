/**
 * Market Commands
 * create, graduate, status, simulate
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
  isContractError,
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
  'function winningOutcome() view returns (uint8)',
  'event MarketCreated(address indexed market, string question, uint64 startTime, uint64 deadline)',
]);

const CollateralizerAbi = parseAbi([
  'function registerMarket(address market, string name, string symbol) external returns (address yesToken, address noToken)',
  'function getOutcomeTokens(address market) view returns (address yesToken, address noToken)',
  'function isMarketRegistered(address market) view returns (bool)',
]);

const LaunchpadEngineAbi = parseAbi([
  'function createMarket(string question, uint64 startTime, uint64 deadline, address adjudicator, address guardian, uint256 initialLiquidity) external returns (address market, uint256 lpTokens)',
  'function markets(address) view returns (address creator, uint256 bBase, uint256 bCurrent, uint256 creatorDeposit, uint256 feesAccrued, uint256 totalLPSupply, uint256 lpYieldPool, bool isGraduated, uint64 createdAt, uint64 graduatedAt)',
  'function getGraduationProgress(address market) view returns (uint256 feesAccrued, uint256 threshold, uint256 percentComplete)',
  'function tradePositions(address market, uint8 outcome, int256 deltaShares, uint256 maxCost) external returns (uint256)',
  'function preGradFeeBps() view returns (uint16)',
  'function postGradFeeBps() view returns (uint16)'
]);

const AMMEngineAbi = parseAbi([
  'function getPrice(address market, uint8 outcome) view returns (uint256)',
  'function getPosition(address market, address user) view returns (uint256 yesShares, uint256 noShares)',
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

  Usage: createmarket <template> [liquidity]

  Templates: ${Object.keys(MARKET_TEMPLATES).join(', ')}

  ${info('Examples:')}
    createmarket alien 500      Create ALIEN market with 500 USDC
    createmarket btc100k 1000   Create BTC100K market with 1000 USDC

  ${dim('This will:')}
    1. Approve USDC
    2. Create market via LaunchpadEngine
`);
    return { success: true };
  }

  const templateName = args[0].toLowerCase();
  const template = MARKET_TEMPLATES[templateName];

  if (!template) {
    return { success: false, message: `Unknown template: ${templateName}. Available: ${Object.keys(MARKET_TEMPLATES).join(', ')}` };
  }

  if (templateName === 'custom') {
    return { success: false, message: 'Custom template not yet supported. Use alien or btc100k.' };
  }

  // Parse liquidity as LMSR 'b' parameter (WAD, 18 decimals)
  // User specifies in whole units, e.g., "500" = 500 WAD = 500e18
  const liquidityWad = args[1] ? BigInt(Math.floor(parseFloat(args[1]))) * WAD : 500n * WAD;

  console.log(`\n  ${bold('Creating Market: ' + template.name)}`);
  console.log('  ' + '═'.repeat(50));
  console.log(`  Question:  ${template.question}`);
  console.log(`  Name:      ${template.name}`);
  console.log(`  Liquidity: ${formatWad(liquidityWad)} (b parameter)`);
  console.log(`  Deadline:  ${template.deadline}`);
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
    const createHash = await walletClient.writeContract({
      address: deployment.contracts.LaunchpadEngine as `0x${string}`,
      abi: LaunchpadEngineAbi,
      functionName: 'createMarket',
      args: [template.question, startTime, deadline, address, address, liquidityWad],
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
  }) as [string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, bigint, bigint, string, string];
  const isGraduated = marketState[7];

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
        const [, , checkPercent] = await publicClient.readContract({
          address: deployment.contracts.LaunchpadEngine as `0x${string}`,
          abi: LaunchpadEngineAbi,
          functionName: 'getGraduationProgress',
          args: [marketAddress],
        }) as [bigint, bigint, bigint];
        if (checkPercent >= 10000n) {
          // Also check isGraduated flag
          const mktState = await publicClient.readContract({
            address: deployment.contracts.LaunchpadEngine as `0x${string}`,
            abi: LaunchpadEngineAbi,
            functionName: 'markets',
            args: [marketAddress],
          }) as [string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, bigint, bigint, string, string];
          if (mktState[7]) {
            console.log(`\n  ${success('MARKET GRADUATED!')} after ${tradesExecuted} trades\n`);
            return { success: true, data: { tradesExecuted, totalGas } };
          }
        }
        consecutiveFailures = 0; // Reset on success
      } catch (err) {
        const decoded = decodeError(err as Error);

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
    const [question, startTime, deadline, creator, adjudicator, isLive, isSettled] = await Promise.all([
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'question' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'startTime' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'deadline' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'creator' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'adjudicator' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'isLive' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'isSettled' }),
    ]);

    const startDate = new Date(Number(startTime) * 1000);
    const deadlineDate = new Date(Number(deadline) * 1000);
    const isActive = isLive && !isSettled;

    console.log(`  Question:   ${(question as string).slice(0, 50)}${(question as string).length > 50 ? '...' : ''}`);
    console.log(`  Creator:    ${shortAddress(creator as string)}`);
    console.log(`  Adjudicator: ${shortAddress(adjudicator as string)}`);
    console.log(`  Starts:     ${startDate.toISOString().slice(0, 10)}`);
    console.log(`  Deadline:   ${deadlineDate.toISOString().slice(0, 10)}`);
    console.log(`  Status:     ${isActive ? success('LIVE') : isSettled ? dim('SETTLED') : warn('INACTIVE')}`);

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
      console.log(`  bBase:       ${formatWad(marketState[1])}`);
      console.log(`  bCurrent:    ${formatWad(marketState[2])}`);
      console.log(`  Deposit:     ${(Number(marketState[3]) / 1e6).toFixed(2)} USDC`);
      console.log(`  Fees:        ${formatWad(marketState[4])} USDC`);
      console.log(`  LP Supply:   ${formatWad(marketState[5])}`);
      console.log(`  Graduated:   ${marketState[7] ? success('YES') : warn('NO')}`);

      if (!marketState[7]) {
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

  // 4. TickBook Status
  console.log(`\n  ${info('TickBook (Orderbook)')}`);
  console.log('  ' + '─'.repeat(40));

  try {
    // Try to get market info from TickBook
    // This would need the marketKey
    console.log(`  ${dim('Use "state" command with market set')}`);
  } catch {
    console.log(`  Registered: ${warn('NO')}`);
  }

  console.log('');
  return { success: true };
}

/**
 * Simulate realistic orderbook activity with configurable randomization
 *
 * Usage: simulate [numOrders] [avgSize] [seed]
 *
 * Examples:
 *   simulate              - 10 orders, 100 avg size, random seed
 *   simulate 50           - 50 orders
 *   simulate 20 500       - 20 orders, 500 avg size
 *   simulate 20 100 12345 - deterministic with seed 12345
 *
 * Order types generated:
 *   - Range orders (55%): Random tick ranges within 10-90%
 *   - Limit orders (20%): Single-tick orders at specific prices
 *   - Market orders (10%): Full range 1-999 for immediate fills
 *   - Spot sell (10%): Sell owned shares at limit price
 *   - Hybrid sell (5%): Partial spot + partial short sell
 */
export async function simulate(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketKey, marketAddress } = ctx;
  const walletClient = actorManager.currentWalletClient();
  const address = actorManager.currentAddress();
  const publicClient = actorManager.getPublicClient();

  if (!walletClient || !address) {
    return { success: false, message: 'No actor selected' };
  }

  if (!marketKey || !marketAddress) {
    return { success: false, message: 'No market selected. Use: setmarket <address>' };
  }

  const numOrders = args[0] ? parseInt(args[0], 10) : 10;
  const avgSize = args[1] ? parseWad(args[1]) : 100n * WAD;
  const seed = args[2] ? Number(args[2]) : Date.now();

  // Deterministic PRNG (mulberry32) for reproducible simulations
  const rng = (() => {
    let t = (seed >>> 0) || 1;
    return () => {
      t += 0x6d2b79f5;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  })();

  // Helper to generate random int in range [min, max]
  const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;

  // Helper to generate random bigint size (50%-200% of avgSize)
  const randSize = () => (avgSize * BigInt(50 + Math.floor(rng() * 150))) / 100n;

  if (!Number.isFinite(numOrders) || numOrders <= 0) {
    return {
      success: false,
      message: `Usage: simulate [numOrders] [avgSize] [seed]

  Examples:
    simulate              10 orders, 100 avg size
    simulate 50           50 orders
    simulate 20 500       20 orders, 500 avg size
    simulate 20 100 12345 Deterministic with seed`,
    };
  }

  // Ensure TickBook market is active/registered for this marketKey
  try {
    const [truthMarket, yesToken, noToken] = await publicClient.readContract({
      address: deployment.contracts.TickBookPoolManager as `0x${string}`,
      abi: ABIS.TickBookPoolManager,
      functionName: 'getMarketInfo',
      args: [marketKey],
    }) as unknown as [string, string, string, string];

    const active =
      truthMarket !== '0x0000000000000000000000000000000000000000' &&
      yesToken !== '0x0000000000000000000000000000000000000000' &&
      noToken !== '0x0000000000000000000000000000000000000000';

    if (!active) {
      return {
        success: false,
        message: 'TickBook marketKey is not active/registered. Ensure the market is graduated and registered into TickBook, then re-run setmarket.',
      };
    }
  } catch (err) {
    return { success: false, message: `Failed to validate TickBook marketKey: ${(err as Error).message}` };
  }

  console.log(`\n  ${bold('Orderbook Simulation')}`);
  console.log('  ' + '─'.repeat(50));
  console.log(`  Orders to place: ${numOrders}`);
  console.log(`  Average size: ${formatWad(avgSize)} shares`);
  console.log(`  Seed: ${seed}`);
  console.log('');

  // Ensure sufficient vault balance - ALWAYS deposit enough for simulation
  const available = await publicClient.readContract({
    address: deployment.contracts.TickBookVault as `0x${string}`,
    abi: ABIS.TickBookVault,
    functionName: 'availableUsdcWad',
    args: [address],
  }) as bigint;

  // Increase buffer for randomized order sizes (50%-150% of avg) + market orders
  const requiredBalance = avgSize * BigInt(numOrders) * 10n; // 10x buffer

  console.log(dim(`  Current vault balance: ${formatWad(available)} USDC`));

  if (available < requiredBalance) {
    console.log(warn(`  Insufficient vault balance. Depositing ${formatWad(requiredBalance)}...`));

    // Mint USDC
    console.log(dim(`  Minting ${formatWad(requiredBalance * 2n)} USDC...`));
    const mintHash = await walletClient.writeContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'mint',
      args: [address, requiredBalance * 2n],
      gas: 500000n,
    });
    await actorManager.waitForTransactionReceipt(mintHash);
    console.log(dim(`  Minted (tx: ${mintHash.slice(0, 10)}...)`));

    // Approve vault
    console.log(dim(`  Approving vault...`));
    const approveHash = await walletClient.writeContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'approve',
      args: [deployment.contracts.TickBookVault as `0x${string}`, MAX_UINT256],
      gas: 500000n,
    });
    await actorManager.waitForTransactionReceipt(approveHash);
    console.log(dim(`  Approved (tx: ${approveHash.slice(0, 10)}...)`));

    // Deposit to vault (depositUsdc takes USDC in token decimals)
    // MockUSDC uses 18 decimals (WAD), so no conversion needed
    const depositAmount = requiredBalance * 2n;
    console.log(dim(`  Depositing ${formatWad(depositAmount)} to vault...`));
    const depositHash = await walletClient.writeContract({
      address: deployment.contracts.TickBookVault as `0x${string}`,
      abi: ABIS.TickBookVault,
      functionName: 'depositUsdc',
      args: [depositAmount],
      gas: 500000n,
    });
    await actorManager.waitForTransactionReceipt(depositHash);
    console.log(dim(`  Deposit tx confirmed: ${depositHash.slice(0, 10)}...`));

    // Verify new balance
    const newBalance = await publicClient.readContract({
      address: deployment.contracts.TickBookVault as `0x${string}`,
      abi: ABIS.TickBookVault,
      functionName: 'availableUsdcWad',
      args: [address],
    }) as bigint;
    console.log(success(`  Deposited. New balance: ${formatWad(newBalance)} USDC`));
  }

  // Place orders at various price levels
  console.log('  ' + '─'.repeat(50));
  console.log(`  ${bold('Phase 1: Placing Orders')} ${dim('(press Enter to stop early)')}`);

  // Setup early stop flag - user can press Enter to stop
  // Note: We only add a listener, don't modify stdin modes (readline manages those)
  let stopRequested = false;
  const stdinListener = () => { stopRequested = true; };
  process.stdin.once('data', stdinListener);

  const cleanup = () => {
    process.stdin.removeListener('data', stdinListener);
  };

  const placedOrders: {
    orderId: bigint;
    outcome: number;
    tickLower: number;
    tickUpper: number;
    shares: bigint;
    filledShares: bigint;
    filledCost: bigint;
    restingShares: bigint;
    txHash: `0x${string}`;
  }[] = [];

  // Unified order execution helper
  type OrderType = 'range' | 'limit' | 'market' | 'spotsell' | 'hybrid';

  interface ExecuteOrderParams {
    orderType: OrderType;
    outcome: number;
    shares: bigint;
    tickLower: number;
    tickUpper: number;
  }

  interface ExecuteOrderResult {
    orderId: bigint;
    filledShares: bigint;
    filledCost: bigint;
    restingShares: bigint;
    txHash: `0x${string}`;
    actualType: OrderType; // May differ if fallback occurred
    spotAmount?: bigint;
    shortAmount?: bigint;
    gasUsed: bigint;
  }

  // Cache market info for spot/hybrid sells
  let cachedMarketInfo: { truthMarket: string } | null = null;
  const getMarketInfoCached = async () => {
    if (!cachedMarketInfo) {
      const [truthMarket] = await publicClient.readContract({
        address: deployment.contracts.TickBookPoolManager as `0x${string}`,
        abi: ABIS.TickBookPoolManager,
        functionName: 'getMarketInfo',
        args: [marketKey],
      }) as unknown as [string, string, string];
      cachedMarketInfo = { truthMarket };
    }
    return cachedMarketInfo;
  };

  const getUserShares = async (outcome: number): Promise<bigint> => {
    const market = await getMarketInfoCached();
    if (!market || !market.truthMarket) {
      // Just console error if invalid, but truthMarket structure is fixed now
      return 0n;
    }
    const vault = deployment.contracts.TickBookVault as `0x${string}`;
    // Debug addresses
    // console.log(`  Debug: getUserShares vault=${vault} market=${market.truthMarket} user=${address}`);

    const [yesShares, noShares] = await publicClient.readContract({
      address: vault,
      abi: ABIS.TickBookVault,
      functionName: 'getInternalOutcomes',
      args: [market.truthMarket as `0x${string}`, address],
    }) as [bigint, bigint];
    return outcome === 1 ? yesShares : noShares;
  };

  const estimateGas = async (
    functionName: 'placeOrder' | 'placeSpotSell',
    args: readonly unknown[],
  ): Promise<bigint> => {
    const MIN_GAS = 500_000n;
    const MAX_GAS = 30_000_000n;
    const GAS_BUFFER_PERCENT = 120n;

    try {
      const estimated = await publicClient.estimateContractGas({
        address: deployment.contracts.TickBookPoolManager as `0x${string}`,
        abi: ABIS.TickBookPoolManager,
        functionName,
        args: args as any,
        account: address,
      });
      const withBuffer = (estimated * GAS_BUFFER_PERCENT) / 100n;
      return withBuffer < MIN_GAS ? MIN_GAS : withBuffer > MAX_GAS ? MAX_GAS : withBuffer;
    } catch (err) {
      if (isContractError(err as Error)) {
        throw err;
      }
      return 2_000_000n;
    }
  };

  const executeOrder = async (params: ExecuteOrderParams, retries = 3): Promise<ExecuteOrderResult> => {
    const { orderType, outcome, shares, tickLower, tickUpper } = params;
    const maxCost = shares * 2n;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (orderType === 'spotsell' || orderType === 'hybrid') {
          const userShares = await getUserShares(outcome);

          if (userShares === 0n) {
            return executeOrder({ ...params, orderType: 'range' }, 1);
          }

          const spotAmount = userShares > shares ? shares : userShares;
          const shortAmount = orderType === 'hybrid' && shares > userShares ? shares - userShares : 0n;

          const spotArgs = [marketKey, outcome, spotAmount, tickLower, tickUpper] as const;
          const spotGas = await estimateGas('placeSpotSell', spotArgs);

          const spotHash = await walletClient.writeContract({
            address: deployment.contracts.TickBookPoolManager as `0x${string}`,
            abi: ABIS.TickBookPoolManager,
            functionName: 'placeSpotSell',
            args: spotArgs,
            gas: spotGas,
          });
          const spotReceipt = await actorManager.waitForTransactionReceipt(spotHash);
          let gasUsed = spotReceipt.gasUsed;

          let shortHash: `0x${string}` = '0x0';
          if (shortAmount > 0n) {
            const shortArgs = [marketKey, outcome, shortAmount, tickLower, tickUpper, shortAmount * 2n] as const;
            const shortGas = await estimateGas('placeOrder', shortArgs);

            shortHash = await walletClient.writeContract({
              address: deployment.contracts.TickBookPoolManager as `0x${string}`,
              abi: ABIS.TickBookPoolManager,
              functionName: 'placeOrder',
              args: shortArgs,
              gas: shortGas,
            });
            const shortReceipt = await actorManager.waitForTransactionReceipt(shortHash);
            gasUsed += shortReceipt.gasUsed;
          }

          return {
            orderId: 0n,
            filledShares: 0n,
            filledCost: 0n,
            restingShares: spotAmount + shortAmount,
            txHash: shortAmount > 0n ? shortHash : spotHash,
            actualType: shortAmount > 0n ? 'hybrid' : 'spotsell',
            spotAmount,
            shortAmount,
            gasUsed,
          };
        }

        const orderArgs = [marketKey, outcome, shares, tickLower, tickUpper, maxCost] as const;
        const estimatedGas = await estimateGas('placeOrder', orderArgs);

        let simResult: any = null;
        try {
          simResult = await publicClient.simulateContract({
            address: deployment.contracts.TickBookPoolManager as `0x${string}`,
            abi: ABIS.TickBookPoolManager,
            functionName: 'placeOrder',
            args: orderArgs,
            account: address,
          });
        } catch (simErr: any) {
          if (isContractError(simErr)) {
            throw simErr;
          }
        }

        const txHash = await walletClient.writeContract({
          address: deployment.contracts.TickBookPoolManager as `0x${string}`,
          abi: ABIS.TickBookPoolManager,
          functionName: 'placeOrder',
          args: orderArgs,
          gas: estimatedGas,
        });
        const receipt = await actorManager.waitForTransactionReceipt(txHash);

        const result = simResult?.result
          ? simResult.result as [bigint, bigint, bigint, bigint]
          : [0n, 0n, 0n, shares] as [bigint, bigint, bigint, bigint];

        return {
          orderId: result[0],
          filledShares: result[1],
          filledCost: result[2],
          restingShares: result[3],
          txHash,
          actualType: orderType,
          gasUsed: receipt.gasUsed,
        };
      } catch (err) {
        lastError = err as Error;
        if (!isTransientError(lastError) || attempt === retries) throw lastError;
        await sleep(500 * attempt);
      }
    }
    throw lastError!;
  };

  // Debug: show first order params
  const debugFirstOrder = true;
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 3; // Stop after 3 consecutive failures to save gas
  let totalSimGas = 0n;

  for (let i = 0; i < numOrders; i++) {
    // Check for early stop
    if (stopRequested) {
      console.log(warn(`\n  Stopped early by user after ${i} orders`));
      break;
    }

    // Randomly select order type: 55% range, 20% limit, 10% market, 10% spot sell, 5% hybrid
    const orderTypeRoll = rng();
    let orderType: 'range' | 'limit' | 'market' | 'spotsell' | 'hybrid';
    if (orderTypeRoll < 0.55) {
      orderType = 'range';
    } else if (orderTypeRoll < 0.75) {
      orderType = 'limit';
    } else if (orderTypeRoll < 0.85) {
      orderType = 'market';
    } else if (orderTypeRoll < 0.95) {
      orderType = 'spotsell';
    } else {
      orderType = 'hybrid';
    }

    // Random outcome (YES=1, NO=0) with slight bias toward YES
    const outcome = rng() < 0.55 ? 1 : 0;

    // Generate tick range based on order type
    // Tick constraints: 1 <= tickLower < tickUpper <= 999
    let tickLower: number;
    let tickUpper: number;

    if (orderType === 'market') {
      tickLower = 1;
      tickUpper = 999;
    } else if (orderType === 'limit') {
      tickLower = randInt(100, 898);
      tickUpper = tickLower + randInt(1, 3);
      tickUpper = Math.min(tickUpper, 999);
    } else if (orderType === 'spotsell' || orderType === 'hybrid') {
      tickLower = randInt(100, 950);
      tickUpper = tickLower + randInt(0, 49);
      tickUpper = Math.min(tickUpper, 999);
    } else {
      // Range order: random range within safe bounds
      // tickLower: 100-800 (10%-80%), width: 50-150 ticks (5%-15%)
      tickLower = randInt(100, 800);
      const width = randInt(50, 150);
      tickUpper = tickLower + width;
      // Ensure within bounds
      if (tickUpper > 999) {
        tickUpper = 999;
        tickLower = Math.max(1, tickUpper - width);
      }
    }

    // Ensure valid range (should always be true with above logic)
    if (tickLower < 1) tickLower = 1;
    if (tickUpper > 999) tickUpper = 999;
    if (tickLower >= tickUpper) tickUpper = tickLower + 1;

    // Random size (50%-200% of avgSize), minimum 1 WAD
    let shares = randSize();
    if (shares < WAD) shares = WAD;

    // Order type indicator
    const typeIndicator = orderType === 'market' ? 'MKT' : orderType === 'limit' ? 'LMT' : orderType === 'spotsell' ? 'SPOT' : orderType === 'hybrid' ? 'HYB' : 'RNG';

    // Debug output for first order
    if (debugFirstOrder && i === 0) {
      console.log(dim(`  Debug: marketKey=${(marketKey as string).slice(0, 18)}...`));
      console.log(dim(`  Debug: type=${orderType}, outcome=${outcome}, shares=${shares.toString()}, ticks=${tickLower}-${tickUpper}`));
    }

    const spinner = new Spinner(`  Order ${i + 1}/${numOrders}: ${typeIndicator} ${outcome === 1 ? 'YES' : 'NO'} [${(tickLower / 10).toFixed(1)}%-${(tickUpper / 10).toFixed(1)}%] ${formatWad(shares)}...`);
    spinner.start();

    try {
      const result = await executeOrder({ orderType, outcome, shares, tickLower, tickUpper });

      // Format output based on actual order type executed
      const actualIndicator = result.actualType === 'market' ? 'MKT' : result.actualType === 'limit' ? 'LMT'
        : result.actualType === 'spotsell' ? 'SPOT' : result.actualType === 'hybrid' ? 'HYB' : 'RNG';

      if (result.actualType === 'hybrid') {
        spinner.succeed(
          `Order ${i + 1}: HYB ${outcome === 1 ? 'YES' : 'NO'} [${(tickLower / 10).toFixed(1)}%-${(tickUpper / 10).toFixed(1)}%] spot:${formatWad(result.spotAmount || 0n)} + short:${formatWad(result.shortAmount || 0n)} ${dim(`(gas: ${result.gasUsed})`)}`
        );
      } else if (result.actualType === 'spotsell') {
        spinner.succeed(
          `Order ${i + 1}: SPOT ${outcome === 1 ? 'YES' : 'NO'} [${(tickLower / 10).toFixed(1)}%-${(tickUpper / 10).toFixed(1)}%] ${formatWad(result.spotAmount || shares)} shares ${dim(`(gas: ${result.gasUsed})`)}`
        );
      } else {
        spinner.succeed(
          `Order ${i + 1}: ${actualIndicator} #${result.orderId} ${outcome === 1 ? 'YES' : 'NO'} [${(tickLower / 10).toFixed(1)}%-${(tickUpper / 10).toFixed(1)}%] ${formatWad(shares)} (filled: ${formatWad(result.filledShares)}, resting: ${formatWad(result.restingShares)}) ${dim(`(gas: ${result.gasUsed})`)}`
        );
      }

      placedOrders.push({
        orderId: result.orderId,
        outcome,
        tickLower,
        tickUpper,
        shares: result.spotAmount && result.shortAmount ? result.spotAmount + result.shortAmount : shares,
        filledShares: result.filledShares,
        filledCost: result.filledCost,
        restingShares: result.restingShares,
        txHash: result.txHash
      });
      consecutiveFailures = 0;
      totalSimGas += result.gasUsed;
    } catch (err) {
      const decodedErr = decodeError(err as Error);
      spinner.fail(`Order ${i + 1} failed: ${typeIndicator} ${outcome === 1 ? 'YES' : 'NO'} [${(tickLower / 10).toFixed(1)}%-${(tickUpper / 10).toFixed(1)}%] - ${decodedErr}`);

      if (i === 0 || decodedErr.includes('Unknown') || decodedErr.includes('RPC')) {
        console.log(dim(`    Params: shares=${formatWad(shares)}, maxCost=${formatWad(shares * 2n)}`));
      }

      if (isContractError(err as Error) || (err as Error).message.toLowerCase().includes('out of gas')) {
        consecutiveFailures++;
        if (consecutiveFailures >= maxConsecutiveFailures) {
          console.log(warn(`  Stopping early after ${maxConsecutiveFailures} consecutive contract failures`));
          break;
        }
      }
    }

    await sleep(300); // Slightly longer delay for stability
  }

  // Cleanup stdin listener
  cleanup();

  // Summary
  console.log('');
  console.log('  ' + '─'.repeat(50));
  console.log(`  ${bold('Simulation Complete')}`);
  console.log(`  Orders placed: ${placedOrders.length}/${numOrders}`);
  console.log(`  Total gas used: ${totalSimGas}`);
  if (placedOrders.length > 0) {
    console.log(`  Avg gas per order: ${totalSimGas / BigInt(placedOrders.length)}`);
  }
  if (stopRequested) {
    console.log(`  ${warn('(stopped early by user)')}`);
  }
  console.log('');

  return { success: true, data: { placedOrders: placedOrders.length } };
}

export const marketCommands = {
  createmarket,
  graduate,
  marketstatus,
  simulate,
};

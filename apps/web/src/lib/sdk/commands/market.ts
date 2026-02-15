import type { SDKContext, CommandResult, OutputLine } from '../types';
import { WAD, MAX_UINT256 } from '../types';
import { ABIS, MOCK_ERC20_ABI } from '../../../config/abis';
import { formatWad, shortAddress, shortTx, success, error, plain, bold, info, warn, dim, separator } from '../utils';
import { decodeEventLog } from 'viem';

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
 * Create a new market from template
 * Usage: createmarket <template> [liquidity]
 * Example: createmarket alien 500
 */
export async function createmarket(
  ctx: SDKContext,
  args: string[],
  onProgress?: (line: OutputLine) => void
): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address } = ctx;
  const out = (line: OutputLine) => { onProgress?.(line); };

  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }

  if (args.length < 1) {
    const output: OutputLine[] = [
      plain(''),
      bold('Create Market'),
      plain(''),
      plain(`Usage: createmarket <template> [liquidity]`),
      plain(''),
      info('Templates:'),
      ...Object.entries(MARKET_TEMPLATES).map(([key, t]) => plain(`  ${key}: ${t.question}`)),
      plain(''),
      info('Examples:'),
      plain('  createmarket alien 500     Create ALIEN market with b=500'),
      plain('  createmarket btc100k 1000  Create BTC100K market with b=1000'),
      plain(''),
    ];
    return { result: { success: true }, output };
  }

  const templateName = args[0].toLowerCase();
  const template = MARKET_TEMPLATES[templateName];

  if (!template) {
    return {
      result: { success: false, message: `Unknown template: ${templateName}` },
      output: [error(`Unknown template: ${templateName}. Available: ${Object.keys(MARKET_TEMPLATES).join(', ')}`)],
    };
  }

  const liquidityWad = args[1] ? BigInt(Math.floor(parseFloat(args[1]))) * WAD : 500n * WAD;
  const output: OutputLine[] = [];

  out(plain(''));
  out(bold(`Creating Market: ${template.name}`));
  out(separator(50));
  out(plain(`Question:  ${template.question}`));
  out(plain(`Liquidity: ${formatWad(liquidityWad)} (b parameter)`));
  out(plain(`Deadline:  ${template.deadline}`));
  out(plain(''));

  try {
    out(info('[1/4] Checking USDC balance...'));
    const usdcBalance = await config.publicClient.readContract({
      address: config.contracts.MockUSDC,
      abi: MOCK_ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    }) as bigint;

    const LN2_WAD = 693147180559945309n;
    const required = (liquidityWad * LN2_WAD) / WAD;

    if (usdcBalance < required) {
      out(warn(`  Low USDC. Minting ${formatWad(required * 2n)}...`));
      const mintHash = await config.walletClient.writeContract({
        account: address,
        address: config.contracts.MockUSDC,
        abi: MOCK_ERC20_ABI,
        functionName: 'mint',
        args: [address, required * 2n],
        chain: null,
      });
      await config.publicClient.waitForTransactionReceipt({ hash: mintHash });
      out(success('  Minted ✓'));
    } else {
      out(success('  Balance OK ✓'));
    }

    out(info('[2/4] Approving USDC...'));
    const approveHash = await config.walletClient.writeContract({
      account: address,
      address: config.contracts.MockUSDC,
      abi: MOCK_ERC20_ABI,
      functionName: 'approve',
      args: [config.contracts.LaunchpadEngine, MAX_UINT256],
      chain: null,
    });
    await config.publicClient.waitForTransactionReceipt({ hash: approveHash });
    out(success('  Approved ✓'));

    out(info('[3/4] Creating market...'));
    const startTime = 0n;
    const deadline = template.deadline === 'infinite'
      ? BigInt('7258118399')
      : BigInt(Math.floor(new Date(template.deadline + 'T23:59:59Z').getTime() / 1000));

    const protocolConfig = await config.publicClient.readContract({
      address: config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'protocolConfig',
    }) as `0x${string}`;

    const createHash = await config.walletClient.writeContract({
      account: address,
      address: config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'createMarket',
      args: [template.question, startTime, deadline, address, protocolConfig, liquidityWad, 0n, 0n],
      chain: null,
    });

    const createReceipt = await config.publicClient.waitForTransactionReceipt({ hash: createHash });

    if (createReceipt.status === 'reverted') {
      out(error('  Transaction reverted ✗'));
      return { result: { success: false, message: 'Transaction reverted' }, output };
    }
    out(success('  Created ✓'));

    out(info('[4/4] Fetching market address...'));
    let marketAddress: `0x${string}` | undefined;
    const logs = createReceipt.logs ?? [];
    for (const log of logs) {
      try {
        const decoded = decodeEventLog({
          abi: ABIS.TruthMarket,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === 'MarketCreated') {
          marketAddress = (decoded.args as any).market as `0x${string}`;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!marketAddress) {
      out(error('  MarketCreated event not found ✗'));
      return { result: { success: false, message: 'MarketCreated event not found' }, output };
    }

    const allMarkets = await config.publicClient.readContract({
      address: config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'getMarkets',
    }) as string[];
    const marketIndex = allMarkets.findIndex(m => m.toLowerCase() === marketAddress!.toLowerCase());
    out(success('  Found ✓'));

    out(plain(''));
    out(success('MARKET CREATED SUCCESSFULLY!'));
    out(plain(''));
    out(plain(`TruthMarket: ${marketAddress}`));
    out(plain(`Name:        ${template.name}`));
    out(plain(''));
    out(info(`Next: setmarket ${marketIndex >= 0 ? marketIndex : allMarkets.length - 1}`));
    out(plain(''));

    return {
      result: { success: true, txHash: createHash, data: { marketAddress } },
      output,
    };
  } catch (err) {
    out(error(`Creation failed: ${(err as Error).message.slice(0, 80)}`));
    return { result: { success: false, message: (err as Error).message }, output };
  }
}

/**
 * Graduate a market by executing trades to accumulate fees
 * Usage: graduate [steps]
 */
export async function graduate(
  ctx: SDKContext,
  args: string[],
  onProgress?: (line: OutputLine) => void
): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketAddress } = ctx;
  const out = (line: OutputLine) => { onProgress?.(line); };

  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }

  if (!marketAddress) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: setmarket <address>')] };
  }

  const output: OutputLine[] = [];

  try {
    out(info('Checking graduation status...'));
    const progress = await config.publicClient.readContract({
      address: config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'getGraduationProgress',
      args: [marketAddress],
    }) as [bigint, bigint, bigint];

    const [feesAccrued, threshold, percentComplete] = progress;

    const marketState = await config.publicClient.readContract({
      address: config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'markets',
      args: [marketAddress],
    }) as any;
    const isGraduated = marketState[8]; // V11: lpToken at [1] shifts indices

    const progressPct = Number(percentComplete) / 100;

    out(plain(''));
    out(bold('Graduation Status'));
    out(separator(40));
    out(plain(`Fees Accrued: ${formatWad(feesAccrued)} USDC`));
    out(plain(`Threshold:    ${formatWad(threshold)} USDC`));
    out(plain(`Progress:     ${progressPct.toFixed(1)}%`));
    out(plain(`Graduated:    ${isGraduated ? 'Yes' : 'No'}`));

    if (isGraduated) {
      out(plain(''));
      out(success('Market is already graduated!'));
      out(plain(''));
      return { result: { success: true }, output };
    }

    if (percentComplete >= 10000n) {
      out(plain(''));
      out(warn('Fees reached threshold. Triggering graduation...'));

      await config.walletClient.writeContract({
        account: address,
        address: config.contracts.MockUSDC,
        abi: MOCK_ERC20_ABI,
        functionName: 'approve',
        args: [config.contracts.LaunchpadEngine, MAX_UINT256],
        chain: null,
      });

      const hash = await config.walletClient.writeContract({
        account: address,
        address: config.contracts.LaunchpadEngine,
        abi: ABIS.LaunchpadEngine,
        functionName: 'tradePositions',
        args: [marketAddress, 1, WAD, MAX_UINT256],
        chain: null,
      });
      await config.publicClient.waitForTransactionReceipt({ hash });

      out(success('MARKET GRADUATED!'));
      out(plain(''));
      return { result: { success: true, txHash: hash }, output };
    }

    const numTrades = args[0] ? parseInt(args[0], 10) : 8;

    const feeBps = await config.publicClient.readContract({
      address: config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'preGradFeeBps',
    }) as number;

    const remaining = threshold - feesAccrued;
    const targetFees = (remaining * 110n) / 100n;
    const volumeNeeded = (targetFees * 10000n) / BigInt(feeBps);
    const tradeSize = (volumeNeeded * 8n) / (3n * BigInt(numTrades));

    out(plain(''));
    out(plain(`Target fees:  ${formatWad(targetFees)} USDC`));
    out(plain(`Trade size:   ${formatWad(tradeSize)} shares`));
    out(plain(`Steps:        ${numTrades}`));
    out(plain(''));

    const requiredUsdc = tradeSize * BigInt(numTrades) * 2n;
    const usdcBalance = await config.publicClient.readContract({
      address: config.contracts.MockUSDC,
      abi: MOCK_ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    }) as bigint;

    if (usdcBalance < requiredUsdc) {
      out(warn('Minting USDC...'));
      const mintHash = await config.walletClient.writeContract({
        account: address,
        address: config.contracts.MockUSDC,
        abi: MOCK_ERC20_ABI,
        functionName: 'mint',
        args: [address, requiredUsdc * 2n],
        chain: null,
      });
      await config.publicClient.waitForTransactionReceipt({ hash: mintHash });
      out(success('Minted ✓'));
    }

    out(info('Approving...'));
    const approveHash = await config.walletClient.writeContract({
      account: address,
      address: config.contracts.MockUSDC,
      abi: MOCK_ERC20_ABI,
      functionName: 'approve',
      args: [config.contracts.LaunchpadEngine, MAX_UINT256],
      chain: null,
    });
    await config.publicClient.waitForTransactionReceipt({ hash: approveHash });
    out(success('Approved ✓'));
    out(plain(''));

    let tradesExecuted = 0;

    for (let i = 0; i < numTrades; i++) {
      const isBuy = i % 2 === 0;
      const delta = isBuy ? tradeSize : -(tradeSize / 2n);
      const maxCostOrMinProceeds = isBuy ? MAX_UINT256 : 0n;
      const side = 'yes';
      const shares = formatWad(delta > 0n ? delta : -delta);
      const action = isBuy ? 'buy' : 'sell';

      try {
        const hash = await config.walletClient.writeContract({
          account: address,
          address: config.contracts.LaunchpadEngine,
          abi: ABIS.LaunchpadEngine,
          functionName: 'tradePositions',
          args: [marketAddress, 1, delta, maxCostOrMinProceeds],
          chain: null,
        });
        await config.publicClient.waitForTransactionReceipt({ hash });
        tradesExecuted++;
        out(success(`[${i + 1}/${numTrades}] ${action} ${side} ${shares} ✓`));

        const checkState = await config.publicClient.readContract({
          address: config.contracts.LaunchpadEngine,
          abi: ABIS.LaunchpadEngine,
          functionName: 'markets',
          args: [marketAddress],
        }) as any;
        if (checkState[8]) {
          out(plain(''));
          out(success(`GRADUATED after ${tradesExecuted} trades`));
          return { result: { success: true, data: { tradesExecuted } }, output };
        }
      } catch (err) {
        out(error(`[${i + 1}/${numTrades}] ${action} ${side} ${shares} ✗`));
        break;
      }
    }

    const [finalFees, finalThreshold, finalPercent] = await config.publicClient.readContract({
      address: config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'getGraduationProgress',
      args: [marketAddress],
    }) as [bigint, bigint, bigint];

    out(plain(''));
    out(plain(`Final Progress: ${(Number(finalPercent) / 100).toFixed(1)}%`));
    out(plain(`Fees: ${formatWad(finalFees)} / ${formatWad(finalThreshold)} USDC`));
    out(plain(''));

    return { result: { success: true, data: { tradesExecuted, percentComplete: Number(finalPercent) / 100 } }, output };
  } catch (err) {
    out(error(`Graduate failed: ${(err as Error).message}`));
    return { result: { success: false, message: (err as Error).message }, output };
  }
}

/**
 * Show comprehensive market status
 * Usage: marketstatus [address]
 */
export async function marketstatus(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, marketAddress: ctxMarket } = ctx;

  const marketAddress = args[0] ? args[0] as `0x${string}` : ctxMarket;

  if (!marketAddress) {
    return {
      result: { success: false, message: 'No market address' },
      output: [error('No market address. Use: marketstatus <address> or setmarket first')],
    };
  }

  const output: OutputLine[] = [
    plain(''),
    bold(`Market Status: ${shortAddress(marketAddress)}`),
    separator(50),
  ];

  // 1. TruthMarket Status
  output.push(plain(''));
  output.push(info('TruthMarket'));
  output.push(separator(40));

  try {
    const [question, startTime, deadline, creator, adjudicator, isLive, isSettled] = await Promise.all([
      config.publicClient.readContract({ address: marketAddress, abi: ABIS.TruthMarket, functionName: 'question' }),
      config.publicClient.readContract({ address: marketAddress, abi: ABIS.TruthMarket, functionName: 'startTime' }),
      config.publicClient.readContract({ address: marketAddress, abi: ABIS.TruthMarket, functionName: 'deadline' }),
      config.publicClient.readContract({ address: marketAddress, abi: ABIS.TruthMarket, functionName: 'creator' }),
      config.publicClient.readContract({ address: marketAddress, abi: ABIS.TruthMarket, functionName: 'adjudicator' }),
      config.publicClient.readContract({ address: marketAddress, abi: ABIS.TruthMarket, functionName: 'isLive' }),
      config.publicClient.readContract({ address: marketAddress, abi: ABIS.TruthMarket, functionName: 'isSettled' }),
    ]);

    const startDate = new Date(Number(startTime) * 1000);
    const deadlineDate = new Date(Number(deadline) * 1000);
    const isActive = isLive && !isSettled;

    output.push(plain(`Question:   ${(question as string).slice(0, 50)}${(question as string).length > 50 ? '...' : ''}`));
    output.push(plain(`Creator:    ${shortAddress(creator as string)}`));
    output.push(plain(`Adjudicator: ${shortAddress(adjudicator as string)}`));
    output.push(plain(`Starts:     ${startDate.toISOString().slice(0, 10)}`));
    output.push(plain(`Deadline:   ${deadlineDate.toISOString().slice(0, 10)}`));
    output.push(plain(`Status:     ${isActive ? 'LIVE' : isSettled ? 'SETTLED' : 'INACTIVE'}`));

    if (isSettled) {
      const winningOutcome = await config.publicClient.readContract({
        address: marketAddress,
        abi: ABIS.TruthMarket,
        functionName: 'winningOutcome',
      });
      output.push(plain(`Winner:     ${winningOutcome === 1 ? 'YES' : winningOutcome === 0 ? 'NO' : 'INVALID'}`));
    }
  } catch {
    output.push(error('Not a TruthMarket or not deployed'));
    return { result: { success: false, message: 'Failed to read TruthMarket' }, output };
  }

  // 2. Collateralizer Status
  output.push(plain(''));
  output.push(info('Collateralizer'));
  output.push(separator(40));

  try {
    const [yesToken, noToken] = await config.publicClient.readContract({
      address: config.contracts.Collateralizer,
      abi: ABIS.Collateralizer,
      functionName: 'getOutcomeTokens',
      args: [marketAddress],
    }) as [string, string];

    const registered = yesToken !== '0x0000000000000000000000000000000000000000';
    output.push(plain(`Registered: ${registered ? 'YES' : 'NO'}`));
    if (registered) {
      output.push(plain(`YES Token:  ${shortAddress(yesToken)}`));
      output.push(plain(`NO Token:   ${shortAddress(noToken)}`));
    }
  } catch {
    output.push(plain(`Registered: NO`));
  }

  // 3. LaunchpadEngine Status
  output.push(plain(''));
  output.push(info('LaunchpadEngine (AMM)'));
  output.push(separator(40));

  let isGraduated = false;

  try {
    const marketState = await config.publicClient.readContract({
      address: config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'markets',
      args: [marketAddress],
    }) as any;

    const initialized = marketState[0] !== '0x0000000000000000000000000000000000000000';

    if (initialized) {
      isGraduated = marketState[8];
      output.push(plain(`Initialized: YES`));
      output.push(plain(`Creator:     ${shortAddress(marketState[0])}`));
      output.push(plain(`LP Token:    ${shortAddress(marketState[1])}`));
      output.push(plain(`bBase:       ${formatWad(marketState[2])}`));
      output.push(plain(`bCurrent:    ${formatWad(marketState[3])}`));
      output.push(plain(`Fees:        ${formatWad(marketState[5])} USDC`));
      output.push(plain(`LP Supply:   ${formatWad(marketState[6])}`));
      output.push(plain(`Graduated:   ${isGraduated ? 'YES' : 'NO'}`));

      if (!isGraduated) {
        const [feesAccrued, threshold, percent] = await config.publicClient.readContract({
          address: config.contracts.LaunchpadEngine,
          abi: ABIS.LaunchpadEngine,
          functionName: 'getGraduationProgress',
          args: [marketAddress],
        }) as [bigint, bigint, bigint];

        output.push(plain(`Progress:    ${(Number(percent) / 100).toFixed(1)}% (${formatWad(feesAccrued)}/${formatWad(threshold)} USDC)`));
      }

    } else {
      output.push(plain(`Initialized: NO`));
    }
  } catch {
    output.push(plain(`Initialized: NO`));
  }

  output.push(plain(''));
  return { result: { success: true }, output };
}

/**
 * Show trial period status for current market
 * Usage: trialstatus
 */
export async function trialstatus(ctx: SDKContext, _args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, marketAddress } = ctx;
  const output: OutputLine[] = [];

  if (!marketAddress) {
    return {
      result: { success: false, message: 'No market selected' },
      output: [error('No market selected. Use: setmarket <index>')],
    };
  }

  try {
    // Read trial state
    const trialState = await config.publicClient.readContract({
      address: config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'trialStates',
      args: [marketAddress],
    }) as readonly [bigint, boolean, bigint];

    const [trialEndTime, isDismissed, totalLockedCost] = trialState;

    // Read default trial period
    const trialDurationSeconds = await config.publicClient.readContract({
      address: config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'DEFAULT_TRIAL_PERIOD',
    }) as bigint;

    const now = BigInt(Math.floor(Date.now() / 1000));
    const isInTrialPeriod = now < trialEndTime && !isDismissed;
    const trialEndDate = new Date(Number(trialEndTime) * 1000);

    output.push(plain(''));
    output.push(bold('Trial Period Status'));
    output.push(separator(40));
    output.push(plain(`Market:           ${shortAddress(marketAddress)}`));
    output.push(plain(`Trial Duration:   ${Number(trialDurationSeconds) / 86400} days`));
    output.push(plain(`Trial End Time:   ${trialEndDate.toISOString()}`));
    output.push(isDismissed ? warn(`Is Dismissed:     YES`) : success(`Is Dismissed:     NO`));
    output.push(isInTrialPeriod ? success(`In Trial Period:  YES`) : plain(`In Trial Period:  NO`));
    output.push(plain(`Total Locked:     ${formatWad(totalLockedCost)} USDC`));
    output.push(plain(''));

    return {
      result: { success: true, data: { trialEndTime, isDismissed, totalLockedCost, isInTrialPeriod } },
      output,
    };
  } catch (err) {
    return {
      result: { success: false, message: (err as Error).message },
      output: [error(`Failed to fetch trial status: ${(err as Error).message}`)],
    };
  }
}

/**
 * Dismiss market during trial period (creator only)
 * Usage: dismiss
 */
export async function dismiss(
  ctx: SDKContext,
  _args: string[],
  onProgress?: (line: OutputLine) => void
): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketAddress } = ctx;
  const out = (line: OutputLine) => { onProgress?.(line); };

  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }

  if (!marketAddress) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: setmarket <index>')] };
  }

  const output: OutputLine[] = [];

  try {
    // Check trial state first
    const trialState = await config.publicClient.readContract({
      address: config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'trialStates',
      args: [marketAddress],
    }) as readonly [bigint, boolean, bigint];

    const [trialEndTime, isDismissed, totalLockedCost] = trialState;

    if (isDismissed) {
      return { result: { success: false, message: 'Market already dismissed' }, output: [error('Market already dismissed')] };
    }

    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now < trialEndTime) {
      return { result: { success: false, message: 'Trial period not ended yet' }, output: [error('Trial period not ended yet. Dismiss is only allowed after trial ends.')] };
    }

    out(plain(''));
    out(info(`Dismissing market (${formatWad(totalLockedCost)} USDC locked)...`));

    const hash = await config.walletClient.writeContract({
      account: address,
      address: config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'dismissMarket',
      args: [marketAddress],
      gas: 200000n,
      chain: null,
    });

    await config.publicClient.waitForTransactionReceipt({ hash });

    out(success(`Market dismissed! Traders can now claim refunds`));
    out(dim(`Tx: ${shortTx(hash)}`));
    out(plain(''));

    return { result: { success: true, txHash: hash }, output };
  } catch (err) {
    const errMsg = (err as Error).message;
    if (errMsg.includes('OnlyCreator')) {
      out(error('Only the market creator can dismiss'));
      return { result: { success: false, message: 'Only creator can dismiss market' }, output };
    }
    if (errMsg.includes('trial not ended')) {
      out(error('Trial period has not ended yet'));
      return { result: { success: false, message: 'Trial period has not ended yet' }, output };
    }
    out(error(`Dismiss failed: ${errMsg.slice(0, 80)}`));
    return { result: { success: false, message: errMsg }, output };
  }
}

/**
 * Claim refund after market dismissal
 * Usage: claimrefund
 */
export async function claimrefund(
  ctx: SDKContext,
  _args: string[],
  onProgress?: (line: OutputLine) => void
): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketAddress } = ctx;
  const out = (line: OutputLine) => { onProgress?.(line); };

  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }

  if (!marketAddress) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: setmarket <index>')] };
  }

  const output: OutputLine[] = [];

  try {
    // Check if market is dismissed
    const trialState = await config.publicClient.readContract({
      address: config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'trialStates',
      args: [marketAddress],
    }) as readonly [bigint, boolean, bigint];

    const [, isDismissed] = trialState;

    if (!isDismissed) {
      return { result: { success: false, message: 'Market is not dismissed' }, output: [error('Market is not dismissed. Cannot claim refund.')] };
    }

    // Check user's locked cost
    const userLocked = await config.publicClient.readContract({
      address: config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'userLockedCost',
      args: [marketAddress, address],
    }) as bigint;

    if (userLocked === 0n) {
      return { result: { success: false, message: 'No locked cost to refund' }, output: [error('No locked cost to refund')] };
    }

    out(plain(''));
    out(info(`Claiming refund of ${formatWad(userLocked)} USDC...`));

    const hash = await config.walletClient.writeContract({
      account: address,
      address: config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'claimRefund',
      args: [marketAddress],
      gas: 200000n,
      chain: null,
    });

    await config.publicClient.waitForTransactionReceipt({ hash });

    out(success(`Refunded ${formatWad(userLocked)} USDC`));
    out(dim(`Tx: ${shortTx(hash)}`));
    out(plain(''));

    return { result: { success: true, txHash: hash, data: { refundAmount: userLocked } }, output };
  } catch (err) {
    const errMsg = (err as Error).message;
    if (errMsg.includes('not dismissed')) {
      out(error('Market is not dismissed'));
      return { result: { success: false, message: 'Market must be dismissed first' }, output };
    }
    out(error(`Claim refund failed: ${errMsg.slice(0, 80)}`));
    return { result: { success: false, message: errMsg }, output };
  }
}

/**
 * Get LP token balance for current market
 * Usage: lpbalance
 */
export async function lpbalance(ctx: SDKContext, _args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketAddress } = ctx;
  const output: OutputLine[] = [];

  if (!address) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }

  if (!marketAddress) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: setmarket <index>')] };
  }

  try {
    // Get market state to find LP token address
    const marketState = await config.publicClient.readContract({
      address: config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'markets',
      args: [marketAddress],
    }) as any;

    const lpTokenAddress = marketState[1] as `0x${string}`;
    if (lpTokenAddress === '0x0000000000000000000000000000000000000000') {
      return { result: { success: false, message: 'Market not found' }, output: [error('Market not found in LaunchpadEngine')] };
    }

    // Get LP balance
    const lpBalance = await config.publicClient.readContract({
      address: lpTokenAddress,
      abi: MOCK_ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    }) as bigint;

    // Get total supply
    const totalSupply = marketState[6] as bigint;
    const sharePercent = totalSupply > 0n ? (Number(lpBalance) / Number(totalSupply) * 100) : 0;

    output.push(plain(''));
    output.push(bold('LP Token Balance'));
    output.push(separator(40));
    output.push(plain(`LP Balance:    ${formatWad(lpBalance)}`));
    output.push(plain(`Total Supply:  ${formatWad(totalSupply)}`));
    output.push(plain(`Your Share:    ${sharePercent.toFixed(2)}%`));
    output.push(plain(`LP Token:      ${shortAddress(lpTokenAddress)}`));
    output.push(plain(''));

    return { result: { success: true, data: { lpBalance, totalSupply, sharePercent } }, output };
  } catch (err) {
    return {
      result: { success: false, message: (err as Error).message },
      output: [error(`Failed to get LP balance: ${(err as Error).message}`)],
    };
  }
}

/**
 * Redeem LP tokens for USDC
 * Usage: redeemlp [amount|max]
 */
export async function redeemlp(
  ctx: SDKContext,
  args: string[],
  onProgress?: (line: OutputLine) => void
): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketAddress } = ctx;
  const out = (line: OutputLine) => { onProgress?.(line); };

  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }

  if (!marketAddress) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: setmarket <index>')] };
  }

  const output: OutputLine[] = [];

  try {
    // Get market state
    const marketState = await config.publicClient.readContract({
      address: config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'markets',
      args: [marketAddress],
    }) as any;

    const lpTokenAddress = marketState[1] as `0x${string}`;
    if (lpTokenAddress === '0x0000000000000000000000000000000000000000') {
      return { result: { success: false, message: 'Market not found' }, output: [error('Market not found')] };
    }

    // Get LP balance
    const lpBalance = await config.publicClient.readContract({
      address: lpTokenAddress,
      abi: MOCK_ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    }) as bigint;

    if (lpBalance === 0n) {
      return { result: { success: false, message: 'No LP tokens to redeem' }, output: [warn('No LP tokens to redeem')] };
    }

    // Parse amount
    const amountArg = args[0]?.toLowerCase();
    let amount = lpBalance;
    if (amountArg && amountArg !== 'max' && amountArg !== 'all') {
      amount = BigInt(Math.floor(parseFloat(amountArg))) * WAD;
      if (amount > lpBalance) {
        return { result: { success: false, message: `Insufficient LP balance: ${formatWad(lpBalance)}` }, output: [error(`Insufficient LP balance: ${formatWad(lpBalance)}`)] };
      }
    }

    out(plain(''));
    out(info(`Redeeming ${formatWad(amount)} LP tokens...`));

    const hash = await config.walletClient.writeContract({
      account: address,
      address: config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'redeemLP',
      args: [marketAddress, amount],
      gas: 500000n,
      chain: null,
    });

    await config.publicClient.waitForTransactionReceipt({ hash });

    out(success(`Redeemed ${formatWad(amount)} LP tokens`));
    out(dim(`Tx: ${shortTx(hash)}`));
    out(plain(''));

    return { result: { success: true, txHash: hash, data: { amount } }, output };
  } catch (err) {
    const errMsg = (err as Error).message;
    if (errMsg.includes('insufficient')) {
      out(error('Insufficient LP balance'));
      return { result: { success: false, message: 'Insufficient LP balance' }, output };
    }
    out(error(`Redeem failed: ${errMsg.slice(0, 80)}`));
    return { result: { success: false, message: errMsg }, output };
  }
}

/**
 * Transfer LP tokens to another address
 * Usage: transferlp <toAddress> <amount|max>
 */
export async function transferlp(
  ctx: SDKContext,
  args: string[],
  onProgress?: (line: OutputLine) => void
): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketAddress } = ctx;
  const out = (line: OutputLine) => { onProgress?.(line); };

  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }

  if (!marketAddress) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: setmarket <index>')] };
  }

  if (args.length < 2) {
    return {
      result: { success: true },
      output: [
        plain(''),
        bold('Transfer LP Tokens'),
        plain(''),
        plain('Usage: transferlp <toAddress> <amount|max>'),
        plain(''),
        plain('Examples:'),
        plain('  transferlp 0x123...abc 100    Transfer 100 LP tokens'),
        plain('  transferlp 0x123...abc max    Transfer all LP tokens'),
        plain(''),
        dim('LP tokens can only be transferred BEFORE settlement.'),
        plain(''),
      ],
    };
  }

  const toAddress = args[0] as `0x${string}`;
  const output: OutputLine[] = [];

  try {
    // Get market state
    const marketState = await config.publicClient.readContract({
      address: config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'markets',
      args: [marketAddress],
    }) as any;

    const lpTokenAddress = marketState[1] as `0x${string}`;
    if (lpTokenAddress === '0x0000000000000000000000000000000000000000') {
      return { result: { success: false, message: 'Market not found' }, output: [error('Market not found')] };
    }

    // Get LP balance
    const lpBalance = await config.publicClient.readContract({
      address: lpTokenAddress,
      abi: MOCK_ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    }) as bigint;

    if (lpBalance === 0n) {
      return { result: { success: false, message: 'No LP tokens to transfer' }, output: [error('No LP tokens to transfer')] };
    }

    // Parse amount
    const amountArg = args[1]?.toLowerCase();
    let amount = lpBalance;
    if (amountArg && amountArg !== 'max' && amountArg !== 'all') {
      amount = BigInt(Math.floor(parseFloat(amountArg))) * WAD;
      if (amount > lpBalance) {
        return { result: { success: false, message: `Insufficient LP balance: ${formatWad(lpBalance)}` }, output: [error(`Insufficient LP balance: ${formatWad(lpBalance)}`)] };
      }
    }

    out(plain(''));
    out(info(`Transferring ${formatWad(amount)} LP to ${shortAddress(toAddress)}...`));

    const hash = await config.walletClient.writeContract({
      account: address,
      address: lpTokenAddress,
      abi: MOCK_ERC20_ABI,
      functionName: 'transfer',
      args: [toAddress, amount],
      gas: 200000n,
      chain: null,
    });

    await config.publicClient.waitForTransactionReceipt({ hash });

    out(success(`Transferred ${formatWad(amount)} LP tokens to ${shortAddress(toAddress)}`));
    out(dim(`Tx: ${shortTx(hash)}`));
    out(plain(''));

    return { result: { success: true, txHash: hash, data: { amount, toAddress } }, output };
  } catch (err) {
    const errMsg = (err as Error).message;
    if (errMsg.includes('TransfersLocked')) {
      out(error('LP transfers are locked (market is settled)'));
      return { result: { success: false, message: 'LP transfers are locked after settlement' }, output };
    }
    out(error(`Transfer failed: ${errMsg.slice(0, 80)}`));
    return { result: { success: false, message: errMsg }, output };
  }
}

/**
 * Check protocol pause status
 * Usage: pausestatus
 */
export async function pausestatus(ctx: SDKContext, _args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config } = ctx;
  const output: OutputLine[] = [];

  try {
    // Read protocolConfig address from LaunchpadEngine
    const protocolConfigAddr = await config.publicClient.readContract({
      address: config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'protocolConfig',
    }) as `0x${string}`;

    // Check if paused
    const isPaused = await config.publicClient.readContract({
      address: protocolConfigAddr,
      abi: [{ type: 'function', name: 'isPaused', inputs: [], outputs: [{ type: 'bool' }], stateMutability: 'view' }],
      functionName: 'isPaused',
    }) as boolean;

    output.push(plain(''));
    output.push(bold('Protocol Status'));
    output.push(separator(40));
    output.push(isPaused ? warn(`Status: PAUSED`) : success(`Status: ACTIVE`));
    output.push(dim(`ProtocolConfig: ${shortAddress(protocolConfigAddr)}`));
    output.push(plain(''));

    return { result: { success: true, data: { isPaused, protocolConfigAddr } }, output };
  } catch (err) {
    return {
      result: { success: false, message: (err as Error).message },
      output: [error(`Failed to check pause status: ${(err as Error).message}`)],
    };
  }
}

export const marketCommands = { createmarket, graduate, marketstatus, trialstatus, dismiss, claimrefund, lpbalance, redeemlp, transferlp, pausestatus };

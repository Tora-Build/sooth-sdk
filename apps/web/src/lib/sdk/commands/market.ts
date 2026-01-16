import type { SDKContext, CommandResult, OutputLine } from '../types';
import { WAD, MAX_UINT256 } from '../types';
import { ABIS, MOCK_ERC20_ABI } from '../../../config/abis';
import { formatWad, shortAddress, shortTx, success, error, plain, bold, info, warn, dim, separator, computeMarketKey, computeMarketKeyWithHook } from '../utils';
import { decodeEventLog } from 'viem';

const MARKET_TEMPLATES: Record<string, { question: string; name: string; symbol: string; deadline: string }> = {
  alien: {
    question: 'The UN officially confirm extraterrestrial life.',
    name: 'UN Confirms Alien Life',
    symbol: 'ALIEN',
    deadline: 'infinite',
  },
  btcath: {
    question: 'Will BTC/USD reach a new all-time high in 2026? (Chainlink 6H TWAP)',
    name: 'BTC All-Time High',
    symbol: 'BTCATH',
    deadline: '2026-12-31',
  },
  lakers: {
    question: 'Will the LA Lakers win the 2025-26 NBA Championship?',
    name: 'Lakers 2026 Championship',
    symbol: 'LAKERS',
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
  out(bold(`Creating Market: ${template.symbol}`));
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
        address: config.contracts.MockUSDC,
        abi: MOCK_ERC20_ABI,
        functionName: 'mint',
        args: [address, required * 2n],
      });
      await config.publicClient.waitForTransactionReceipt({ hash: mintHash });
      out(success('  Minted ✓'));
    } else {
      out(success('  Balance OK ✓'));
    }

    out(info('[2/4] Approving USDC...'));
    const approveHash = await config.walletClient.writeContract({
      address: config.contracts.MockUSDC,
      abi: MOCK_ERC20_ABI,
      functionName: 'approve',
      args: [config.contracts.LaunchpadEngine, MAX_UINT256],
    });
    await config.publicClient.waitForTransactionReceipt({ hash: approveHash });
    out(success('  Approved ✓'));

    out(info('[3/4] Creating market...'));
    const startTime = 0n;
    const deadline = template.deadline === 'infinite'
      ? BigInt('7258118399')
      : BigInt(Math.floor(new Date(template.deadline + 'T23:59:59Z').getTime() / 1000));

    const createHash = await config.walletClient.writeContract({
      address: config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'createMarket',
      args: [template.question, startTime, deadline, address, address, liquidityWad, template.symbol],
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
    out(plain(`Symbol:      ${template.symbol}`));
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
    const isGraduated = marketState[7];

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
        address: config.contracts.MockUSDC,
        abi: MOCK_ERC20_ABI,
        functionName: 'approve',
        args: [config.contracts.LaunchpadEngine, MAX_UINT256],
      });

      const hash = await config.walletClient.writeContract({
        address: config.contracts.LaunchpadEngine,
        abi: ABIS.LaunchpadEngine,
        functionName: 'tradePositions',
        args: [marketAddress, 1, WAD, MAX_UINT256],
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
        address: config.contracts.MockUSDC,
        abi: MOCK_ERC20_ABI,
        functionName: 'mint',
        args: [address, requiredUsdc * 2n],
      });
      await config.publicClient.waitForTransactionReceipt({ hash: mintHash });
      out(success('Minted ✓'));
    }

    out(info('Approving...'));
    const approveHash = await config.walletClient.writeContract({
      address: config.contracts.MockUSDC,
      abi: MOCK_ERC20_ABI,
      functionName: 'approve',
      args: [config.contracts.LaunchpadEngine, MAX_UINT256],
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
          address: config.contracts.LaunchpadEngine,
          abi: ABIS.LaunchpadEngine,
          functionName: 'tradePositions',
          args: [marketAddress, 1, delta, maxCostOrMinProceeds],
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
        if (checkState[7]) {
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
      isGraduated = marketState[7];
      output.push(plain(`Initialized: YES`));
      output.push(plain(`Creator:     ${shortAddress(marketState[0])}`));
      output.push(plain(`bBase:       ${formatWad(marketState[1])}`));
      output.push(plain(`bCurrent:    ${formatWad(marketState[2])}`));
      output.push(plain(`Fees:        ${formatWad(marketState[4])} USDC`));
      output.push(plain(`LP Supply:   ${formatWad(marketState[5])}`));
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

      try {
        const yesPrice = await config.publicClient.readContract({
          address: config.contracts.AMMEngine,
          abi: ABIS.AMMEngine,
          functionName: 'getPrice',
          args: [marketAddress, 1],
        }) as bigint;

        output.push(plain(`YES Price:   ${(Number(yesPrice) / 1e18 * 100).toFixed(2)}%`));
      } catch {
        // Price not available
      }
    } else {
      output.push(plain(`Initialized: NO`));
    }
  } catch {
    output.push(plain(`Initialized: NO`));
  }

  // 4. TickBook Pool Status (only relevant if graduated)
  output.push(plain(''));
  output.push(info('TickBook Pool (Orderbook)'));
  output.push(separator(40));

  try {
    const [yesToken, noToken] = await config.publicClient.readContract({
      address: config.contracts.Collateralizer,
      abi: ABIS.Collateralizer,
      functionName: 'getOutcomeTokens',
      args: [marketAddress],
    }) as [string, string];

    if (yesToken === '0x0000000000000000000000000000000000000000') {
      output.push(plain(`Status:      NOT REGISTERED (no tokens)`));
      if (isGraduated) {
        output.push(warn(`Issue: Graduated but no outcome tokens!`));
      }
    } else {
      const key3Param = computeMarketKey(marketAddress, yesToken as `0x${string}`, noToken as `0x${string}`);
      const key4Param = computeMarketKeyWithHook(marketAddress, yesToken as `0x${string}`, noToken as `0x${string}`);

      const tryKey = async (k: `0x${string}`) => {
        try {
          const [tm, , , active] = await config.publicClient.readContract({
            address: config.contracts.TickBookPoolManager,
            abi: ABIS.TickBookPoolManager,
            functionName: 'getMarketInfo',
            args: [k],
          }) as [string, string, string, boolean];
          return { ok: true, active: tm !== '0x0000000000000000000000000000000000000000' && active };
        } catch {
          return { ok: false, active: false };
        }
      };

      const info3 = await tryKey(key3Param);
      const info4 = key3Param !== key4Param ? await tryKey(key4Param) : { ok: false, active: false };

      let marketKey: `0x${string}`;
      let isActive = false;
      let isLegacy = false;

      if (info3.active) {
        marketKey = key3Param;
        isActive = true;
      } else if (info4.active) {
        marketKey = key4Param;
        isActive = true;
        isLegacy = true;
      } else {
        marketKey = key3Param;
      }

      output.push(plain(`Market Key:  ${marketKey.slice(0, 18)}...`));
      if (isLegacy) {
        output.push(warn(`Using legacy key format (with hook)`));
      }
      output.push(plain(`Pool Active: ${isActive ? 'YES' : 'NO'}`));
      
      if (isGraduated && !isActive) {
        output.push(warn(`Issue: Graduated but pool NOT active!`));
        output.push(plain(`       Pool may need manual registration.`));
      } else if (!isGraduated && isActive) {
        output.push(info(`Pool active before graduation (pre-seeded)`));
      }

      if (isActive) {
        try {
          const [currentTick, activeLiqNo, activeLiqYes, currentProb] = await config.publicClient.readContract({
            address: config.contracts.TickBookPoolManager,
            abi: ABIS.TickBookPoolManager,
            functionName: 'getMarketState',
            args: [marketKey],
          }) as [number, bigint, bigint, bigint];

          output.push(plain(`Current Tick: ${currentTick} (${currentTick}%)`));
          output.push(plain(`Probability:  ${(Number(currentProb) / 1e18 * 100).toFixed(2)}%`));
          output.push(plain(`Liquidity:    YES=${formatWad(activeLiqYes)}, NO=${formatWad(activeLiqNo)}`));
        } catch {
          // State not available
        }
      }
    }
  } catch {
    output.push(plain(`Status:      NOT REGISTERED`));
    if (isGraduated) {
      output.push(warn(`Issue: Graduated but not in TickBook!`));
    }
  }

  output.push(plain(''));
  return { result: { success: true }, output };
}

/**
 * Manually register a graduated market in TickBook
 * Usage: registermarket [address]
 * Requires: Owner or Registrar of TickBookPoolManager
 */
export async function registermarket(
  ctx: SDKContext,
  args: string[],
  onProgress?: (line: OutputLine) => void
): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketAddress: ctxMarket } = ctx;
  const out = (line: OutputLine) => { onProgress?.(line); };

  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }

  const marketAddress = args[0] ? args[0] as `0x${string}` : ctxMarket;

  if (!marketAddress) {
    return {
      result: { success: false, message: 'No market address' },
      output: [error('No market address. Use: registermarket <address> or setmarket first')],
    };
  }

  const output: OutputLine[] = [];

  out(plain(''));
  out(bold(`Register Market in TickBook`));
  out(separator(50));

  try {
    out(info('[1/3] Fetching outcome tokens...'));
    const [yesToken, noToken] = await config.publicClient.readContract({
      address: config.contracts.Collateralizer,
      abi: ABIS.Collateralizer,
      functionName: 'getOutcomeTokens',
      args: [marketAddress],
    }) as [string, string];

    if (yesToken === '0x0000000000000000000000000000000000000000') {
      out(error('  Market has no outcome tokens ✗'));
      return { result: { success: false, message: 'No outcome tokens' }, output };
    }
    out(success('  Found ✓'));

    out(info('[2/3] Checking registration status...'));
    const key3Param = computeMarketKey(marketAddress, yesToken as `0x${string}`, noToken as `0x${string}`);
    const key4Param = computeMarketKeyWithHook(marketAddress, yesToken as `0x${string}`, noToken as `0x${string}`);

    const tryKey = async (k: `0x${string}`) => {
      try {
        const [tm, , , active] = await config.publicClient.readContract({
          address: config.contracts.TickBookPoolManager,
          abi: ABIS.TickBookPoolManager,
          functionName: 'getMarketInfo',
          args: [k],
        }) as [string, string, string, boolean];
        return tm !== '0x0000000000000000000000000000000000000000' && active;
      } catch {
        return false;
      }
    };

    const active3 = await tryKey(key3Param);
    const active4 = key3Param !== key4Param ? await tryKey(key4Param) : false;

    if (active3 || active4) {
      const activeKey = active3 ? key3Param : key4Param;
      out(success('  Already registered ✓'));
      out(plain(''));
      out(success('Market is already registered and active!'));
      out(dim(`Market Key: ${activeKey}`));
      return { result: { success: true }, output };
    }
    out(success('  Not registered ✓'));

    out(plain(''));
    out(plain(`Market:    ${shortAddress(marketAddress)}`));
    out(plain(`YES Token: ${shortAddress(yesToken)}`));
    out(plain(`NO Token:  ${shortAddress(noToken)}`));
    out(plain(''));

    out(info('[3/3] Registering market...'));
    const hash = await config.walletClient.writeContract({
      address: config.contracts.TickBookPoolManager,
      abi: ABIS.TickBookPoolManager,
      functionName: 'registerMarket',
      args: [marketAddress, yesToken, noToken, WAD / 2n, '0x0000000000000000000000000000000000000000'],
    });

    const receipt = await config.publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'reverted') {
      out(error('  Transaction reverted ✗'));
      out(dim('  Are you the owner/registrar?'));
      return { result: { success: false, message: 'Transaction reverted' }, output };
    }
    out(success('  Registered ✓'));

    out(plain(''));
    out(success('MARKET REGISTERED!'));
    out(dim(`Market Key: ${key3Param}`));
    out(dim(`Tx: ${shortTx(hash)}`));
    out(plain(''));

    return { result: { success: true, txHash: hash, data: { marketKey: key3Param } }, output };
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('UnauthorizedRegistrar')) {
      out(error('Not authorized. Only owner/registrar can register.'));
      out(dim('Check: cast call <TickBookPoolManager> "owner()"'));
    } else {
      out(error(`Registration failed: ${msg.slice(0, 80)}`));
    }
    return { result: { success: false, message: msg }, output };
  }
}

export const marketCommands = { createmarket, graduate, marketstatus, registermarket };

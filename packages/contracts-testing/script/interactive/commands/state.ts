/**
 * State Commands
 * state, book, positions, info
 */

import type { CommandContext, CommandResult } from './types';
import { ABIS, WAD } from '../config';
import {
  formatWad,
  formatTick,
  formatOutcome,
  shortAddress,
  success,
  error,
  dim,
  bold,
  info,
  warn,
  printTable,
} from '../utils';

/**
 * Show market state
 * Usage: state
 */
export async function state(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketKey, marketAddress } = ctx;
  const publicClient = actorManager.getPublicClient();

  if (!marketKey) {
    return { success: false, message: 'No market selected. Use: setmarket <address>' };
  }

  const scanLimit = args[0] ? Math.max(1, Math.min(parseInt(args[0], 10) || 0, 2000)) : 200;

  // First get basic market state
  let tick: number, liqNo: bigint, liqYes: bigint, prob: bigint;
  try {
    [tick, liqNo, liqYes, prob] = await publicClient.readContract({
      address: deployment.contracts.TickBookPoolManager as `0x${string}`,
      abi: ABIS.TickBookPoolManager,
      functionName: 'getMarketState',
      args: [marketKey],
    }) as [number, bigint, bigint, bigint];
  } catch (err) {
    return { success: false, message: `Failed to get market state: ${(err as Error).message}` };
  }

  console.log(`\n  ${bold('Market State')}`);
  console.log('  ' + '─'.repeat(50));
  console.log(`  Address:      ${marketAddress || 'N/A'}`);
  console.log(`  Market Key:   ${(marketKey as string).slice(0, 18)}...`);
  console.log('');
  console.log(`  Current Tick: ${tick} (${formatTick(tick)})`);
  console.log(`  Probability:  ${(Number(prob) / 1e18 * 100).toFixed(2)}%`);
  console.log('');
  console.log(`  ${info('YES')} Liquidity: ${formatWad(liqYes)} shares`);
  console.log(`  ${warn('NO')} Liquidity:  ${formatWad(liqNo)} shares`);
  console.log('');

  // Scan for active orders (with error handling for individual orders)
  let activeOrders = 0;
  let scanErrors = 0;
  for (let i = 1; i <= scanLimit; i++) {
    try {
      const order = await publicClient.readContract({
        address: deployment.contracts.TickBookPoolManager as `0x${string}`,
        abi: ABIS.TickBookPoolManager,
        functionName: 'getOrder',
        args: [marketKey, BigInt(i)],
      }) as any;

      if (order?.active) activeOrders++;
    } catch {
      scanErrors++;
      // Continue scanning other orders
    }
  }

  console.log(`  Active Orders (scanned 1..${scanLimit}): ${activeOrders}${scanErrors > 0 ? dim(` (${scanErrors} decode errors)`) : ''}`);
  console.log('');

  return { success: true, data: { tick, liqNo, liqYes, prob } };
}

/**
 * Show orderbook depth (simplified view)
 * Usage: book [depth]
 */
export async function book(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketKey } = ctx;
  const publicClient = actorManager.getPublicClient();

  if (!marketKey) {
    return { success: false, message: 'No market selected' };
  }

  const depth = args[0] ? parseInt(args[0], 10) : 10;
  const scanLimit = args[1] ? Math.max(1, Math.min(parseInt(args[1], 10) || 0, 5000)) : 200;

  try {
    // Get market state for current tick
    const [tick, liqNo, liqYes, prob] = await publicClient.readContract({
      address: deployment.contracts.TickBookPoolManager as `0x${string}`,
      abi: ABIS.TickBookPoolManager,
      functionName: 'getMarketState',
      args: [marketKey],
    }) as [number, bigint, bigint, bigint];

    console.log(`\n  ${bold('Order Book')} (tick: ${tick}, prob: ${(Number(prob) / 1e18 * 100).toFixed(1)}%)`);
    console.log('  ' + '═'.repeat(60));

    // Collect active orders
    const yesOrders: any[] = [];
    const noOrders: any[] = [];

    for (let i = 1; i <= scanLimit; i++) {
      const order = await publicClient.readContract({
        address: deployment.contracts.TickBookPoolManager as `0x${string}`,
        abi: ABIS.TickBookPoolManager,
        functionName: 'getOrder',
        args: [marketKey, BigInt(i)],
      }) as any;

      if (order?.active) {
        const remaining = order.sharesTotal - order.filledShares;
        if (remaining > 0n) {
          const orderData = {
            id: i,
            tickLower: order.tickLower,
            tickUpper: order.tickUpper,
            remaining,
            owner: order.owner,
          };

          if (order.outcome === 1) {
            yesOrders.push(orderData);
          } else {
            noOrders.push(orderData);
          }
        }
      }
    }

    // Sort by tick (ascending for display)
    yesOrders.sort((a, b) => a.tickLower - b.tickLower);
    noOrders.sort((a, b) => b.tickLower - a.tickLower); // Reverse for NO side

    // Display YES side (bids)
    console.log(`\n  ${info('YES Orders')} (${yesOrders.length} active)`);
    if (yesOrders.length === 0) {
      console.log('  ' + dim('  (no active YES orders)'));
    } else {
      const yesRows = yesOrders.slice(0, depth).map(o => [
        `#${o.id}`,
        `${formatTick(o.tickLower)}-${formatTick(o.tickUpper)}`,
        formatWad(o.remaining),
        shortAddress(o.owner),
      ]);
      printTable(['ID', 'Range', 'Remaining', 'Owner'], yesRows, [6, 14, 14, 14]);
    }

    // Display NO side (asks)
    console.log(`\n  ${warn('NO Orders')} (${noOrders.length} active)`);
    if (noOrders.length === 0) {
      console.log('  ' + dim('  (no active NO orders)'));
    } else {
      const noRows = noOrders.slice(0, depth).map(o => [
        `#${o.id}`,
        `${formatTick(o.tickLower)}-${formatTick(o.tickUpper)}`,
        formatWad(o.remaining),
        shortAddress(o.owner),
      ]);
      printTable(['ID', 'Range', 'Remaining', 'Owner'], noRows, [6, 14, 14, 14]);
    }

    console.log('');

    // Summary
    const totalYesLiq = yesOrders.reduce((sum, o) => sum + o.remaining, 0n);
    const totalNoLiq = noOrders.reduce((sum, o) => sum + o.remaining, 0n);

    console.log('  ' + '─'.repeat(40));
    console.log(`  Total YES liquidity: ${formatWad(totalYesLiq)} shares`);
    console.log(`  Total NO liquidity:  ${formatWad(totalNoLiq)} shares`);
    console.log('');

    return { success: true };
  } catch (err) {
    return { success: false, message: `Failed to get order book: ${(err as Error).message}` };
  }
}

/**
 * Show positions for all actors
 * Usage: positions
 */
export async function positions(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketAddress } = ctx;
  const publicClient = actorManager.getPublicClient();

  if (!marketAddress) {
    return { success: false, message: 'No market selected' };
  }

  const actors = actorManager.listActors();
  if (actors.length === 0) {
    return { success: false, message: 'No actors loaded' };
  }

  console.log(`\n  ${bold('Positions')}`);
  console.log('  ' + '─'.repeat(60));

  const rows: string[][] = [];

  for (const actor of actors) {
    try {
      // Get vault position
      const [available, reserved] = await Promise.all([
        publicClient.readContract({
          address: deployment.contracts.TickBookVault as `0x${string}`,
          abi: ABIS.TickBookVault,
          functionName: 'availableUsdcWad',
          args: [actor.account.address],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: deployment.contracts.TickBookVault as `0x${string}`,
          abi: ABIS.TickBookVault,
          functionName: 'reservedUsdcWad',
          args: [actor.account.address],
        }) as Promise<bigint>,
      ]);

      // Get internal outcomes from vault
      const [yesShares, noShares] = await publicClient.readContract({
        address: deployment.contracts.TickBookVault as `0x${string}`,
        abi: ABIS.TickBookVault,
        functionName: 'getInternalOutcomes',
        args: [marketAddress, actor.account.address],
      }) as [bigint, bigint];

      const isCurrent = actorManager.currentActor()?.name === actor.name;
      const nameDisplay = isCurrent ? success(actor.name) : actor.name;

      rows.push([
        nameDisplay,
        formatWad(available),
        formatWad(reserved),
        formatWad(yesShares),
        formatWad(noShares),
      ]);
    } catch (err) {
      rows.push([actor.name, '?', '?', '?', '?']);
    }
  }

  printTable(
    ['Actor', 'Available', 'Reserved', 'YES Shares', 'NO Shares'],
    rows,
    [10, 12, 12, 12, 12]
  );

  console.log('');
  return { success: true };
}

/**
 * Show market info (addresses)
 * Usage: info
 */
export async function marketinfo(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketKey, marketAddress } = ctx;
  const publicClient = actorManager.getPublicClient();

  if (!marketKey) {
    return { success: false, message: 'No market selected' };
  }

   try {
     const result = await publicClient.readContract({
       address: deployment.contracts.TickBookPoolManager as `0x${string}`,
       abi: ABIS.TickBookPoolManager,
       functionName: 'getMarketInfo',
       args: [marketKey],
     }) as readonly [`0x${string}`, `0x${string}`, `0x${string}`, boolean];
     const [truthMarket, yesToken, noToken, hasHook] = result;

    const active =
      truthMarket !== '0x0000000000000000000000000000000000000000' &&
      yesToken !== '0x0000000000000000000000000000000000000000' &&
      noToken !== '0x0000000000000000000000000000000000000000';

    console.log(`\n  ${bold('Market Info')}`);
    console.log('  ' + '─'.repeat(50));
    console.log(`  Market Key:   ${marketKey}`);
    console.log(`  TruthMarket:  ${truthMarket}`);
    console.log(`  YES Token:    ${yesToken}`);
    console.log(`  NO Token:     ${noToken}`);
    console.log(`  Has Hook:     ${hasHook ? success('yes') : dim('no')}`);
    console.log(`  Active:       ${active ? success('yes') : warn('no')}`);
    console.log('');

    return { success: true };
  } catch (err) {
    return { success: false, message: `Failed to get market info: ${(err as Error).message}` };
  }
}

/**
 * Show current market selection
 * Usage: markets (or m)
 */
export async function markets(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { marketKey, marketAddress, marketName, deployment, actorManager, config } = ctx;

  console.log(`\n  ${bold('Current Market')}`);
  console.log('  ' + '─'.repeat(50));

  if (!marketAddress) {
    console.log(`  ${warn('No market selected')}`);
    console.log('');
    console.log('  Use: setmarket <address|index|name>');
  } else {
    // Use marketName from context (set by setMarket), fallback to deployment config
    const deployedMarket = deployment.markets.find(
      m => m.address.toLowerCase() === marketAddress.toLowerCase()
    );
    const displayName = marketName || deployedMarket?.name;

    console.log(`  Name:    ${displayName || dim('(unknown)')}`);
    console.log(`  Address: ${marketAddress}`);
    console.log(`  Key:     ${marketKey || dim('N/A')}`);
  }

  // Fetch available markets from LaunchpadEngine on-chain
  const publicClient = actorManager.getPublicClient();
  try {
    const onChainMarkets = await publicClient.readContract({
      address: config.deployment.contracts.LaunchpadEngine as `0x${string}`,
      abi: [
        {
          name: 'getMarkets',
          type: 'function',
          inputs: [],
          outputs: [{ type: 'address[]', name: '' }],
          stateMutability: 'view',
        },
      ],
      functionName: 'getMarkets',
    }) as string[];

    if (onChainMarkets.length > 0) {
      console.log('');
      console.log(`  ${info('Available markets:')} (${onChainMarkets.length} on-chain)`);

      // Fetch names for each market
      for (let i = 0; i < onChainMarkets.length; i++) {
        const addr = onChainMarkets[i];
        const isCurrent = addr.toLowerCase() === marketAddress?.toLowerCase();
        const marker = isCurrent ? success('→') : ' ';

        try {
          // V11: MarketState includes lpToken at index 1
           const marketState = await publicClient.readContract({
             address: config.deployment.contracts.LaunchpadEngine as `0x${string}`,
             abi: [
               {
                 name: 'markets',
                 type: 'function',
                 inputs: [{ type: 'address', name: 'market' }],
                 outputs: [
                   { type: 'address', name: 'creator' },
                   { type: 'address', name: 'lpToken' },
                   { type: 'uint256', name: 'bBase' },
                   { type: 'uint256', name: 'bCurrent' },
                   { type: 'uint256', name: 'creatorDeposit' },
                   { type: 'uint256', name: 'feesAccrued' },
                   { type: 'uint256', name: 'totalLPSupply' },
                   { type: 'uint256', name: 'lpYieldPool' },
                   { type: 'bool', name: 'isGraduated' },
                   { type: 'uint64', name: 'createdAt' },
                   { type: 'uint64', name: 'graduatedAt' },
                 ],
                 stateMutability: 'view',
               },
             ],
             functionName: 'markets',
             args: [addr as `0x${string}`],
           }) as [string, string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, bigint, bigint];

           const [, , bBase, , , , , , isGraduated] = marketState;
          
          // Symbol derived from address (first 4 bytes = 8 hex chars)
          const symbol = addr.slice(2, 10).toUpperCase();
          
          // Try to fetch actual name from TruthMarket.question()
          let name = symbol;
          try {
            const question = await publicClient.readContract({
              address: addr as `0x${string}`,
              abi: [
                {
                  name: 'question',
                  type: 'function',
                  inputs: [],
                  outputs: [{ type: 'string', name: '' }],
                  stateMutability: 'view',
                },
              ],
              functionName: 'question',
            }) as string;
            if (question) name = question.length > 40 ? question.slice(0, 37) + '...' : question;
          } catch {}
          const bDisplay = (Number(bBase) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 });

          let pctStr = '?';
          if (isGraduated) {
            pctStr = '✓';
          } else {
            try {
              const progress = await publicClient.readContract({
                address: config.deployment.contracts.LaunchpadEngine as `0x${string}`,
                abi: [
                  {
                    name: 'getGraduationProgress',
                    type: 'function',
                    inputs: [{ type: 'address', name: 'market' }],
                    outputs: [
                      { type: 'uint256', name: 'feesAccrued' },
                      { type: 'uint256', name: 'threshold' },
                      { type: 'uint256', name: 'percentComplete' },
                    ],
                    stateMutability: 'view',
                  },
                ],
                functionName: 'getGraduationProgress',
                args: [addr as `0x${string}`],
              }) as [bigint, bigint, bigint];
              const pctBps = Number(progress[2]);
              pctStr = pctBps >= 10000 ? 'ready!' : `${(pctBps / 100).toFixed(0)}%`;
            } catch {}
          }
          const nameDisplay = (name || 'Unnamed').slice(0, 55);
          console.log(`  ${marker} ${i}: ${nameDisplay}`);
          console.log(`     ${dim(`[${symbol}]  ${pctStr.padEnd(6)}  b=${bDisplay.padStart(6)}  ${shortAddress(addr)}`)}`);
        } catch {
          console.log(`  ${marker} ${i}: ${dim('(error fetching)')}`);
          console.log(`     ${dim(`${shortAddress(addr)}`)}`);
        }
      }
    }
  } catch {
    // Fallback to deployment config if on-chain fetch fails
    if (deployment.markets.length > 0) {
      console.log('');
      console.log(`  ${info('Available markets:')} (from config)`);
      deployment.markets.forEach((m, i) => {
        const isCurrent = m.address.toLowerCase() === marketAddress?.toLowerCase();
        const marker = isCurrent ? success('→') : ' ';
        const nameDisplay = (m.name || 'Unnamed').padEnd(50).slice(0, 50);
        console.log(`  ${marker} ${i}: ${nameDisplay}`);
        console.log(`     ${dim(shortAddress(m.address))}`);
      });
    }
  }
  console.log('');

  return { success: true };
}

/**
 * Set the current market
 * Usage: setmarket <address|name>
 */
export async function setmarket(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  // This is handled in the main REPL, but we provide help here
  if (args.length < 1) {
    console.log('\n  Usage: setmarket <address|index|latest>');
    console.log('  Example: setmarket 0x1234...');
    console.log('  Example: setmarket 0  (first market in deployment)');
    console.log('  Example: setmarket latest  (most recent on-chain)');

    // Show available markets
    if (ctx.deployment.markets.length > 0) {
      console.log('\n  Available markets:');
      ctx.deployment.markets.forEach((m, i) => {
        console.log(`    ${i}: ${m.name || 'Unnamed'} (${shortAddress(m.address)})`);
      });
    }
    console.log('');
  }

  return { success: true };
}

/**
 * Show/test RPC connection
 * Usage: rpc [url]
 */
export async function rpc(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, config } = ctx;
  const publicClient = actorManager.getPublicClient();

  console.log(`\n  ${bold('RPC Status')}`);
  console.log('  ' + '─'.repeat(50));
  console.log(`  Chain:    ${config.chainName} (${config.chain.id})`);
  console.log(`  RPC URL:  ${config.rpc}`);

  // Test RPC connection
  try {
    const startTime = Date.now();
    const blockNumber = await publicClient.getBlockNumber();
    const latency = Date.now() - startTime;

    console.log(`  Block:    ${blockNumber}`);
    console.log(`  Latency:  ${latency}ms`);
    console.log(`  Status:   ${success('Connected')}`);
  } catch (err) {
    console.log(`  Status:   ${error('Failed')}`);
    console.log(`  Error:    ${(err as Error).message.slice(0, 60)}`);
  }

  // Test a contract call
  try {
    const startTime = Date.now();
    await publicClient.readContract({
      address: config.deployment.contracts.TickBookPoolManager as `0x${string}`,
      abi: [{ name: 'owner', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }],
      functionName: 'owner',
    });
    const latency = Date.now() - startTime;
    console.log(`  Contract: ${success('OK')} (${latency}ms)`);
  } catch (err) {
    console.log(`  Contract: ${warn('Call failed')} - ${(err as Error).message.slice(0, 40)}`);
  }

  console.log('');

  // Show tip for changing RPC
  if (args.length === 0) {
    console.log(dim('  To use a different RPC, restart with: --rpc=<url>'));
    console.log('');
  }

  return { success: true };
}

/**
 * Debug: show raw contract call result
 * Usage: call <contract> <function> [args...]
 */
export async function call(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment } = ctx;
  const publicClient = actorManager.getPublicClient();

  if (args.length < 2) {
    console.log('\n  Usage: call <contract> <function> [args...]');
    console.log('  Contracts: TickBookPoolManager, TickBookVault, LaunchpadEngine, MockUSDC');
    console.log('  Example: call TickBookPoolManager owner');
    console.log('  Example: call MockUSDC balanceOf 0x1234...');
    console.log('');
    return { success: true };
  }

  const contractName = args[0];
  const functionName = args[1];
  const callArgs = args.slice(2);

  // Map contract name to address
  const contractMap: Record<string, string> = {
    tickbookpoolmanager: deployment.contracts.TickBookPoolManager,
    poolmanager: deployment.contracts.TickBookPoolManager,
    tickbookvault: deployment.contracts.TickBookVault,
    vault: deployment.contracts.TickBookVault,
    launchpadengine: deployment.contracts.LaunchpadEngine,
    launchpad: deployment.contracts.LaunchpadEngine,
    mockusdc: deployment.contracts.MockUSDC,
    usdc: deployment.contracts.MockUSDC,
    collateralizer: deployment.contracts.Collateralizer,
  };

  const contractAddr = contractMap[contractName.toLowerCase()];
  if (!contractAddr) {
    return { success: false, message: `Unknown contract: ${contractName}` };
  }

  console.log(`\n  ${bold('Contract Call')}`);
  console.log('  ' + '─'.repeat(50));
  console.log(`  Contract: ${contractName} (${shortAddress(contractAddr)})`);
  console.log(`  Function: ${functionName}`);
  console.log(`  Args:     ${callArgs.length > 0 ? callArgs.join(', ') : '(none)'}`);
  console.log('');

  try {
    // Build minimal ABI for the function
    const inputs = callArgs.map((_, i) => ({ type: 'address', name: `arg${i}` }));
    const abi = [{
      name: functionName,
      type: 'function',
      inputs,
      outputs: [{ type: 'bytes', name: '' }],
      stateMutability: 'view',
    }];

    const result = await publicClient.readContract({
      address: contractAddr as `0x${string}`,
      abi,
      functionName,
      args: callArgs as any[],
    });

    console.log(`  Result: ${JSON.stringify(result, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2)}`);
    console.log('');
    return { success: true };
  } catch (err) {
    const errMsg = (err as Error).message;
    console.log(`  ${error('Error:')} ${errMsg.slice(0, 200)}`);
    console.log('');
    return { success: false, message: errMsg };
  }
}

export const stateCommands = {
  state,
  book,
  positions,
  info: marketinfo,
  markets,
  setmarket,
  rpc,
  call,
};

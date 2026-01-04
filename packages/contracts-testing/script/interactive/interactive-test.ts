#!/usr/bin/env bun
/**
 * Interactive On-Chain Testing REPL
 * Sooth Protocol V9
 *
 * Usage:
 *   bun run script/interactive/interactive-test.ts --chain=baseSepolia
 */

import * as readline from 'readline';
import { keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';
import { createConfig, type InteractiveConfig, type Deployment, ABIS } from './config';
import { createActorManager, type ActorManager } from './actors';
import {
  parseCommand,
  success,
  error,
  info,
  dim,
  bold,
  warn,
  printBox,
  shortAddress,
} from './utils';
import {
  type CommandContext,
  type CommandResult,
  type RecordingState,
  walletCommands,
  vaultCommands,
  orderbookCommands,
  stateCommands,
  marketCommands,
} from './commands';
import { ScenarioEngine } from './scenarios/engine';
import { runAllInvariants, printInvariantResults } from './assertions';

// Parse CLI arguments
const args = process.argv.slice(2);
const chainArg = args.find(a => a.startsWith('--chain='))?.split('=')[1] || 'baseSepolia';
const marketArg = args.find(a => a.startsWith('--market='))?.split('=')[1];
const rpcArg = args.find(a => a.startsWith('--rpc='))?.split('=')[1];

// Global state
let config: InteractiveConfig;
let actorManager: ActorManager;
let currentMarketKey: `0x${string}` | null = null;
let currentMarketAddress: `0x${string}` | null = null;
let currentMarketName: string | null = null;
let recording: RecordingState = { active: false, commands: [], startTime: 0 };
let scenarioEngine: ScenarioEngine;

/**
 * Compute market key from market info
 */
function computeMarketKey(
  truthMarket: string,
  yesToken: string,
  noToken: string,
  hook: string = '0x0000000000000000000000000000000000000000'
): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('address, address, address, address'),
      [
        truthMarket as `0x${string}`,
        yesToken as `0x${string}`,
        noToken as `0x${string}`,
        hook as `0x${string}`,
      ]
    )
  );
}

function computeLegacyMarketKey(
  truthMarket: string,
  yesToken: string,
  noToken: string
): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('address, address, address'),
      [truthMarket as `0x${string}`, yesToken as `0x${string}`, noToken as `0x${string}`]
    )
  );
}

/**
 * Set current market by address or index
 */
async function setMarket(addressOrIndex: string): Promise<boolean> {
  const publicClient = actorManager.getPublicClient();

  let marketAddress: string;

  // Check if it's an index - fetch from on-chain markets list
  if (/^\d+$/.test(addressOrIndex)) {
    const index = parseInt(addressOrIndex, 10);

    // Fetch on-chain markets from LaunchpadEngine
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

      if (index >= onChainMarkets.length) {
        console.log(error(`  Market index ${index} out of range (${onChainMarkets.length} markets available)`));
        return false;
      }
      marketAddress = onChainMarkets[index];
    } catch {
      // Fallback to deployment config
      if (index >= config.deployment.markets.length) {
        console.log(error(`  Market index ${index} out of range`));
        return false;
      }
      marketAddress = config.deployment.markets[index].address;
    }
  } else if (addressOrIndex.startsWith('0x')) {
    marketAddress = addressOrIndex;
  } else {
    // Try to find by name in deployment config
    const market = config.deployment.markets.find(
      m => m.name?.toLowerCase() === addressOrIndex.toLowerCase()
    );
    if (!market) {
      console.log(error(`  Market not found: ${addressOrIndex}`));
      return false;
    }
    marketAddress = market.address;
  }

  // Get market info from deployment or compute key
  const deployedMarket = config.deployment.markets.find(
    m => m.address.toLowerCase() === marketAddress.toLowerCase()
  );

  let yesToken: string | undefined;
  let noToken: string | undefined;

  if (deployedMarket?.marketKey) {
    currentMarketKey = deployedMarket.marketKey as `0x${string}`;
  } else if (deployedMarket?.yesToken && deployedMarket?.noToken) {
    yesToken = deployedMarket.yesToken;
    noToken = deployedMarket.noToken;
    currentMarketKey = computeMarketKey(marketAddress, yesToken, noToken);
  } else {
    // Try to fetch token info from chain
    console.log(dim('  Fetching market info from chain...'));

    // First check if market exists in LaunchpadEngine (pre-graduation)
    let isLaunchpadMarket = false;
    try {
      const marketState = await publicClient.readContract({
        address: config.deployment.contracts.LaunchpadEngine as `0x${string}`,
        abi: [
          {
            name: 'markets',
            type: 'function',
            inputs: [{ type: 'address', name: 'market' }],
            outputs: [
              { type: 'address', name: 'creator' },
              { type: 'uint256', name: 'bBase' },
              { type: 'uint256', name: 'bCurrent' },
              { type: 'uint256', name: 'creatorDeposit' },
              { type: 'uint256', name: 'feesAccrued' },
              { type: 'uint256', name: 'totalLPSupply' },
              { type: 'uint256', name: 'lpYieldPool' },
              { type: 'bool', name: 'isGraduated' },
              { type: 'uint64', name: 'createdAt' },
              { type: 'uint64', name: 'graduatedAt' },
              { type: 'string', name: 'name' },
              { type: 'string', name: 'symbol' },
            ],
            stateMutability: 'view',
          },
        ],
        functionName: 'markets',
        args: [marketAddress as `0x${string}`],
      }) as [string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, bigint, bigint, string, string];

      const [creator, , , , , , , isGraduated, , , name] = marketState;
      if (creator !== '0x0000000000000000000000000000000000000000') {
        isLaunchpadMarket = true;

        if (!isGraduated) {
          // Pre-graduation market - no tokens yet, but we can still set it for AMM trading
          currentMarketAddress = marketAddress as `0x${string}`;
          currentMarketKey = null; // No market key for pre-graduation markets
          currentMarketName = name || null;
          console.log(success(`  Market set: ${name || shortAddress(marketAddress)}`));
          console.log(warn('  Pre-graduation market (LaunchpadEngine only)'));
          console.log(dim('  Use graduate command to graduate, then TickBook will be available'));
          return true;
        }
        // For graduated markets, also store the name
        currentMarketName = name || null;
      }
    } catch {
      // Market not found in LaunchpadEngine, will try Collateralizer next
    }

    // Try Collateralizer (for graduated markets)
    try {
      const [yes, no] = await publicClient.readContract({
        address: config.deployment.contracts.Collateralizer as `0x${string}`,
        abi: [
          {
            name: 'getOutcomeTokens',
            type: 'function',
            inputs: [{ type: 'address', name: 'market' }],
            outputs: [{ type: 'address', name: 'yesToken' }, { type: 'address', name: 'noToken' }],
            stateMutability: 'view',
          },
        ],
        functionName: 'getOutcomeTokens',
        args: [marketAddress as `0x${string}`],
      }) as [string, string];

      if (yes !== '0x0000000000000000000000000000000000000000') {
        yesToken = yes;
        noToken = no;
        // Try V9.9.6 key (includes hook) first, then fall back to legacy key (no hook)
        const keyV996 = computeMarketKey(marketAddress, yesToken, noToken);
        const keyLegacy = computeLegacyMarketKey(marketAddress, yesToken, noToken);

        const tryKey = async (k: `0x${string}`) => {
          try {
            const [tm, y, n, h] = await publicClient.readContract({
              address: config.deployment.contracts.TickBookPoolManager as `0x${string}`,
              abi: ABIS.TickBookPoolManager,
              functionName: 'getMarketInfo',
              args: [k],
            }) as [string, string, string, string];

            const active =
              tm !== '0x0000000000000000000000000000000000000000' &&
              y !== '0x0000000000000000000000000000000000000000' &&
              n !== '0x0000000000000000000000000000000000000000';

            return { ok: true, tm, y, n, h, active };
          } catch {
            return { ok: false as const };
          }
        };

        const infoV996 = await tryKey(keyV996);
        const infoLegacy = keyLegacy !== keyV996 ? await tryKey(keyLegacy) : { ok: false as const };

        if (infoV996.ok && infoV996.active) {
          currentMarketKey = keyV996;
        } else if (infoLegacy.ok && infoLegacy.active) {
          currentMarketKey = keyLegacy;
          console.log(warn('  Using legacy marketKey (no hook) for this TickBook deployment'));
        } else {
          currentMarketKey = keyV996;
          console.log(warn('  TickBook market not active/registered yet for this marketKey'));
        }
        console.log(dim(`  YES Token: ${shortAddress(yesToken)}`));
        console.log(dim(`  NO Token:  ${shortAddress(noToken)}`));
      } else if (!isLaunchpadMarket) {
        console.log(error(`  Market not found: ${shortAddress(marketAddress)}`));
        return false;
      }
    } catch (collateralizerErr) {
      if (!isLaunchpadMarket) {
        console.log(error(`  Failed to fetch market info: ${(collateralizerErr as Error).message}`));
        return false;
      }
      // For LaunchpadEngine markets, Collateralizer not being registered is expected
      // (pre-graduation markets don't have outcome tokens yet)
    }
  }

  currentMarketAddress = marketAddress as `0x${string}`;
  console.log(success(`  Market set: ${deployedMarket?.name || shortAddress(marketAddress)}`));
  if (currentMarketKey) {
    console.log(dim(`  Key: ${currentMarketKey.slice(0, 18)}...`));
  }

  return true;
}

/**
 * Build command context
 */
function buildContext(): CommandContext {
  return {
    actorManager,
    deployment: config.deployment,
    config,
    marketKey: currentMarketKey,
    marketAddress: currentMarketAddress,
    marketName: currentMarketName,
    recording,
  };
}

/**
 * Print help
 */
function printHelp(): void {
  console.log(`
  ${bold('Commands:')}

  ${info('Actor Management:')}
    actor <name>         Switch to actor (alice, bob, charlie, keeper)
    actors               List all actors

  ${dim('┄'.repeat(62))}

  ${info('Wallet (global):')}
    balance              Show USDC balances (wallet + vault)
    mint <amount>        Mint MockUSDC
    approve <contract>   Approve (vault, poolmanager, launchpad, all)
    allowance            Show current allowances

  ${dim('┄'.repeat(62))}

  ${info('Market (TruthMarket / LaunchpadEngine):')}
    createmarket <template>  Create new market (alien, btc100k, custom)
    graduate [steps]         Graduate market via trades (default 8 steps)
    marketstatus             Show full market lifecycle status

  ${dim('  │')}
  ${dim('  └─ Graduated markets become TickBook pools (marketKey)')}

  ${info('TickBook (Vault / PoolManager):')}
    ${dim('# Requires a TickBook-registered (active) marketKey; use: setmarket <address>')}

    ${info('Vault:')}
      deposit <amount>     Deposit USDC to vault
      withdraw <amount>    Withdraw USDC from vault
      reserved             Show reserved balance details

    ${info('Orderbook (V9.9.6-fix9l Range Order API):')}
      order <side> <range> <shares>   Place order (range, limit, or market)
                                      Range:  order yes 40-60 100
                                      Limit:  order yes 50 100
                                      Market: order yes 1-999 100
      cancel <orderId>                Cancel order
      claim <orderId>                 Claim fills
      market buy|sell <side> <shares> Market order shortcut
                                      Example: market buy no 50
      orders [actor]                  List orders

    ${info('State:')}
      state                Show market state (tick, liquidity)
      book [depth]         Show orderbook
      positions            Show all actor positions
      info                 Show market info (addresses)
      markets              Show current market & available markets
      setmarket <addr>     Set current market

    ${info('Simulation:')}
      simulate [n] [size] [seed]  Run orderbook simulation
                                  n:    Number of orders (default 10)
                                  size: Average shares (default 100)
                                  seed: Random seed for reproducibility
                                  ${dim('Press Enter during simulation to stop early')}
                                  Examples:
                                    simulate              10 random orders
                                    simulate 50           50 orders
                                    simulate 20 500       20 orders, 500 avg size
                                    simulate 20 100 12345 Deterministic (seed)

  ${dim('┄'.repeat(62))}

  ${info('Scenarios:')}
    scenario <name>      Run predefined scenario
    scenarios            List available scenarios
    record start         Start recording commands
    record stop <name>   Save recorded scenario
    playback <name>      Playback saved scenario

  ${info('Invariants:')}
    invariants           Run all invariant checks
    check                Alias for invariants

  ${info('Debug:')}
    rpc                  Show RPC status and test connection
    call <contract> <fn> Raw contract call for debugging

  ${info('Other:')}
    help                 Show this help
    clear                Clear screen
    exit / quit          Exit REPL
`);
}

/**
 * Handle a single command
 */
async function handleCommand(input: string): Promise<void> {
  const { command, args } = parseCommand(input);

  if (!command) return;

  const ctx = buildContext();

  // Record command if recording
  if (recording.active && command !== 'record') {
    const actor = actorManager.currentActor();
    if (actor) {
      recording.commands.push({
        actor: actor.name,
        command,
        args,
        timestamp: Date.now() - recording.startTime,
      });
    }
  }

  try {
    const run = async (p: Promise<CommandResult>) => {
      const res = await p;
      if (!res.success && res.message) {
        console.log(error(`  ${res.message}`));
      }
      return res;
    };

    switch (command) {
      // Actor management
      case 'actor':
        if (args.length < 1) {
          const current = actorManager.currentActor();
          if (current) {
            console.log(`  Current: ${success(current.name)} (${shortAddress(current.account.address)})`);
          }
        } else {
          const actor = actorManager.switchActor(args[0]);
          if (actor) {
            console.log(`  ${success('Switched to')} ${actor.name} (${shortAddress(actor.account.address)})`);
          } else {
            console.log(error(`  Unknown actor: ${args[0]}`));
          }
        }
        break;

      case 'actors':
        actorManager.printStatus();
        break;

      // Wallet commands
      case 'balance':
        await run(walletCommands.balance(ctx, args));
        break;

      case 'mint':
        await run(walletCommands.mint(ctx, args));
        break;

      case 'approve':
        await run(walletCommands.approve(ctx, args));
        break;

      case 'allowance':
        await run(walletCommands.allowance(ctx, args));
        break;

      // Vault commands
      case 'deposit':
        await run(vaultCommands.deposit(ctx, args));
        break;

      case 'withdraw':
        await run(vaultCommands.withdraw(ctx, args));
        break;

      case 'reserved':
        await run(vaultCommands.reserved(ctx, args));
        break;

      // Orderbook commands
      case 'order':
        await run(orderbookCommands.order(ctx, args));
        break;

      case 'cancel':
        await run(orderbookCommands.cancel(ctx, args));
        break;

      case 'claim':
        await run(orderbookCommands.claim(ctx, args));
        break;

      case 'market':
        await run(orderbookCommands.market(ctx, args));
        break;

      case 'orders':
        await run(orderbookCommands.orders(ctx, args));
        break;

      case 'getorder':
        await run(orderbookCommands.getorder(ctx, args));
        break;

      // State commands
      case 'state':
        await run(stateCommands.state(ctx, args));
        break;

      case 'book':
        await run(stateCommands.book(ctx, args));
        break;

      case 'positions':
        await run(stateCommands.positions(ctx, args));
        break;

      case 'info':
        await run(stateCommands.info(ctx, args));
        break;

      case 'markets':
      case 'm':
        await run(stateCommands.markets(ctx, args));
        break;

      case 'setmarket':
        if (args.length < 1) {
          await run(stateCommands.setmarket(ctx, args));
        } else {
          await setMarket(args[0]);
        }
        break;

      case 'rpc':
        await run(stateCommands.rpc(ctx, args));
        break;

      case 'call':
        await run(stateCommands.call(ctx, args));
        break;

      // Market lifecycle commands
      case 'createmarket':
        await run(marketCommands.createmarket(ctx, args));
        break;

      case 'graduate':
        await run(marketCommands.graduate(ctx, args));
        break;

      case 'marketstatus':
        await run(marketCommands.marketstatus(ctx, args));
        break;

      case 'simulate':
        await run(marketCommands.simulate(ctx, args));
        break;

      // Scenario commands
      case 'scenario':
        if (args.length < 1) {
          console.log(error('  Usage: scenario <name>'));
        } else {
          await scenarioEngine.run(args[0], ctx);
        }
        break;

      case 'scenarios':
        scenarioEngine.list();
        break;

      case 'record':
        if (args[0] === 'start') {
          recording = { active: true, commands: [], startTime: Date.now() };
          console.log(success('  Recording started'));
        } else if (args[0] === 'stop') {
          if (!recording.active) {
            console.log(error('  Not recording'));
          } else if (!args[1]) {
            console.log(error('  Usage: record stop <name>'));
          } else {
            scenarioEngine.saveRecording(args[1], recording.commands);
            recording = { active: false, commands: [], startTime: 0 };
            console.log(success(`  Saved scenario: ${args[1]}`));
          }
        } else {
          console.log('  Usage: record start | record stop <name>');
        }
        break;

      case 'playback':
        if (args.length < 1) {
          console.log(error('  Usage: playback <name>'));
        } else {
          await scenarioEngine.playback(args[0], ctx);
        }
        break;

      // Invariant checks
      case 'invariants':
      case 'check':
        const results = await runAllInvariants(ctx);
        printInvariantResults(results);
        break;

      // Other
      case 'help':
      case '?':
        printHelp();
        break;

      case 'clear':
        console.clear();
        break;

      case 'exit':
      case 'quit':
      case 'q':
        console.log(dim('  Goodbye!'));
        process.exit(0);

      default:
        console.log(error(`  Unknown command: ${command}`));
        console.log(dim('  Type "help" for available commands'));
    }
  } catch (err) {
    console.log(error(`  Error: ${(err as Error).message}`));
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.clear();

  // Initialize
  try {
    config = createConfig(chainArg);
    if (rpcArg) config.rpc = rpcArg;
    actorManager = createActorManager(config.chain, config.rpc, undefined, {
      confirmations: config.confirmations,
      postTxWaitMs: config.postTxWaitMs,
    });
    scenarioEngine = new ScenarioEngine(actorManager, handleCommand);
  } catch (err) {
    console.error(error(`Failed to initialize: ${(err as Error).message}`));
    process.exit(1);
  }

  // Check for actors
  if (!actorManager.hasActors()) {
    console.log(warn('No actors loaded. Set PRIVATE_KEY or PRIVATE_KEY_ALICE in .env'));
  }

  // Set default market if specified or available
  if (marketArg) {
    await setMarket(marketArg);
  } else if (config.deployment.markets.length > 0) {
    await setMarket('0');
  }

  // Print header
  const marketName = currentMarketAddress
    ? config.deployment.markets.find(m => m.address.toLowerCase() === currentMarketAddress?.toLowerCase())?.name || shortAddress(currentMarketAddress)
    : 'none';

  printBox([
    bold('SOOTH V9 INTERACTIVE TEST CONSOLE'),
    `Chain: ${config.chainName} | Version: ${config.deployment.version}`,
    `RPC: ${config.rpc.length > 40 ? config.rpc.slice(0, 37) + '...' : config.rpc}`,
    `Market: ${marketName}`,
  ]);

  console.log('');
  console.log(dim('  Type "help" for available commands\n'));

  // Start REPL
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (): void => {
    const actor = actorManager.currentActor();
    const actorStr = actor ? info(actor.name) : dim('no-actor');
    const recordStr = recording.active ? warn(' [REC]') : '';

    rl.question(`${actorStr}${recordStr}> `, async (input) => {
      await handleCommand(input);
      prompt();
    });
  };

  prompt();
}

main().catch(console.error);

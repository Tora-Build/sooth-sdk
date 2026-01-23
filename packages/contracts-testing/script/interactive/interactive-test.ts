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
// Support both --chain=monad and positional: interactive-test.ts monad
const chainArg = args.find(a => a.startsWith('--chain='))?.split('=')[1] 
  || args.find(a => !a.startsWith('--'))  // First non-flag arg
  || 'baseSepolia';
const marketArg = args.find(a => a.startsWith('--market='))?.split('=')[1];
const rpcArg = args.find(a => a.startsWith('--rpc='))?.split('=')[1];
const scenarioArg = args.find(a => a.startsWith('--scenario='))?.split('=')[1];

// Global state
let config: InteractiveConfig;
let actorManager: ActorManager;
let currentMarketKey: `0x${string}` | null = null;
let currentMarketAddress: `0x${string}` | null = null;
let currentMarketName: string | null = null;
let lastCreatedMarketAddress: string | null = null;
let recording: RecordingState = { active: false, commands: [], startTime: 0 };
let scenarioEngine: ScenarioEngine;
let scenarioMode = false;

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
 * Set current market by address, index, or latest
 */
async function setMarket(addressOrIndex: string): Promise<boolean> {
  const publicClient = actorManager.getPublicClient();

  let marketAddress: string;
  const normalized = addressOrIndex.trim().toLowerCase();
  const isDirectAddress = addressOrIndex.startsWith('0x');

  if (normalized === 'created' || normalized === 'lastcreated') {
    if (!lastCreatedMarketAddress) {
      console.log(error('  No created market cached yet'));
      return false;
    }
    marketAddress = lastCreatedMarketAddress;
    return await setMarket(marketAddress);
  }

  // Latest market helper
  if (normalized === 'latest' || normalized === 'last') {
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

      if (onChainMarkets.length === 0) {
        console.log(error('  No markets available on-chain'));
        return false;
      }
      marketAddress = onChainMarkets[onChainMarkets.length - 1];
    } catch (err) {
      console.log(error(`  Failed to fetch latest market: ${(err as Error).message}`));
      return false;
    }
  } else if (/^\d+$/.test(addressOrIndex)) {
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
  } else if (isDirectAddress) {
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

    // First check if market exists in LaunchpadEngine (pre-graduation)
    let isLaunchpadMarket = false;
    try {
      // V11: MarketState includes lpToken
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
        args: [marketAddress as `0x${string}`],
      }) as [string, string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, bigint, bigint];

      const [creator, , , , , , , , isGraduated] = marketState;
      if (creator !== '0x0000000000000000000000000000000000000000') {
        isLaunchpadMarket = true;

        let marketName: string | null = null;
        try {
          marketName = await publicClient.readContract({
            address: marketAddress as `0x${string}`,
            abi: [{ name: 'question', type: 'function', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' }],
            functionName: 'question',
          }) as string;
        } catch {}

        if (!isGraduated) {
          currentMarketAddress = marketAddress as `0x${string}`;
          currentMarketKey = null;
          currentMarketName = marketName;
          const symbol = marketAddress.slice(2, 10).toUpperCase();
          const displayName = marketName ? (marketName.length > 40 ? marketName.slice(0, 37) + '...' : marketName) : symbol;
          console.log(info(`  Market set (pre-graduation): [${symbol}] ${displayName}`));
          console.log(dim(`  Address: ${marketAddress}`));
          console.log(dim(`  Key: (not available pre-graduation)`));
          return true;
        }
        currentMarketName = marketName;
      }
    } catch {}

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
        const keyV10 = computeMarketKey(marketAddress, yesToken, noToken);
        const keyLegacy = computeLegacyMarketKey(marketAddress, yesToken, noToken);

        const tryKey = async (k: `0x${string}`) => {
          try {
            const [tm, y, n, h] = await publicClient.readContract({
              address: config.deployment.contracts.TickBookPoolManager as `0x${string}`,
              abi: ABIS.TickBookPoolManager,
              functionName: 'getMarketInfo',
              args: [k],
            }) as [string, string, string, boolean];

            const active =
              tm !== '0x0000000000000000000000000000000000000000' &&
              y !== '0x0000000000000000000000000000000000000000' &&
              n !== '0x0000000000000000000000000000000000000000';

            return { ok: true, tm, y, n, h, active };
          } catch {
            return { ok: false as const };
          }
        };

        const infoV10 = await tryKey(keyV10);
        const infoLegacy = keyLegacy !== keyV10 ? await tryKey(keyLegacy) : { ok: false as const };

        if (infoV10.ok && infoV10.active) {
          currentMarketKey = keyV10;
        } else if (infoLegacy.ok && infoLegacy.active) {
          currentMarketKey = keyLegacy;
        } else {
          currentMarketKey = keyV10;
        }
      } else if (!isLaunchpadMarket) {
        console.log(error(`  Market not found: ${shortAddress(marketAddress)}`));
        return false;
      }
    } catch (collateralizerErr) {
      if (!isLaunchpadMarket && isDirectAddress) {
        currentMarketAddress = marketAddress as `0x${string}`;
        currentMarketKey = null;
        const symbol = marketAddress.slice(2, 10).toUpperCase();
        console.log(warn(`  Market set (unverified): [${symbol}]`));
        console.log(dim(`  Address: ${marketAddress}`));
        console.log(dim(`  Key: (not available)`));
        return true;
      }
      if (!isLaunchpadMarket) {
        console.log(error(`  Failed to fetch market info: ${(collateralizerErr as Error).message}`));
        return false;
      }
      // For LaunchpadEngine markets, Collateralizer not being registered is expected
      // (pre-graduation markets don't have outcome tokens yet)
    }
  }

  currentMarketAddress = marketAddress as `0x${string}`;
  const symbol = marketAddress.slice(2, 10).toUpperCase();
  const displayName = currentMarketName || deployedMarket?.name || symbol;
  const truncatedName = displayName.length > 40 ? displayName.slice(0, 37) + '...' : displayName;
  console.log(success(`  Market set: [${symbol}] ${truncatedName}`));
  console.log(dim(`  Address: ${marketAddress}`));
  console.log(dim(`  Key: ${currentMarketKey || '(none)'}`));

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
    actor <name>         Switch to actor (alice, bob, charlie, david, ellen, admin)
    actors               List all actors

  ${dim('┄'.repeat(62))}

  ${info('Wallet (global):')}
    balance              Show USDC balances (wallet + vault)
    mint <amount>        Mint MockUSDC
    approve <contract>   Approve (vault, poolmanager, launchpad, all)
    allowance            Show current allowances
    snapshot             Take balance snapshot (before scenario)
    snapshot show        Show stored snapshot
    snapshot clear       Clear stored snapshot
    checksum             Verify zero-sum: Σ(all P&L) = minted

  ${dim('┄'.repeat(62))}

  ${info('Market (TruthMarket / LaunchpadEngine):')}
    createmarket <template>  Create new market (alien, btc100k, custom)
                             Options: --adjudicator=<actor> (default: creator)
    graduate [steps]         Graduate market via trades (default 8 steps)
    marketstatus             Show full market lifecycle status
    settle <outcome>         Settle market (adjudicator only)
                             outcome: yes, no, invalid
    redeem                   Redeem winning tokens for USDC (after settlement)
    redeemlp [amount|max]    Redeem LP tokens for USDC + fees
    pnl [initial]            Show P&L summary (e.g., pnl 50000)
    transferlp <actor> <amt> Transfer LP tokens to another actor
                              Example: transferlp ellen 50
                              ${dim('LP tokens can only be transferred pre-settlement')}

    ${info('Trial Period (V11):')}
      trialstatus              Show trial period status and locked costs
      dismiss                  Dismiss market during trial (creator only)
      claimrefund              Claim refund after market dismissal

  ${dim('  │')}
  ${dim('  └─ Graduated markets become TickBook pools (marketKey)')}

  ${info('TickBook (Vault / PoolManager):')}
    ${dim('# Requires a TickBook-registered (active) marketKey; use: setmarket <address>')}

    ${info('Vault:')}
      deposit <amount>     Deposit USDC to vault
      withdraw <amount>    Withdraw USDC from vault
      reserved             Show reserved balance details

    ${info('Orderbook (V10 Unified Order API):')}\n      order <side> <range> <shares>   Place order (range, limit, or market)\n                                      Range:  order yes 40-60 100\n                                      Limit:  order yes 50 100\n                                      Market: order yes 1-999 100\n      cancel <orderId>                Cancel order\n      claim <orderId>                 Claim fills\n      market buy|sell <side> <shares> Market order shortcut\n                                      Example: market buy no 50\n      orders [actor]                  List orders\n\n    ${info('Spot Sells:')}\n      spotsell <side> <tickRange> <shares>  Place spot sell order\n                                            Example: spotsell no 100-110 1000\n      spotsells                             List all spot sell orders\n      cancelspotsell <sellId>               Cancel a spot sell\n      claimspotsell <sellId>                Claim proceeds from spot sell
      claimspotsellfor <sellId>             Keeper claim proceeds for spot sell\n      hybridsell <side> <amount> <tickLow> <tickHigh>  Hybrid sell\n\n    ${info('State:')}
      state                Show market state (tick, liquidity)
      book [depth]         Show orderbook
      positions            Show all actor positions
      info                 Show market info (addresses)
      markets              Show current market & available markets
      setmarket <addr|index|latest|created>  Set current market

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
      if (!res.success) {
        if (res.message) {
          console.log(error(`  ${res.message}`));
        }
        if (scenarioMode) {
          throw new Error(res.message || 'Command failed');
        }
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

      case 'snapshot':
        await run(walletCommands.snapshot(ctx, args));
        break;

      case 'checksum':
        await run(walletCommands.checksum(ctx, args));
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

      case 'spotsell':
        await run(orderbookCommands.spotsell(ctx, args));
        break;

      case 'cancelspotsell':
        await run(orderbookCommands.cancelspotsell(ctx, args));
        break;

      case 'spotsells':
        await run(orderbookCommands.spotsells(ctx, args));
        break;

      case 'claimspotsell':
        await run(orderbookCommands.claimspotsell(ctx, args));
        break;

      case 'claimspotsellfor':
        await run(orderbookCommands.claimspotsellfor(ctx, args));
        break;

      case 'hybridsell':
        await run(orderbookCommands.hybridsell(ctx, args));
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
        {
          const res = await run(marketCommands.createmarket(ctx, args));
          const created = res.data?.marketAddress as string | undefined;
          if (res.success && created) {
            lastCreatedMarketAddress = created;
            await setMarket(created);
          }
        }
        break;

      case 'graduate':
        await run(marketCommands.graduate(ctx, args));
        break;

      case 'marketstatus':
        await run(marketCommands.marketstatus(ctx, args));
        break;

      case 'settle':
        await run(marketCommands.settle(ctx, args));
        break;

      case 'redeem':
        await run(marketCommands.redeem(ctx, args));
        break;

      case 'redeemlp':
        await run(marketCommands.redeemlp(ctx, args));
        break;

      case 'pnl':
        await run(marketCommands.pnl(ctx, args));
        break;

      case 'transferlp':
        await run(marketCommands.transferlp(ctx, args));
        break;

      case 'simulate':
        await run(marketCommands.simulate(ctx, args));
        break;

      case 'trialstatus':
        await run(marketCommands.trialstatus(ctx, args));
        break;

      case 'dismiss':
        await run(marketCommands.dismiss(ctx, args));
        break;

      case 'claimrefund':
        await run(marketCommands.claimrefund(ctx, args));
        break;

      // Scenario commands
      case 'scenario':
        if (args.length < 1) {
          console.log(error('  Usage: scenario <name>'));
        } else {
          scenarioMode = true;
          try {
            await scenarioEngine.run(args[0], ctx);
          } finally {
            scenarioMode = false;
          }
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
    if (scenarioMode) {
      throw err;
    }
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

  if (marketArg) await setMarket(marketArg);

  if (scenarioArg) {
    const ctx = buildContext();
    scenarioMode = true;
    try {
      const passed = await scenarioEngine.run(scenarioArg, ctx);
      process.exit(passed ? 0 : 1);
    } finally {
      scenarioMode = false;
    }
  }

  const headerLines = [
    bold('SOOTH V10 INTERACTIVE TEST CONSOLE'),
    `Chain: ${config.chainName} | Version: ${config.deployment.version}`,
    `RPC: ${config.rpc.length > 40 ? config.rpc.slice(0, 37) + '...' : config.rpc}`,
  ];
  if (currentMarketAddress) {
    headerLines.push(`Market: ${currentMarketName || shortAddress(currentMarketAddress)}`);
  }
  printBox(headerLines);

  console.log('');
  console.log(dim('  Type "help" for available commands\n'));

  // Non-interactive mode: read piped commands and execute sequentially.
  if (!process.stdin.isTTY) {
    const input = await new Promise<string>((resolve) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => {
        data += chunk;
      });
      process.stdin.on('end', () => resolve(data));
    });

    const lines = input.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    for (const line of lines) {
      await handleCommand(line);
    }
    return;
  }

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

#!/usr/bin/env bun
import * as readline from 'readline';
import { keccak256, encodePacked } from 'viem';
import { createConfig, SDK_VERSION, type InteractiveConfig } from './config';
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
} from './cli-utils';
import {
  type CommandContext,
  type CommandResult,
  type RecordingState,
  walletCommands,
  soothbookCommands,
  marketCommands,
} from './commands';
import { ScenarioEngine } from './scenarios/engine';
import { runAllInvariants, printInvariantResults } from './assertions';

// Parse CLI arguments
const args = process.argv.slice(2);

// --list: show available nodes and exit
if (args.includes('--list')) {
  const { getAllNodes, getChain } = await import('../../../registry/src/index');
  const nodes = getAllNodes();
  console.log(`\n  ${bold('Available Sooth Nodes')}\n`);
  console.log('  ID          Chain              Core');
  console.log('  ────────    ─────────────────  ────');
  for (const n of nodes) {
    const chain = getChain(n.chainId);
    console.log(`  ${n.id}    ${(chain?.name ?? `chain:${n.chainId}`).padEnd(17)}  ${n.coreVersion}`);
  }
  console.log('');
  process.exit(0);
}

// No args: show usage
const positionalArg = args.find(a => !a.startsWith('--'));
if (!positionalArg) {
  console.log(`\n  ${bold(`soothcli v${SDK_VERSION}`)}`);
  console.log(`\n  Usage: soothcli <nodeId> [--rpc=<url>] [--market=<addr>]`);
  console.log(`         soothcli --list\n`);
  process.exit(0);
}

if (args.find(a => a.startsWith('--chain='))) {
  console.log(error('  --chain is no longer supported. Use an 8-char node ID (run soothcli --list).'));
  process.exit(1);
}

const nodeIdArg = positionalArg;
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

interface DiscoveredMarket {
  address: `0x${string}`;
  name: string;
  isGraduated: boolean;
  stage: 'pre-graduation' | 'graduated';
  marketKey: `0x${string}` | null;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const LaunchpadDiscoveryAbi = [
  {
    name: 'getMarkets',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'address[]', name: '' }],
    stateMutability: 'view',
  },
  {
    name: 'getMarketCount',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256', name: '' }],
    stateMutability: 'view',
  },
  {
    name: 'allMarkets',
    type: 'function',
    inputs: [{ type: 'uint256', name: '' }],
    outputs: [{ type: 'address', name: '' }],
    stateMutability: 'view',
  },
  {
    name: 'markets',
    type: 'function',
    inputs: [{ type: 'address', name: 'market' }],
    outputs: [
      { type: 'address', name: 'creator' },
      { type: 'address', name: 'lpToken' },
      { type: 'uint256', name: 'bBase' },
      { type: 'uint256', name: 'creatorDeposit' },
      { type: 'uint64', name: 'graduatedAt' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'isGraduated',
    type: 'function',
    inputs: [{ type: 'address', name: 'market' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
] as const;

const TruthMarketQuestionAbi = [
  {
    name: 'question',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'string', name: '' }],
    stateMutability: 'view',
  },
] as const;

async function discoverMarketsOnChain(): Promise<DiscoveredMarket[]> {
  const publicClient = actorManager.getPublicClient();
  const launchpadAddress = config.deployment.contracts.LaunchpadEngine as `0x${string}`;

  let marketAddresses: `0x${string}`[] = [];
  try {
    marketAddresses = await publicClient.readContract({
      address: launchpadAddress,
      abi: LaunchpadDiscoveryAbi,
      functionName: 'getMarkets',
    }) as `0x${string}`[];
  } catch {
    const marketCount = await publicClient.readContract({
      address: launchpadAddress,
      abi: LaunchpadDiscoveryAbi,
      functionName: 'getMarketCount',
    }) as bigint;

    for (let i = 0; i < Number(marketCount); i++) {
      const marketAddress = await publicClient.readContract({
        address: launchpadAddress,
        abi: LaunchpadDiscoveryAbi,
        functionName: 'allMarkets',
        args: [BigInt(i)],
      }) as `0x${string}`;
      marketAddresses.push(marketAddress);
    }
  }

  const discovered = await Promise.all(
    marketAddresses.map(async (marketAddress): Promise<DiscoveredMarket | null> => {
      const [state, isGraduated] = await Promise.all([
        publicClient.readContract({
          address: launchpadAddress,
          abi: LaunchpadDiscoveryAbi,
          functionName: 'markets',
          args: [marketAddress],
        }) as Promise<[string, string, bigint, bigint, bigint]>,
        publicClient.readContract({
          address: launchpadAddress,
          abi: LaunchpadDiscoveryAbi,
          functionName: 'isGraduated',
          args: [marketAddress],
        }) as Promise<boolean>,
      ]);

      const creator = state[0];
      if (creator.toLowerCase() === ZERO_ADDRESS) {
        return null;
      }

      let marketName: string = marketAddress;
      try {
        const question = await publicClient.readContract({
          address: marketAddress,
          abi: TruthMarketQuestionAbi,
          functionName: 'question',
        }) as string;
        if (question && question.trim().length > 0) {
          marketName = question.trim();
        }
      } catch {}

      return {
        address: marketAddress,
        name: marketName,
        isGraduated,
        stage: isGraduated ? 'graduated' : 'pre-graduation',
        marketKey: isGraduated ? keccak256(encodePacked(['address'], [marketAddress])) : null,
      };
    }),
  );

  return discovered.filter((market): market is DiscoveredMarket => market !== null);
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
      const onChainMarkets = await discoverMarketsOnChain();
      if (onChainMarkets.length === 0) {
        console.log(error('  No markets available on-chain'));
        return false;
      }
      marketAddress = onChainMarkets[onChainMarkets.length - 1].address;
    } catch (err) {
      console.log(error(`  Failed to fetch latest market: ${(err as Error).message}`));
      return false;
    }
  } else if (/^\d+$/.test(addressOrIndex)) {
    const index = parseInt(addressOrIndex, 10);

    const soothBookMarkets = config.deployment.markets.filter(
      (m) => (m.marketKey || m.key) && (!m.address || m.address === '')
    );

    if (index < soothBookMarkets.length) {
      const sbMarket = soothBookMarkets[index];
      currentMarketKey = (sbMarket.marketKey || sbMarket.key) as `0x${string}`;
      currentMarketAddress = null;
      currentMarketName = sbMarket.name || null;
      console.log(success(`  Set SoothBook market: ${currentMarketName || currentMarketKey}`));
      console.log(dim(`  Key: ${currentMarketKey}`));
      return true;
    }

    const adjustedIndex = index - soothBookMarkets.length;
    try {
      const onChainMarkets = await discoverMarketsOnChain();
      if (adjustedIndex >= onChainMarkets.length) {
        const total = soothBookMarkets.length + onChainMarkets.length;
        console.log(error(`  Market index ${index} out of range (${total} markets available)`));
        return false;
      }
      marketAddress = onChainMarkets[adjustedIndex].address;
    } catch {
      if (adjustedIndex >= config.deployment.markets.length) {
        console.log(error(`  Market index ${index} out of range`));
        return false;
      }
      marketAddress = config.deployment.markets[adjustedIndex].address;
    }
  } else if (/^0x[a-fA-F0-9]{64}$/.test(addressOrIndex)) {
    currentMarketKey = addressOrIndex as `0x${string}`;
    currentMarketAddress = null;
    currentMarketName = null;
    console.log(success('  Market key set'));
    console.log(dim(`  Key: ${currentMarketKey}`));
    return true;
  } else if (isDirectAddress) {
    marketAddress = addressOrIndex;
  } else {
    const market = config.deployment.markets.find(
      m => m.name?.toLowerCase() === addressOrIndex.toLowerCase()
    );
    if (market) {
      marketAddress = market.address;
    } else {
      try {
        const discovered = await discoverMarketsOnChain();
        const matched = discovered.find(
          item => item.name.toLowerCase() === addressOrIndex.toLowerCase(),
        );
        if (!matched) {
          console.log(error(`  Market not found: ${addressOrIndex}`));
          return false;
        }
        marketAddress = matched.address;
      } catch {
        console.log(error(`  Market not found: ${addressOrIndex}`));
        return false;
      }
    }
  }

  const deployedMarket = config.deployment.markets.find(
    m => m.address.toLowerCase() === marketAddress.toLowerCase()
  );

  if (deployedMarket?.marketKey) {
    currentMarketKey = deployedMarket.marketKey as `0x${string}`;
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
        // Graduated market: compute SoothBook marketKey from address
        currentMarketKey = keccak256(encodePacked(['address'], [marketAddress as `0x${string}`]));
        currentMarketName = marketName;
      }
    } catch {}

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
        currentMarketKey = currentMarketKey || null;
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
    balance              Show USDC balances
    mint <amount>        Mint MockUSDC
    approve <contract>   Approve (launchpad, all)
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
    simulate [orders] [avg] [seed]  Simulate SoothBook order flow
    marketstatus             Show full market lifecycle status
    settle <outcome>         Settle market (adjudicator only)
                             outcome: yes, no, invalid
    finalize                 Finalize settled market (adjudicator only)
    redeem                   Redeem winning tokens for USDC (after settlement)
    redeemamm                Redeem AMM positions for USDC (after settlement)
    redeemlp [amount|max]    Redeem LP tokens for USDC + fees
    pnl [initial]            Show P&L summary (e.g., pnl 50000)
    transferlp <actor> <amt> Transfer LP tokens to another actor
                              Example: transferlp ellen 50
                              ${dim('LP tokens can only be transferred pre-settlement')}

    ${info('Trial Period (V11):')}
      trialstatus              Show trial period status and locked costs
      dismiss                  Dismiss market during trial (creator only)
      claimrefund              Claim refund after market dismissal

  ${info('Orderbook (SoothBook):')}
    ${dim('# Set market key with: setmarket <marketKey>')}

    ${info('Trading:')}
      buyyes <tick> <amount>      Buy YES shares at tick (USDC amount)
      buyno <tick> <amount>       Buy NO shares at tick
      mintset <amount>            Mint complete set (YES+NO)
      mergeset <amount>           Merge complete set back to USDC
      cancelorder <side> <tick>   Cancel oldest order at tick (yes/no)
      sbredeem                    Redeem winning tokens after resolution
      sbresolve <outcome>         Resolve market (owner only: yes/no/invalid)

    ${info('State:')}
      state                       Show SoothBook market state
      book [center] [window]      Show SoothBook orderbook
      positions [actor]           Show SoothBook positions (YES/NO balances)
      history [page] [size]       Show current actor order history (includes refund amt)
      markets                     Show current market & available markets
      setmarket <addr|key|index|latest|created>  Set current market
      sbcreate <name>             Create new SoothBook market

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
    rpc set <url>        Override RPC endpoint
    rpc reset            Reset RPC to registry default
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

      case 'state':
        await run(soothbookCommands.state(ctx, args));
        break;

      case 'book':
        await run(soothbookCommands.book(ctx, args));
        break;

      case 'positions':
        await run(soothbookCommands.positions(ctx, args));
        break;

      case 'history':
        await run(soothbookCommands.history(ctx, args));
        break;

      case 'markets':
      case 'm': {
        console.log('');
        console.log(`  ${bold('Markets')}`);
        console.log('  ' + '─'.repeat(72));
        if (currentMarketAddress || currentMarketKey) {
          console.log(`  Current Address: ${currentMarketAddress || '(none)'}`);
          console.log(`  Current Key:     ${currentMarketKey || '(none)'}`);
        } else {
          console.log(`  Current: ${warn('none')}`);
        }

        // Show SoothBook seed markets from deployment config
        const soothBookMarkets = config.deployment.markets.filter(
          (m) => (m.marketKey || m.key) && (!m.address || m.address === '')
        );
        if (soothBookMarkets.length > 0) {
          console.log('');
          console.log(`  ${bold('SoothBook Markets')} (from deployment config)`);
          soothBookMarkets.forEach((market, index) => {
            const label = market.name || `SoothBook Market ${index}`;
            const keyValue = market.marketKey || market.key || '(none)';
            console.log(`  [${index}] ${label}`);
            console.log(`      marketKey: ${keyValue}`);
          });
        }

        // Show Launchpad markets from on-chain discovery
        try {
          const discovered = await discoverMarketsOnChain();

          if (discovered.length > 0) {
            console.log('');
            console.log(`  ${bold('Launchpad Markets')} (on-chain)`);
            const offset = soothBookMarkets.length;
            discovered.forEach((market, index) => {
              const label = market.name.length > 70 ? `${market.name.slice(0, 67)}...` : market.name;
              console.log(`  [${offset + index}] ${label}`);
              console.log(`      address:   ${market.address}`);
              console.log(`      stage:     ${market.stage}`);
              console.log(`      graduated: ${market.isGraduated ? 'yes' : 'no'}`);
              console.log(`      marketKey: ${market.marketKey || '(not available pre-graduation)'}`);
            });
          } else if (soothBookMarkets.length === 0) {
            console.log('');
            console.log(`  ${warn('No markets found')}`);
          }
        } catch (err) {
          if (soothBookMarkets.length === 0) {
            console.log(error(`  Failed to discover on-chain markets: ${(err as Error).message}`));
          }
        }

        console.log('');
        break;
      }

      case 'setmarket':
        if (args.length < 1) {
          console.log(error('  Usage: setmarket <addr|key|index|latest|created>'));
        } else {
          await setMarket(args[0]);
        }
        break;

      case 'rpc': {
        if (args[0] === 'set' && args[1]) {
          config.rpc = args[1];
          actorManager.setRpc(args[1]);
          console.log(success(`  RPC updated: ${args[1]}`));
        } else if (args[0] === 'reset') {
          const original = createConfig(config.nodeId);
          config.rpc = original.rpc;
          actorManager.setRpc(original.rpc);
          console.log(success(`  RPC reset to registry default: ${original.rpc}`));
        } else {
          const publicClient = actorManager.getPublicClient();
          let block: bigint | null = null;
          let blockError: string | null = null;
          try {
            block = await publicClient.getBlockNumber();
          } catch (err) {
            blockError = (err as Error).message;
          }

          console.log('');
          console.log(`  Chain: ${config.chainName} (${config.chain.id})`);
          console.log(`  RPC:   ${config.rpc}`);
          if (block !== null) {
            console.log(`  Block: ${block.toString()}`);
          } else {
            console.log(warn('  Block: unavailable (RPC check failed)'));
            if (blockError) {
              const firstLine = blockError.split('\n')[0];
              console.log(dim(`  Reason: ${firstLine}`));
            }
          }
          console.log('');
        }
        break;
      }

      case 'call':
        console.log(warn('  call command is not available in this console'));
        break;

      // Market lifecycle commands
      case 'createmarket':
        {
          const res = await run(marketCommands.createmarket(ctx, args));
          const created = res.data?.marketAddress as string | undefined;
          if (res.success && created) {
            lastCreatedMarketAddress = created;
          }
        }
        break;

      case 'graduate':
        await run(marketCommands.graduate(ctx, args));
        break;

      case 'simulate':
        await run(marketCommands.simulate(ctx, args));
        break;

      case 'marketstatus':
        await run(marketCommands.marketstatus(ctx, args));
        break;

       case 'settle':
         await run(marketCommands.settle(ctx, args));
         break;

       case 'finalize':
         await run(marketCommands.finalize(ctx, args));
         break;

       case 'redeem':
        await run(marketCommands.redeem(ctx, args));
        break;

      case 'redeemamm':
        await run(marketCommands.redeemamm(ctx, args));
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

      case 'trialstatus':
        await run(marketCommands.trialstatus(ctx, args));
        break;

      case 'dismiss':
        await run(marketCommands.dismiss(ctx, args));
        break;

      case 'claimrefund':
        await run(marketCommands.claimrefund(ctx, args));
        break;

      case 'buyyes':
        await run(soothbookCommands.buyyes(ctx, args));
        break;

      case 'buyno':
        await run(soothbookCommands.buyno(ctx, args));
        break;

      case 'mintset':
        await run(soothbookCommands.mint(ctx, args));
        break;

      case 'mergeset':
        await run(soothbookCommands.merge(ctx, args));
        break;

      case 'cancelorder':
        await run(soothbookCommands.cancel(ctx, args));
        break;

      case 'sbredeem':
        await run(soothbookCommands.redeem(ctx, args));
        break;

      case 'sbresolve':
        await run(soothbookCommands.resolve(ctx, args));
        break;

      case 'sbcreate':
        await run(soothbookCommands.createmarket(ctx, args));
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
    config = createConfig(nodeIdArg);
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
    bold(`SOOTH SDK v${SDK_VERSION}`),
    `Node: ${config.nodeId} · ${config.chainName} · Core ${config.coreVersion}`,
    `RPC: ${config.rpc}`,
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

/**
 * Wallet Commands
 * mint, approve, balance, allowance, snapshot, checksum
 */

import type { CommandContext, CommandResult } from './types';
import { ABIS, MAX_UINT256 } from '../config';
import { formatWad, parseWad, shortAddress, shortTx, Spinner, success, error, warn, info, dim, bold, readContractWithRpcFallback } from '../cli-utils';
import { parseAbi } from 'viem';

// Additional ABIs for complete position tracking
const CollateralizerAbi = parseAbi([
  'function getBalances(address market, address user) view returns (uint256 yesBalance, uint256 noBalance)',
  'function isMarketRegistered(address market) view returns (bool)',
]);



const LaunchpadEngineAbi = parseAbi([
  'function markets(address) view returns (address creator, address lpToken, uint256 bBase, uint256 bCurrent, uint256 creatorDeposit, uint256 feesAccrued, uint256 totalLPSupply, uint256 lpYieldPool, bool isGraduated, uint64 createdAt, uint64 graduatedAt)',
  'function trialStates(address market) view returns (uint64 trialEndTime, bool isDismissed, uint256 totalLockedCost)',
  'function protocolTreasury() view returns (address)',
]);

const TruthMarketAbi = parseAbi([
  'function isSettled() view returns (bool)',
  'function winningOutcome() view returns (uint8)',
]);

const AMMEngineAbi = parseAbi([
  'function getPosition(address market, address user) view returns (uint256 yesShares, uint256 noShares)',
]);

const ERC20Abi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
]);

/**
 * Show balances for current actor
 */
export async function balance(ctx: CommandContext, _args: string[]): Promise<CommandResult> {
  const { actorManager, deployment } = ctx;
  const address = actorManager.currentAddress();
  const publicClient = actorManager.getPublicClient();

  if (!address) {
    return { success: false, message: 'No actor selected' };
  }

  const firstMarket = deployment.markets[0];
  const hasSoothBook = Boolean(deployment.contracts.SoothBook);
  const hasOutcomeTokens = Boolean(firstMarket?.yesToken && firstMarket?.noToken);

  if (hasSoothBook && hasOutcomeTokens) {
    const [walletBalance, yesBalance, noBalance] = await Promise.all([
      readContractWithRpcFallback<bigint>(
        ctx.config.chain,
        ctx.config.rpc,
        {
          address: deployment.contracts.MockUSDC as `0x${string}`,
          abi: ABIS.MockUSDC,
          functionName: 'balanceOf',
          args: [address],
        },
      ),
      readContractWithRpcFallback<bigint>(
        ctx.config.chain,
        ctx.config.rpc,
        {
          address: firstMarket.yesToken as `0x${string}`,
          abi: ABIS.OutcomeToken,
          functionName: 'balanceOf',
          args: [address],
        },
      ),
      readContractWithRpcFallback<bigint>(
        ctx.config.chain,
        ctx.config.rpc,
        {
          address: firstMarket.noToken as `0x${string}`,
          abi: ABIS.OutcomeToken,
          functionName: 'balanceOf',
          args: [address],
        },
      ),
    ]);

    console.log(`\n  ${bold('Balances')} for ${info(shortAddress(address))}`);
    console.log('  ' + '─'.repeat(40));
    console.log(`  Wallet USDC: ${formatWad(walletBalance)} USDC`);
    console.log(`  YES Token:   ${success(formatWad(yesBalance))} YES`);
    console.log(`  NO Token:    ${warn(formatWad(noBalance))} NO`);
    console.log('');

    return { success: true };
  }

  const walletBalance = await readContractWithRpcFallback<bigint>(
    ctx.config.chain,
    ctx.config.rpc,
    {
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'balanceOf',
      args: [address],
    },
  );

  console.log(`\n  ${bold('Balances')} for ${info(shortAddress(address))}`);
  console.log('  ' + '─'.repeat(40));
  console.log(`  Wallet USDC: ${formatWad(walletBalance)} USDC`);
  console.log('');

  return { success: true };
}

/**
 * Mint MockUSDC tokens
 */
export async function mint(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment } = ctx;
  const walletClient = actorManager.currentWalletClient();
  const address = actorManager.currentAddress();

  if (!walletClient || !address) {
    return { success: false, message: 'No actor selected' };
  }

  if (args.length < 1) {
    return { success: false, message: 'Usage: mint <amount>' };
  }

  const amount = parseWad(args[0]);
  const spinner = new Spinner(`Minting ${formatWad(amount)} USDC...`);
  spinner.start();

  try {
    const hash = await walletClient.writeContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'mint',
      args: [address, amount],
    });

    await actorManager.waitForTransactionReceipt(hash);
    spinner.succeed(`Minted ${formatWad(amount)} USDC ${dim(`(tx: ${shortTx(hash)})`)}`);

    return { success: true, txHash: hash };
  } catch (err) {
    spinner.fail(`Mint failed: ${(err as Error).message.slice(0, 50)}`);
    return { success: false, message: (err as Error).message };
  }
}

/**
 * Approve a contract to spend USDC
 */
export async function approve(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment } = ctx;
  const walletClient = actorManager.currentWalletClient();

  if (!walletClient) {
    return { success: false, message: 'No actor selected' };
  }

  if (args.length < 1) {
    return { success: false, message: 'Usage: approve <contract> [amount]\n  Contracts: vault, launchpad, all' };
  }

  const contractArg = args[0].toLowerCase();
  const amount = args[1] ? parseWad(args[1]) : MAX_UINT256;

  const contractMap: Record<string, string> = {
    launchpad: deployment.contracts.LaunchpadEngine,
    launchpadengine: deployment.contracts.LaunchpadEngine,
  };

  if (deployment.contracts.SoothBook) {
    contractMap.soothbook = deployment.contracts.SoothBook;
  }

  const approveContract = async (name: string, address: string) => {
    const spinner = new Spinner(`Approving ${name}...`);
    spinner.start();

    try {
      const hash = await walletClient.writeContract({
        address: deployment.contracts.MockUSDC as `0x${string}`,
        abi: ABIS.MockUSDC,
        functionName: 'approve',
        args: [address as `0x${string}`, amount],
      });

      await actorManager.waitForTransactionReceipt(hash);
      const amountStr = amount === MAX_UINT256 ? 'unlimited' : formatWad(amount);
      spinner.succeed(`Approved ${name} for ${amountStr} USDC`);
      return true;
    } catch (err) {
      spinner.fail(`Failed to approve ${name}: ${(err as Error).message.slice(0, 40)}`);
      return false;
    }
  };

  if (contractArg === 'all') {
    let allSuccess = true;
    for (const [name, addr] of Object.entries(contractMap)) {
      if (name !== 'launchpadengine') {
        const ok = await approveContract(name, addr);
        allSuccess = allSuccess && ok;
      }
    }
    return { success: allSuccess };
  }

  const contractAddress = contractMap[contractArg];
  if (!contractAddress) {
    return { success: false, message: `Unknown contract: ${contractArg}. Use: launchpad, soothbook, or all` };
  }

  const ok = await approveContract(contractArg, contractAddress);
  return { success: ok };
}

/**
 * Check allowance for a contract
 */
export async function allowance(ctx: CommandContext, _args: string[]): Promise<CommandResult> {
  const { actorManager, deployment } = ctx;
  const address = actorManager.currentAddress();
  const publicClient = actorManager.getPublicClient();

  if (!address) {
    return { success: false, message: 'No actor selected' };
  }

  const contracts = [
    { name: 'Launchpad', address: deployment.contracts.LaunchpadEngine },
  ];

  if (deployment.contracts.SoothBook) {
    contracts.push({ name: 'SoothBook', address: deployment.contracts.SoothBook });
  }

  console.log(`\n  ${bold('Allowances')} for ${info(shortAddress(address))}`);
  console.log('  ' + '─'.repeat(40));

  for (const contract of contracts) {
    const allowanceValue = await publicClient.readContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'allowance',
      args: [address, contract.address as `0x${string}`],
    }) as bigint;

    const displayValue = allowanceValue >= MAX_UINT256 / 2n
      ? success('unlimited')
      : formatWad(allowanceValue) + ' USDC';

    console.log(`  ${contract.name.padEnd(12)}: ${displayValue}`);
  }
  console.log('');

  return { success: true };
}

let balanceSnapshot: BalanceSnapshot | null = null;

export interface ActorPositions {
  wallet: bigint;
  erc20Yes: bigint;
  erc20No: bigint;
  ammYes: bigint;
  ammNo: bigint;
  lpTokens: bigint;
  name: string;
}

export interface MarketState {
  address: string;
  creatorDeposit: bigint;
  feesAccrued: bigint;
  totalLPSupply: bigint;
  lpTokenAddress: string;
  lpYieldPool: bigint;
  isSettled: boolean;
  winningOutcome: number; // 0=NO, 1=YES, 2=INVALID, -1=not settled
  isGraduated: boolean;
  isDismissed: boolean;
}

export interface BalanceSnapshot {
  timestamp: number;
  actors: Record<string, ActorPositions>;
  contracts: {
    launchpadEngine: bigint;
    collateralizer: bigint;
    ammEngine: bigint;
    protocolTreasury: bigint;
  };
  protocolTreasuryAddress: string | null;
  totalMinted: bigint;
  market: MarketState | null;
}

export async function snapshot(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketAddress: ctxMarketAddress } = ctx;
  const publicClient = actorManager.getPublicClient();
  const actors = actorManager.listActors();

  const mode = args[0]?.toLowerCase();

  if (mode === 'clear') {
    balanceSnapshot = null;
    console.log(success('  Snapshot cleared'));
    return { success: true };
  }

  if (mode === 'show') {
    if (!balanceSnapshot) {
      console.log(error('  No snapshot stored. Run: snapshot'));
      return { success: false, message: 'No snapshot' };
    }
    printSnapshot(balanceSnapshot, 'Stored Snapshot');
    return { success: true };
  }

  console.log(dim('  Taking comprehensive balance snapshot...'));

  const marketAddress = ctxMarketAddress ?? undefined;
  
  const snap: BalanceSnapshot = {
    timestamp: Date.now(),
    actors: {},
    contracts: {
      launchpadEngine: 0n,
      collateralizer: 0n,
      ammEngine: 0n,
      protocolTreasury: 0n,
    },
    protocolTreasuryAddress: null,
    totalMinted: 0n,
    market: null,
  };

  if (marketAddress) {
    try {
      const [marketState, isSettled, trialState] = await Promise.all([
        publicClient.readContract({
          address: deployment.contracts.LaunchpadEngine as `0x${string}`,
          abi: LaunchpadEngineAbi,
          functionName: 'markets',
          args: [marketAddress],
        }) as Promise<[string, string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, bigint, bigint]>,
        publicClient.readContract({
          address: marketAddress,
          abi: TruthMarketAbi,
          functionName: 'isSettled',
        }).catch(() => false) as Promise<boolean>,
        publicClient.readContract({
          address: deployment.contracts.LaunchpadEngine as `0x${string}`,
          abi: LaunchpadEngineAbi,
          functionName: 'trialStates',
          args: [marketAddress],
        }).catch(() => [0n, false, 0n]) as Promise<readonly [bigint, boolean, bigint]>,
      ]);

      const [, lpTokenAddress, , , creatorDeposit, feesAccrued, totalLPSupply, lpYieldPool, isGraduated] = marketState;
      const [, isDismissed] = trialState;

      let winningOutcome = -1;
      if (isSettled) {
        winningOutcome = await publicClient.readContract({
          address: marketAddress,
          abi: TruthMarketAbi,
          functionName: 'winningOutcome',
        }) as number;
      }

      snap.market = {
        address: marketAddress,
        creatorDeposit,
        feesAccrued,
        totalLPSupply,
        lpTokenAddress,
        lpYieldPool,
        isSettled,
        winningOutcome,
        isGraduated,
        isDismissed,
      };
    } catch (e) {
      console.log(dim('  Could not fetch market state'));
    }
  }

  for (const actor of actors) {
    const actorAddr = actor.account.address;
    
    const wallet = await publicClient.readContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'balanceOf',
      args: [actorAddr],
    }) as Promise<bigint>;

    let erc20Yes = 0n;
    let erc20No = 0n;
    let ammYes = 0n;
    let ammNo = 0n;
    let lpTokens = 0n;

    if (marketAddress) {
      try {
        [erc20Yes, erc20No] = await publicClient.readContract({
          address: deployment.contracts.Collateralizer as `0x${string}`,
          abi: CollateralizerAbi,
          functionName: 'getBalances',
          args: [marketAddress, actorAddr],
        }) as [bigint, bigint];
      } catch {}

      try {
        [ammYes, ammNo] = await publicClient.readContract({
          address: deployment.contracts.AMMEngine as `0x${string}`,
          abi: AMMEngineAbi,
          functionName: 'getPosition',
          args: [marketAddress, actorAddr],
        }) as [bigint, bigint];
      } catch {}

      if (snap.market?.lpTokenAddress && snap.market.lpTokenAddress !== '0x0000000000000000000000000000000000000000') {
        try {
          lpTokens = await publicClient.readContract({
            address: snap.market.lpTokenAddress as `0x${string}`,
            abi: ERC20Abi,
            functionName: 'balanceOf',
            args: [actorAddr],
          }) as bigint;
        } catch {}
      }
    }

    snap.actors[actorAddr] = {
      wallet,
      erc20Yes,
      erc20No,
      ammYes,
      ammNo,
      lpTokens,
      name: actor.name,
    };
  }

  const protocolTreasuryAddr = await publicClient.readContract({
    address: deployment.contracts.LaunchpadEngine as `0x${string}`,
    abi: LaunchpadEngineAbi,
    functionName: 'protocolTreasury',
  }) as `0x${string}`;

  const [launchpadBal, collateralizerBal, ammEngineBal, treasuryBal] = await Promise.all([
    publicClient.readContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'balanceOf',
      args: [deployment.contracts.LaunchpadEngine as `0x${string}`],
    }) as Promise<bigint>,
    publicClient.readContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'balanceOf',
      args: [deployment.contracts.Collateralizer as `0x${string}`],
    }) as Promise<bigint>,
    publicClient.readContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'balanceOf',
      args: [deployment.contracts.AMMEngine as `0x${string}`],
    }) as Promise<bigint>,
    publicClient.readContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'balanceOf',
      args: [protocolTreasuryAddr],
    }) as Promise<bigint>,
  ]);

  snap.contracts = {
    launchpadEngine: launchpadBal,
    collateralizer: collateralizerBal,
    ammEngine: ammEngineBal,
    protocolTreasury: treasuryBal,
  };
  snap.protocolTreasuryAddress = protocolTreasuryAddr;

  snap.totalMinted = await publicClient.readContract({
    address: deployment.contracts.MockUSDC as `0x${string}`,
    abi: ABIS.MockUSDC,
    functionName: 'totalSupply',
  }) as bigint;

  balanceSnapshot = snap;

  printSnapshot(snap, 'Balance Snapshot');
  console.log(success('  Snapshot stored. Run checksum after scenario to verify zero-sum.'));

  return { success: true, data: { snapshot: snap } };
}

function calculateActorTotalValue(data: ActorPositions, market: MarketState | null, excludeAmm: boolean = false): bigint {
  const liquidUsdc = data.wallet;
  
  if (!market) {
    return liquidUsdc;
  }

  const totalYes = excludeAmm 
    ? data.erc20Yes 
    : data.erc20Yes + data.ammYes;
  const totalNo = excludeAmm 
    ? data.erc20No 
    : data.erc20No + data.ammNo;
  
  let yesValue = 0n;
  let noValue = 0n;
  let lpValue = 0n;
  
  if (market.isDismissed) {
    yesValue = 0n;
    noValue = 0n;
    lpValue = 0n;
  } else if (market.isSettled) {
    if (market.winningOutcome === 1) {
      yesValue = totalYes;
    } else if (market.winningOutcome === 0) {
      noValue = totalNo;
    } else {
      yesValue = totalYes / 2n;
      noValue = totalNo / 2n;
    }
    if (data.lpTokens > 0n && market.totalLPSupply > 0n) {
      const poolValue = market.creatorDeposit + market.feesAccrued;
      lpValue = (poolValue * data.lpTokens) / market.totalLPSupply;
    }
  } else {
    yesValue = totalYes / 2n;
    noValue = totalNo / 2n;
    if (data.lpTokens > 0n && market.totalLPSupply > 0n) {
      const poolValue = market.creatorDeposit + market.feesAccrued;
      lpValue = (poolValue * data.lpTokens) / market.totalLPSupply;
    }
  }
  
  return liquidUsdc + yesValue + noValue + lpValue;
}

function printSnapshot(snap: BalanceSnapshot, title: string): void {
  console.log(`\n  ${bold(title)} ${dim(`(${new Date(snap.timestamp).toLocaleTimeString()})`)}`);
  console.log('  ' + '─'.repeat(60));

  if (snap.market) {
    const m = snap.market;
    const settlementStatus = m.isSettled 
      ? `settled: ${['NO', 'YES', 'INVALID'][m.winningOutcome]}` 
      : 'live';
    console.log(`\n  ${info('Market:')} ${dim(m.address.slice(0, 10))}... ${dim(`(${settlementStatus})`)}`);
    console.log(`    Pool: ${formatWad(m.creatorDeposit + m.feesAccrued)} USDC ${dim(`(deposit: ${formatWad(m.creatorDeposit)}, fees: ${formatWad(m.feesAccrued)})`)}`);
  }

  console.log(`\n  ${info('Actor Positions:')}`);
  let totalActorValue = 0n;
  
  for (const [, data] of Object.entries(snap.actors)) {
    const totalValue = calculateActorTotalValue(data, snap.market);
    totalActorValue += totalValue;
    
    const parts: string[] = [];
    if (data.wallet > 0n) parts.push(`w:${formatWad(data.wallet)}`);
    
    if (snap.market) {
      const totalYes = data.erc20Yes + data.ammYes;
      const totalNo = data.erc20No + data.ammNo;
      if (totalYes > 0n) parts.push(`Y:${formatWad(totalYes)}`);
      if (totalNo > 0n) parts.push(`N:${formatWad(totalNo)}`);
      if (data.ammYes > 0n || data.ammNo > 0n) parts.push(`amm:${formatWad(data.ammYes)}/${formatWad(data.ammNo)}`);
      if (data.lpTokens > 0n) parts.push(`LP:${formatWad(data.lpTokens)}`);
    }
    
    console.log(`    ${data.name.padEnd(10)} ${formatWad(totalValue).padStart(12)} USDC ${dim(`(${parts.join(', ')})`)}`);
  }
  console.log(`    ${'─'.repeat(50)}`);
  console.log(`    ${'Total'.padEnd(10)} ${formatWad(totalActorValue).padStart(12)} USDC`);

  console.log(`\n  ${info('Contract Balances:')}`);
  console.log(`    LaunchpadEngine  ${formatWad(snap.contracts.launchpadEngine).padStart(12)} USDC`);
  console.log(`    AMMEngine        ${formatWad(snap.contracts.ammEngine).padStart(12)} USDC`);
  console.log(`    Collateralizer   ${formatWad(snap.contracts.collateralizer).padStart(12)} USDC`);
  console.log(`    ProtocolTreasury ${formatWad(snap.contracts.protocolTreasury).padStart(12)} USDC`);

  console.log(`\n  ${info('Summary:')}`);
  console.log(`    Total Minted:   ${formatWad(snap.totalMinted).padStart(12)} USDC`);
  console.log('');
}

export async function checksum(ctx: CommandContext, _args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketAddress: ctxMarketAddress } = ctx;
  const publicClient = actorManager.getPublicClient();
  const actors = actorManager.listActors();

  if (!balanceSnapshot) {
    console.log(error('  No snapshot stored. Run: snapshot'));
    console.log(dim('  Usage: snapshot → run scenario → checksum'));
    return { success: false, message: 'No snapshot' };
  }

  const before = balanceSnapshot;
  const marketAddress = ctxMarketAddress ?? undefined;

  const after: BalanceSnapshot = {
    timestamp: Date.now(),
    actors: {},
    contracts: {
      launchpadEngine: 0n,
      collateralizer: 0n,
      ammEngine: 0n,
      protocolTreasury: 0n,
    },
    protocolTreasuryAddress: before.protocolTreasuryAddress,
    totalMinted: 0n,
    market: null,
  };

  if (marketAddress) {
    try {
      const [marketState, isSettled, trialState] = await Promise.all([
        publicClient.readContract({
          address: deployment.contracts.LaunchpadEngine as `0x${string}`,
          abi: LaunchpadEngineAbi,
          functionName: 'markets',
          args: [marketAddress],
        }) as Promise<[string, string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, bigint, bigint]>,
        publicClient.readContract({
          address: marketAddress,
          abi: TruthMarketAbi,
          functionName: 'isSettled',
        }).catch(() => false) as Promise<boolean>,
        publicClient.readContract({
          address: deployment.contracts.LaunchpadEngine as `0x${string}`,
          abi: LaunchpadEngineAbi,
          functionName: 'trialStates',
          args: [marketAddress],
        }).catch(() => [0n, false, 0n]) as Promise<readonly [bigint, boolean, bigint]>,
      ]);

      const [, lpTokenAddress, , , creatorDeposit, feesAccrued, totalLPSupply, lpYieldPool, isGraduated] = marketState;
      const [, isDismissed] = trialState;

      let winningOutcome = -1;
      if (isSettled) {
        winningOutcome = await publicClient.readContract({
          address: marketAddress,
          abi: TruthMarketAbi,
          functionName: 'winningOutcome',
        }) as number;
      }

      after.market = {
        address: marketAddress,
        creatorDeposit,
        feesAccrued,
        totalLPSupply,
        lpTokenAddress,
        lpYieldPool,
        isSettled,
        winningOutcome,
        isGraduated,
        isDismissed,
      };
    } catch {}
  }

  for (const actor of actors) {
    const actorAddr = actor.account.address;
    
    const wallet = await publicClient.readContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'balanceOf',
      args: [actorAddr],
    }) as Promise<bigint>;

    let erc20Yes = 0n;
    let erc20No = 0n;
    let ammYes = 0n;
    let ammNo = 0n;
    let lpTokens = 0n;

    if (marketAddress) {
      try {
        [erc20Yes, erc20No] = await publicClient.readContract({
          address: deployment.contracts.Collateralizer as `0x${string}`,
          abi: CollateralizerAbi,
          functionName: 'getBalances',
          args: [marketAddress, actorAddr],
        }) as [bigint, bigint];
      } catch {}

      try {
        [ammYes, ammNo] = await publicClient.readContract({
          address: deployment.contracts.AMMEngine as `0x${string}`,
          abi: AMMEngineAbi,
          functionName: 'getPosition',
          args: [marketAddress, actorAddr],
        }) as [bigint, bigint];
      } catch {}

      if (after.market?.lpTokenAddress && after.market.lpTokenAddress !== '0x0000000000000000000000000000000000000000') {
        try {
          lpTokens = await publicClient.readContract({
            address: after.market.lpTokenAddress as `0x${string}`,
            abi: ERC20Abi,
            functionName: 'balanceOf',
            args: [actorAddr],
          }) as bigint;
        } catch {}
      }
    }

    after.actors[actorAddr] = {
      wallet,
      erc20Yes,
      erc20No,
      ammYes,
      ammNo,
      lpTokens,
      name: actor.name,
    };
  }

  const treasuryAddr = before.protocolTreasuryAddress as `0x${string}` | null;
  
  const [launchpadBal, collateralizerBal, ammEngineBal, treasuryBal] = await Promise.all([
    publicClient.readContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'balanceOf',
      args: [deployment.contracts.LaunchpadEngine as `0x${string}`],
    }) as Promise<bigint>,
    publicClient.readContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'balanceOf',
      args: [deployment.contracts.Collateralizer as `0x${string}`],
    }) as Promise<bigint>,
    publicClient.readContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'balanceOf',
      args: [deployment.contracts.AMMEngine as `0x${string}`],
    }) as Promise<bigint>,
    treasuryAddr ? publicClient.readContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'balanceOf',
      args: [treasuryAddr],
    }) as Promise<bigint> : Promise.resolve(0n),
  ]);

  after.contracts = {
    launchpadEngine: launchpadBal,
    collateralizer: collateralizerBal,
    ammEngine: ammEngineBal,
    protocolTreasury: treasuryBal,
  };

  after.totalMinted = await publicClient.readContract({
    address: deployment.contracts.MockUSDC as `0x${string}`,
    abi: ABIS.MockUSDC,
    functionName: 'totalSupply',
  }) as bigint;

  console.log(`\n  ${bold('Zero-Sum USDC Verification')}`);
  console.log('  ' + '═'.repeat(70));

  const mintedDelta = after.totalMinted - before.totalMinted;
  console.log(`\n  ${info('New USDC Minted:')} ${formatWad(mintedDelta)} USDC`);

  if (after.market) {
    const m = after.market;
    const settlementStatus = m.isDismissed
      ? 'dismissed (trial period)'
      : m.isSettled 
        ? `settled: ${['NO', 'YES', 'INVALID'][m.winningOutcome]}` 
        : 'live';
    console.log(`  ${info('Market Status:')} ${settlementStatus}`);
  }

  console.log(`\n  ${info('Actor USDC (wallet + vault):')}`);
  console.log('  ' + '─'.repeat(70));

  let totalActorUsdcBefore = 0n;
  let totalActorUsdcAfter = 0n;
  const actorDeltas: { name: string; delta: bigint; breakdown: string }[] = [];
  
  let totalUnredeemedYes = 0n;
  let totalUnredeemedNo = 0n;
  let totalUnredeemedLp = 0n;
  const unredeemedActors: string[] = [];

  for (const [addr, afterData] of Object.entries(after.actors)) {
    const beforeData = before.actors[addr];
    if (!beforeData) continue;

    const beforeUsdc = beforeData.wallet;
    const afterUsdc = afterData.wallet;
    const delta = afterUsdc - beforeUsdc;
    
    totalActorUsdcBefore += beforeUsdc;
    totalActorUsdcAfter += afterUsdc;

    const actorYesTokens = afterData.erc20Yes + afterData.ammYes;
    const actorNoTokens = afterData.erc20No + afterData.ammNo;
    const actorLpTokens = afterData.lpTokens;
    
    if (actorYesTokens > 0n || actorNoTokens > 0n || actorLpTokens > 0n) {
      totalUnredeemedYes += actorYesTokens;
      totalUnredeemedNo += actorNoTokens;
      totalUnredeemedLp += actorLpTokens;
      unredeemedActors.push(afterData.name);
    }

    const sign = delta >= 0n ? '+' : '';
    const color = delta >= 0n ? success : error;
    console.log(`    ${afterData.name.padEnd(10)} ${color(`${sign}${formatWad(delta)}`.padStart(15))} USDC`);
    
    actorDeltas.push({ name: afterData.name, delta, breakdown: `usdc:${sign}${formatWad(delta)}` });
  }
  
  console.log('  ' + '─'.repeat(70));
  const totalActorDelta = totalActorUsdcAfter - totalActorUsdcBefore;
  const actorSign = totalActorDelta >= 0n ? '+' : '';
  console.log(`    ${'Actors Σ'.padEnd(10)} ${(actorSign + formatWad(totalActorDelta)).padStart(15)} USDC`);

  console.log(`\n  ${info('Protocol USDC:')}`);
  console.log('  ' + '─'.repeat(70));

  const launchpadDelta = after.contracts.launchpadEngine - before.contracts.launchpadEngine;
  const collateralizerDelta = after.contracts.collateralizer - before.contracts.collateralizer;
  const ammEngineDelta = after.contracts.ammEngine - before.contracts.ammEngine;
  const treasuryDelta = after.contracts.protocolTreasury - before.contracts.protocolTreasury;
  
  const actorAddresses = new Set(Object.keys(after.actors).map(a => a.toLowerCase()));
  const treasuryIsActor = before.protocolTreasuryAddress && actorAddresses.has(before.protocolTreasuryAddress.toLowerCase());
  const effectiveTreasuryDelta = treasuryIsActor ? 0n : treasuryDelta;
  
  const totalContractDelta = launchpadDelta + collateralizerDelta + ammEngineDelta + effectiveTreasuryDelta;

  const printDelta = (name: string, delta: bigint, note?: string) => {
    const sign = delta >= 0n ? '+' : '';
    const color = delta >= 0n ? success : error;
    const suffix = note ? ` ${dim(note)}` : '';
    console.log(`    ${name.padEnd(18)} ${color(`${sign}${formatWad(delta)}`.padStart(12))} USDC${suffix}`);
  };

  printDelta('LaunchpadEngine', launchpadDelta);
  printDelta('AMMEngine', ammEngineDelta);
  printDelta('Collateralizer', collateralizerDelta);
  if (treasuryIsActor) {
    console.log(`    ${dim('ProtocolTreasury'.padEnd(18))} ${dim(`${treasuryDelta >= 0n ? '+' : ''}${formatWad(treasuryDelta)}`.padStart(12))} ${dim('USDC (= actor, not counted)')}`);
  } else {
    printDelta('ProtocolTreasury', treasuryDelta);
  }
  
  console.log('  ' + '─'.repeat(70));
  const contractSign = totalContractDelta >= 0n ? '+' : '';
  console.log(`    ${'Protocol Σ'.padEnd(18)} ${(contractSign + formatWad(totalContractDelta)).padStart(12)} USDC`);

  if (totalUnredeemedYes > 0n || totalUnredeemedNo > 0n || totalUnredeemedLp > 0n) {
    console.log(`\n  ${warn('Unredeemed Positions:')}`);
    if (totalUnredeemedYes > 0n) console.log(`    YES tokens: ${formatWad(totalUnredeemedYes)}`);
    if (totalUnredeemedNo > 0n) console.log(`    NO tokens:  ${formatWad(totalUnredeemedNo)}`);
    if (totalUnredeemedLp > 0n) console.log(`    LP tokens:  ${formatWad(totalUnredeemedLp)}`);
    console.log(dim(`    Actors: ${unredeemedActors.join(', ')}`));
    console.log(dim('    Run: redeem, redeemamm, redeemlp max'));
  }

  if ((after.market?.lpYieldPool ?? 0n) > 0n) {
    console.log(`\n  ${warn('Potential Stuck USDC:')}`);
    console.log(`    lpYieldPool:            ${formatWad(after.market!.lpYieldPool)} USDC`);
    console.log(dim('      → Unclaimed LP yield. Run: claimlpyield'));
  }

  console.log(`\n  ${bold('Zero-Sum Equation:')}`);
  console.log('  ' + '═'.repeat(70));
  console.log(`    Actor USDC Δ:      ${(actorSign + formatWad(totalActorDelta)).padStart(15)} USDC`);
  console.log(`    Protocol USDC Δ:   ${(contractSign + formatWad(totalContractDelta)).padStart(15)} USDC`);
  console.log(`    ─────────────────────────────────────────────────`);
  
  const totalAccountedDelta = totalActorDelta + totalContractDelta;
  console.log(`    Total Accounted:   ${((totalAccountedDelta >= 0n ? '+' : '') + formatWad(totalAccountedDelta)).padStart(15)} USDC`);
  console.log(`    USDC Minted:       ${((mintedDelta >= 0n ? '+' : '') + formatWad(mintedDelta)).padStart(15)} USDC`);
  console.log(`    ─────────────────────────────────────────────────`);

  const checksumValue = totalAccountedDelta - mintedDelta;
  const checksumPass = checksumValue === 0n;
  
  if (checksumPass) {
    console.log(`    ${success('✓ CHECKSUM:')}          ${bold('0.00')} USDC ${success('(EXACT BALANCE)')}`);
  } else {
    console.log(`    ${error('✗ CHECKSUM:')}          ${error(formatWad(checksumValue))} USDC ${error('(IMBALANCED)')}`);
    console.log(`\n  ${error('USDC LEAK DETECTED!')}`);
    console.log(dim('  Possible causes:'));
    console.log(dim('    - Unredeemed positions (see above)'));
    console.log(dim('    - Stuck USDC in contracts (see above)'));
    console.log(dim('    - USDC in untracked address'));
    console.log(dim('    - Protocol bug: money creation/destruction'));
  }

  console.log('');

  return { 
    success: checksumPass, 
    data: { 
      checksumPass,
      mintedDelta,
      totalActorDelta,
      totalContractDelta,
      checksum: checksumValue,
      actorDeltas,
      unredeemed: {
        yes: totalUnredeemedYes,
        no: totalUnredeemedNo,
        lp: totalUnredeemedLp,
        actors: unredeemedActors,
      },
    } 
  };
}

/**
 * Get the current snapshot (for external access)
 */
export function getBalanceSnapshot(): BalanceSnapshot | null {
  return balanceSnapshot;
}

/**
 * Set the balance snapshot (for testing)
 */
export function setBalanceSnapshot(snap: BalanceSnapshot | null): void {
  balanceSnapshot = snap;
}

export const walletCommands = {
  balance,
  mint,
  approve,
  allowance,
  snapshot,
  checksum,
};

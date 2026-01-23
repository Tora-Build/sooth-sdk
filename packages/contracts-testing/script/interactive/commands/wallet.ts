/**
 * Wallet Commands
 * mint, approve, balance, allowance, snapshot, checksum
 */

import type { CommandContext, CommandResult } from './types';
import { ABIS, WAD, MAX_UINT256 } from '../config';
import { formatWad, parseWad, shortAddress, shortTx, Spinner, success, error, warn, info, dim, bold, readContractWithRpcFallback } from '../utils';
import { parseAbi } from 'viem';

// Additional ABIs for complete position tracking
const CollateralizerAbi = parseAbi([
  'function getBalances(address market, address user) view returns (uint256 yesBalance, uint256 noBalance)',
  'function isMarketRegistered(address market) view returns (bool)',
]);

const TickBookVaultAbi = parseAbi([
  'function getInternalOutcomes(address market, address user) view returns (uint256 yesShares, uint256 noShares)',
]);

const LaunchpadEngineAbi = parseAbi([
  'function markets(address) view returns (address creator, address lpToken, uint256 bBase, uint256 bCurrent, uint256 creatorDeposit, uint256 feesAccrued, uint256 totalLPSupply, uint256 lpYieldPool, bool isGraduated, uint64 createdAt, uint64 graduatedAt)',
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
export async function balance(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment } = ctx;
  const address = actorManager.currentAddress();
  const publicClient = actorManager.getPublicClient();

  if (!address) {
    return { success: false, message: 'No actor selected' };
  }

  // Fetch all balances in parallel
  const [walletBalance, vaultAvailable, vaultReserved] = await Promise.all([
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
    publicClient.readContract({
      address: deployment.contracts.TickBookVault as `0x${string}`,
      abi: ABIS.TickBookVault,
      functionName: 'availableUsdcWad',
      args: [address],
    }),
    publicClient.readContract({
      address: deployment.contracts.TickBookVault as `0x${string}`,
      abi: ABIS.TickBookVault,
      functionName: 'reservedUsdcWad',
      args: [address],
    }),
  ]);

  console.log(`\n  ${bold('Balances')} for ${info(shortAddress(address))}`);
  console.log('  ' + '─'.repeat(40));
  console.log(`  Wallet USDC:     ${formatWad(walletBalance as bigint)} USDC`);
  console.log(`  Vault Available: ${success(formatWad(vaultAvailable as bigint))} USDC`);
  console.log(`  Vault Reserved:  ${dim(formatWad(vaultReserved as bigint))} USDC`);
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
  const publicClient = actorManager.getPublicClient();

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
  const publicClient = actorManager.getPublicClient();

  if (!walletClient) {
    return { success: false, message: 'No actor selected' };
  }

  if (args.length < 1) {
    return { success: false, message: 'Usage: approve <contract> [amount]\n  Contracts: vault, launchpad, all' };
  }

  const contractArg = args[0].toLowerCase();
  const amount = args[1] ? parseWad(args[1]) : MAX_UINT256;

  // Map contract names to addresses
  // Note: PoolManager doesn't need direct USDC allowance - it uses Vault's internal accounting
  const contractMap: Record<string, string> = {
    vault: deployment.contracts.TickBookVault,
    tickbookvault: deployment.contracts.TickBookVault,
    launchpad: deployment.contracts.LaunchpadEngine,
    launchpadengine: deployment.contracts.LaunchpadEngine,
  };

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
      if (name !== 'tickbookvault' && name !== 'launchpadengine') {
        const ok = await approveContract(name, addr);
        allSuccess = allSuccess && ok;
      }
    }
    return { success: allSuccess };
  }

  const contractAddress = contractMap[contractArg];
  if (!contractAddress) {
    return { success: false, message: `Unknown contract: ${contractArg}. Use: vault, launchpad, or all` };
  }

  const ok = await approveContract(contractArg, contractAddress);
  return { success: ok };
}

/**
 * Check allowance for a contract
 */
export async function allowance(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment } = ctx;
  const address = actorManager.currentAddress();
  const publicClient = actorManager.getPublicClient();

  if (!address) {
    return { success: false, message: 'No actor selected' };
  }

  // Note: PoolManager doesn't need direct USDC allowance - it uses Vault's internal accounting
  const contracts = [
    { name: 'Vault', address: deployment.contracts.TickBookVault },
    { name: 'Launchpad', address: deployment.contracts.LaunchpadEngine },
  ];

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
  vault: bigint;
  internalYes: bigint;
  internalNo: bigint;
  erc20Yes: bigint;
  erc20No: bigint;
  ammYes: bigint;      // AMM positions (pre-graduation trades)
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
  isSettled: boolean;
  winningOutcome: number; // 0=NO, 1=YES, 2=INVALID, -1=not settled
  isGraduated: boolean;
}

export interface BalanceSnapshot {
  timestamp: number;
  actors: Record<string, ActorPositions>;
  contracts: {
    launchpadEngine: bigint;
    tickBookVault: bigint;
    collateralizer: bigint;
    ammEngine: bigint;
  };
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
      tickBookVault: 0n,
      collateralizer: 0n,
      ammEngine: 0n,
    },
    totalMinted: 0n,
    market: null,
  };

  if (marketAddress) {
    try {
      const [marketState, isSettled] = await Promise.all([
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
      ]);

      const [, lpTokenAddress, , , creatorDeposit, feesAccrued, totalLPSupply, , isGraduated] = marketState;

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
        isSettled,
        winningOutcome,
        isGraduated,
      };
    } catch (e) {
      console.log(dim('  Could not fetch market state'));
    }
  }

  for (const actor of actors) {
    const actorAddr = actor.account.address;
    
    const [wallet, available, reserved] = await Promise.all([
      publicClient.readContract({
        address: deployment.contracts.MockUSDC as `0x${string}`,
        abi: ABIS.MockUSDC,
        functionName: 'balanceOf',
        args: [actorAddr],
      }) as Promise<bigint>,
      publicClient.readContract({
        address: deployment.contracts.TickBookVault as `0x${string}`,
        abi: ABIS.TickBookVault,
        functionName: 'availableUsdcWad',
        args: [actorAddr],
      }) as Promise<bigint>,
      publicClient.readContract({
        address: deployment.contracts.TickBookVault as `0x${string}`,
        abi: ABIS.TickBookVault,
        functionName: 'reservedUsdcWad',
        args: [actorAddr],
      }) as Promise<bigint>,
    ]);

    let internalYes = 0n;
    let internalNo = 0n;
    let erc20Yes = 0n;
    let erc20No = 0n;
    let ammYes = 0n;
    let ammNo = 0n;
    let lpTokens = 0n;

    if (marketAddress) {
      try {
        [internalYes, internalNo] = await publicClient.readContract({
          address: deployment.contracts.TickBookVault as `0x${string}`,
          abi: TickBookVaultAbi,
          functionName: 'getInternalOutcomes',
          args: [marketAddress, actorAddr],
        }) as [bigint, bigint];
      } catch {}

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
      vault: available + reserved,
      internalYes,
      internalNo,
      erc20Yes,
      erc20No,
      ammYes,
      ammNo,
      lpTokens,
      name: actor.name,
    };
  }

  const [launchpadBal, vaultBal, collateralizerBal, ammEngineBal] = await Promise.all([
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
      args: [deployment.contracts.TickBookVault as `0x${string}`],
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
  ]);

  snap.contracts = {
    launchpadEngine: launchpadBal,
    tickBookVault: vaultBal,
    collateralizer: collateralizerBal,
    ammEngine: ammEngineBal,
  };

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

function calculateActorTotalValue(data: ActorPositions, market: MarketState | null): bigint {
  const liquidUsdc = data.wallet + data.vault;
  
  if (!market) {
    return liquidUsdc;
  }

  const totalYes = data.internalYes + data.erc20Yes + data.ammYes;
  const totalNo = data.internalNo + data.erc20No + data.ammNo;
  
  let yesValue = 0n;
  let noValue = 0n;
  
  if (market.isSettled) {
    if (market.winningOutcome === 1) {
      yesValue = totalYes;
    } else if (market.winningOutcome === 0) {
      noValue = totalNo;
    } else {
      yesValue = totalYes / 2n;
      noValue = totalNo / 2n;
    }
  } else {
    yesValue = totalYes / 2n;
    noValue = totalNo / 2n;
  }
  
  let lpValue = 0n;
  if (data.lpTokens > 0n && market.totalLPSupply > 0n) {
    const poolValue = market.creatorDeposit + market.feesAccrued;
    lpValue = (poolValue * data.lpTokens) / market.totalLPSupply;
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
    if (data.vault > 0n) parts.push(`v:${formatWad(data.vault)}`);
    
    if (snap.market) {
      const totalYes = data.internalYes + data.erc20Yes + data.ammYes;
      const totalNo = data.internalNo + data.erc20No + data.ammNo;
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
  console.log(`    LaunchpadEngine ${formatWad(snap.contracts.launchpadEngine).padStart(12)} USDC`);
  console.log(`    AMMEngine       ${formatWad(snap.contracts.ammEngine).padStart(12)} USDC`);
  console.log(`    TickBookVault   ${formatWad(snap.contracts.tickBookVault).padStart(12)} USDC ${dim('(custodial)')}`);
  console.log(`    Collateralizer  ${formatWad(snap.contracts.collateralizer).padStart(12)} USDC`);

  console.log(`\n  ${info('Summary:')}`);
  console.log(`    Total Minted:   ${formatWad(snap.totalMinted).padStart(12)} USDC`);
  console.log('');
}

export async function checksum(ctx: CommandContext, args: string[]): Promise<CommandResult> {
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
      tickBookVault: 0n,
      collateralizer: 0n,
      ammEngine: 0n,
    },
    totalMinted: 0n,
    market: null,
  };

  if (marketAddress) {
    try {
      const [marketState, isSettled] = await Promise.all([
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
      ]);

      const [, lpTokenAddress, , , creatorDeposit, feesAccrued, totalLPSupply, , isGraduated] = marketState;

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
        isSettled,
        winningOutcome,
        isGraduated,
      };
    } catch {}
  }

  for (const actor of actors) {
    const actorAddr = actor.account.address;
    
    const [wallet, available, reserved] = await Promise.all([
      publicClient.readContract({
        address: deployment.contracts.MockUSDC as `0x${string}`,
        abi: ABIS.MockUSDC,
        functionName: 'balanceOf',
        args: [actorAddr],
      }) as Promise<bigint>,
      publicClient.readContract({
        address: deployment.contracts.TickBookVault as `0x${string}`,
        abi: ABIS.TickBookVault,
        functionName: 'availableUsdcWad',
        args: [actorAddr],
      }) as Promise<bigint>,
      publicClient.readContract({
        address: deployment.contracts.TickBookVault as `0x${string}`,
        abi: ABIS.TickBookVault,
        functionName: 'reservedUsdcWad',
        args: [actorAddr],
      }) as Promise<bigint>,
    ]);

    let internalYes = 0n;
    let internalNo = 0n;
    let erc20Yes = 0n;
    let erc20No = 0n;
    let ammYes = 0n;
    let ammNo = 0n;
    let lpTokens = 0n;

    if (marketAddress) {
      try {
        [internalYes, internalNo] = await publicClient.readContract({
          address: deployment.contracts.TickBookVault as `0x${string}`,
          abi: TickBookVaultAbi,
          functionName: 'getInternalOutcomes',
          args: [marketAddress, actorAddr],
        }) as [bigint, bigint];
      } catch {}

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
      vault: available + reserved,
      internalYes,
      internalNo,
      erc20Yes,
      erc20No,
      ammYes,
      ammNo,
      lpTokens,
      name: actor.name,
    };
  }

  const [launchpadBal, vaultBal, collateralizerBal, ammEngineBal] = await Promise.all([
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
      args: [deployment.contracts.TickBookVault as `0x${string}`],
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
  ]);

  after.contracts = {
    launchpadEngine: launchpadBal,
    tickBookVault: vaultBal,
    collateralizer: collateralizerBal,
    ammEngine: ammEngineBal,
  };

  after.totalMinted = await publicClient.readContract({
    address: deployment.contracts.MockUSDC as `0x${string}`,
    abi: ABIS.MockUSDC,
    functionName: 'totalSupply',
  }) as bigint;

  console.log(`\n  ${bold('Zero-Sum P&L Verification (Comprehensive)')}`);
  console.log('  ' + '═'.repeat(70));

  const mintedDelta = after.totalMinted - before.totalMinted;
  console.log(`\n  ${info('New USDC Minted:')} ${formatWad(mintedDelta)} USDC`);

  if (after.market) {
    const m = after.market;
    const settlementStatus = m.isSettled 
      ? `settled: ${['NO', 'YES', 'INVALID'][m.winningOutcome]}` 
      : 'live';
    console.log(`  ${info('Market Status:')} ${settlementStatus}`);
  }

  console.log(`\n  ${info('Actor Total Value (USDC + Tokens + LP):')}`);
  console.log('  ' + '─'.repeat(70));

  let totalActorValueBefore = 0n;
  let totalActorValueAfter = 0n;
  const actorDeltas: { name: string; delta: bigint; breakdown: string }[] = [];

  for (const [addr, afterData] of Object.entries(after.actors)) {
    const beforeData = before.actors[addr];
    if (!beforeData) continue;

    const beforeValue = calculateActorTotalValue(beforeData, before.market);
    const afterValue = calculateActorTotalValue(afterData, after.market);
    const delta = afterValue - beforeValue;
    
    totalActorValueBefore += beforeValue;
    totalActorValueAfter += afterValue;

    const parts: string[] = [];
    const usdcDelta = (afterData.wallet + afterData.vault) - (beforeData.wallet + beforeData.vault);
    if (usdcDelta !== 0n) parts.push(`usdc:${usdcDelta >= 0n ? '+' : ''}${formatWad(usdcDelta)}`);
    
    if (after.market) {
      const yesDelta = (afterData.internalYes + afterData.erc20Yes + afterData.ammYes) - (beforeData.internalYes + beforeData.erc20Yes + beforeData.ammYes);
      const noDelta = (afterData.internalNo + afterData.erc20No + afterData.ammNo) - (beforeData.internalNo + beforeData.erc20No + beforeData.ammNo);
      const lpDelta = afterData.lpTokens - beforeData.lpTokens;
      
      if (yesDelta !== 0n) parts.push(`yes:${yesDelta >= 0n ? '+' : ''}${formatWad(yesDelta)}`);
      if (noDelta !== 0n) parts.push(`no:${noDelta >= 0n ? '+' : ''}${formatWad(noDelta)}`);
      if (lpDelta !== 0n) parts.push(`lp:${lpDelta >= 0n ? '+' : ''}${formatWad(lpDelta)}`);
    }

    actorDeltas.push({ name: afterData.name, delta, breakdown: parts.join(', ') || 'no change' });

    const sign = delta >= 0n ? '+' : '';
    const color = delta >= 0n ? success : error;
    console.log(`    ${afterData.name.padEnd(10)} ${color(`${sign}${formatWad(delta)}`.padStart(15))} USDC ${dim(`(${parts.join(', ') || 'no change'})`)}`);
  }
  
  console.log('  ' + '─'.repeat(70));
  const totalActorDelta = totalActorValueAfter - totalActorValueBefore;
  const actorSign = totalActorDelta >= 0n ? '+' : '';
  console.log(`    ${'Actors Σ'.padEnd(10)} ${(actorSign + formatWad(totalActorDelta)).padStart(15)} USDC`);

  console.log(`\n  ${info('Contract USDC (protocol-owned):')}`);
  console.log('  ' + '─'.repeat(70));

  const launchpadDelta = after.contracts.launchpadEngine - before.contracts.launchpadEngine;
  const collateralizerDelta = after.contracts.collateralizer - before.contracts.collateralizer;
  const ammEngineDelta = after.contracts.ammEngine - before.contracts.ammEngine;
  const totalContractDelta = launchpadDelta + collateralizerDelta + ammEngineDelta;

  const printDelta = (name: string, delta: bigint) => {
    const sign = delta >= 0n ? '+' : '';
    const color = delta >= 0n ? success : error;
    console.log(`    ${name.padEnd(18)} ${color(`${sign}${formatWad(delta)}`.padStart(12))} USDC`);
  };

  printDelta('LaunchpadEngine', launchpadDelta);
  printDelta('AMMEngine', ammEngineDelta);
  printDelta('Collateralizer', collateralizerDelta);
  
  const vaultDelta = after.contracts.tickBookVault - before.contracts.tickBookVault;
  console.log(`    ${dim('TickBookVault'.padEnd(18))} ${dim(`${vaultDelta >= 0n ? '+' : ''}${formatWad(vaultDelta)}`.padStart(12))} ${dim('USDC (custodial, not counted)')}`);
  
  console.log('  ' + '─'.repeat(70));
  const contractSign = totalContractDelta >= 0n ? '+' : '';
  console.log(`    ${'Protocol Σ'.padEnd(18)} ${(contractSign + formatWad(totalContractDelta)).padStart(12)} USDC`);

  console.log(`\n  ${bold('Zero-Sum Equation:')}`);
  console.log('  ' + '═'.repeat(70));
  console.log(`    Actors Value Δ:    ${(actorSign + formatWad(totalActorDelta)).padStart(15)} USDC`);
  console.log(`    Protocol USDC Δ:   ${(contractSign + formatWad(totalContractDelta)).padStart(15)} USDC`);
  console.log(`    ─────────────────────────────────────────────────`);
  
  const totalAccountedDelta = totalActorDelta + totalContractDelta;
  console.log(`    Total Accounted:   ${((totalAccountedDelta >= 0n ? '+' : '') + formatWad(totalAccountedDelta)).padStart(15)} USDC`);
  console.log(`    USDC Minted:       ${((mintedDelta >= 0n ? '+' : '') + formatWad(mintedDelta)).padStart(15)} USDC`);
  console.log(`    ─────────────────────────────────────────────────`);

  const checksumValue = totalAccountedDelta - mintedDelta;
  const checksumPass = checksumValue === 0n;
  
  if (checksumPass) {
    console.log(`    ${success('✓ CHECKSUM:')}          ${bold('0.00')} USDC ${success('(BALANCED)')}`);
  } else {
    console.log(`    ${error('✗ CHECKSUM:')}          ${error(formatWad(checksumValue))} USDC ${error('(IMBALANCED)')}`);
    console.log(`\n  ${warn('WARNING: Funds are unaccounted for!')}`);
    console.log(dim('  Possible causes:'));
    console.log(dim('    - Outcome tokens not properly valued (check market settlement)'));
    console.log(dim('    - LP tokens not properly valued (check pool state)'));
    console.log(dim('    - Funds in addresses not tracked (external treasury?)'));
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

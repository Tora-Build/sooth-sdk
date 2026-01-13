/**
 * Wallet Commands
 * mint, approve, balance, allowance
 */

import type { CommandContext, CommandResult } from './types';
import { ABIS, WAD, MAX_UINT256 } from '../config';
import { formatWad, parseWad, shortAddress, shortTx, Spinner, success, error, info, dim, bold, readContractWithRpcFallback } from '../utils';

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

export const walletCommands = {
  balance,
  mint,
  approve,
  allowance,
};

/**
 * Vault Commands
 * deposit, withdraw, reserved
 */

import type { CommandContext, CommandResult } from './types';
import { ABIS, WAD, MAX_UINT256 } from '../config';
import { formatWad, parseWad, shortTx, Spinner, success, error, dim, bold, info } from '../utils';

/**
 * Deposit USDC to TickBookVault
 */
export async function deposit(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment } = ctx;
  const walletClient = actorManager.currentWalletClient();
  const address = actorManager.currentAddress();
  const publicClient = actorManager.getPublicClient();

  if (!walletClient || !address) {
    return { success: false, message: 'No actor selected' };
  }

  if (args.length < 1) {
    return { success: false, message: 'Usage: deposit <amount>' };
  }

  const amount = parseWad(args[0]);

  // Check wallet balance first
  const walletBalance = await publicClient.readContract({
    address: deployment.contracts.MockUSDC as `0x${string}`,
    abi: ABIS.MockUSDC,
    functionName: 'balanceOf',
    args: [address],
  }) as bigint;

  if (walletBalance < amount) {
    return {
      success: false,
      message: `Insufficient wallet balance: ${formatWad(walletBalance)} < ${formatWad(amount)}`,
    };
  }

  // Check and set allowance if needed
  const currentAllowance = await publicClient.readContract({
    address: deployment.contracts.MockUSDC as `0x${string}`,
    abi: ABIS.MockUSDC,
    functionName: 'allowance',
    args: [address, deployment.contracts.TickBookVault as `0x${string}`],
  }) as bigint;

  if (currentAllowance < amount) {
    const approveSpinner = new Spinner('Approving vault...');
    approveSpinner.start();

    try {
      const approveHash = await walletClient.writeContract({
        address: deployment.contracts.MockUSDC as `0x${string}`,
        abi: ABIS.MockUSDC,
        functionName: 'approve',
        args: [deployment.contracts.TickBookVault as `0x${string}`, MAX_UINT256],
      });
      await actorManager.waitForTransactionReceipt(approveHash);
      approveSpinner.succeed('Vault approved');
    } catch (err) {
      approveSpinner.fail(`Approval failed: ${(err as Error).message.slice(0, 40)}`);
      return { success: false, message: (err as Error).message };
    }
  }

  // Execute deposit
  const depositSpinner = new Spinner(`Depositing ${formatWad(amount)} USDC...`);
  depositSpinner.start();

  try {
    const hash = await walletClient.writeContract({
      address: deployment.contracts.TickBookVault as `0x${string}`,
      abi: ABIS.TickBookVault,
      functionName: 'depositUsdc',
      args: [amount],
    });

    await actorManager.waitForTransactionReceipt(hash);
    depositSpinner.succeed(`Deposited ${formatWad(amount)} USDC to vault ${dim(`(tx: ${shortTx(hash)})`)}`);

    return { success: true, txHash: hash };
  } catch (err) {
    depositSpinner.fail(`Deposit failed: ${(err as Error).message.slice(0, 50)}`);
    return { success: false, message: (err as Error).message };
  }
}

/**
 * Withdraw USDC from TickBookVault
 */
export async function withdraw(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment } = ctx;
  const walletClient = actorManager.currentWalletClient();
  const address = actorManager.currentAddress();
  const publicClient = actorManager.getPublicClient();

  if (!walletClient || !address) {
    return { success: false, message: 'No actor selected' };
  }

  if (args.length < 1) {
    return { success: false, message: 'Usage: withdraw <amount|max>' };
  }

  // Get available balance
  const available = await publicClient.readContract({
    address: deployment.contracts.TickBookVault as `0x${string}`,
    abi: ABIS.TickBookVault,
    functionName: 'availableUsdcWad',
    args: [address],
  }) as bigint;

  const reserved = await publicClient.readContract({
    address: deployment.contracts.TickBookVault as `0x${string}`,
    abi: ABIS.TickBookVault,
    functionName: 'reservedUsdcWad',
    args: [address],
  }) as bigint;

  // Calculate withdrawable (available - reserved)
  const withdrawable = available > reserved ? available - reserved : 0n;

  let amount: bigint;
  if (args[0].toLowerCase() === 'max' || args[0].toLowerCase() === 'all') {
    amount = withdrawable;
    if (amount === 0n) {
      return { success: false, message: 'No withdrawable balance (all funds may be reserved)' };
    }
  } else {
    amount = parseWad(args[0]);
  }

  if (amount > withdrawable) {
    return {
      success: false,
      message: `Insufficient withdrawable balance: ${formatWad(withdrawable)} (available: ${formatWad(available)}, reserved: ${formatWad(reserved)})`,
    };
  }

  const spinner = new Spinner(`Withdrawing ${formatWad(amount)} USDC...`);
  spinner.start();

  try {
    const hash = await walletClient.writeContract({
      address: deployment.contracts.TickBookVault as `0x${string}`,
      abi: ABIS.TickBookVault,
      functionName: 'withdrawUsdc',
      args: [amount],
    });

    await actorManager.waitForTransactionReceipt(hash);
    spinner.succeed(`Withdrew ${formatWad(amount)} USDC from vault ${dim(`(tx: ${shortTx(hash)})`)}`);

    return { success: true, txHash: hash };
  } catch (err) {
    spinner.fail(`Withdraw failed: ${(err as Error).message.slice(0, 50)}`);
    return { success: false, message: (err as Error).message };
  }
}

/**
 * Show reserved balance details
 */
export async function reserved(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketAddress } = ctx;
  const address = actorManager.currentAddress();
  const publicClient = actorManager.getPublicClient();

  if (!address) {
    return { success: false, message: 'No actor selected' };
  }

  const [available, reservedAmount] = await Promise.all([
    publicClient.readContract({
      address: deployment.contracts.TickBookVault as `0x${string}`,
      abi: ABIS.TickBookVault,
      functionName: 'availableUsdcWad',
      args: [address],
    }) as Promise<bigint>,
    publicClient.readContract({
      address: deployment.contracts.TickBookVault as `0x${string}`,
      abi: ABIS.TickBookVault,
      functionName: 'reservedUsdcWad',
      args: [address],
    }) as Promise<bigint>,
  ]);

  const withdrawable = available > reservedAmount ? available - reservedAmount : 0n;

  console.log(`\n  ${bold('Vault Position')}`);
  console.log('  ' + '─'.repeat(40));
  console.log(`  Available:    ${formatWad(available)} USDC`);
  console.log(`  Reserved:     ${dim(formatWad(reservedAmount))} USDC`);
  console.log(`  Withdrawable: ${success(formatWad(withdrawable))} USDC`);

  // If we have a market, show internal outcomes
  if (marketAddress) {
    try {
      const [yesShares, noShares] = await publicClient.readContract({
        address: deployment.contracts.TickBookVault as `0x${string}`,
        abi: ABIS.TickBookVault,
        functionName: 'getInternalOutcomes',
        args: [marketAddress, address],
      }) as [bigint, bigint];

      if (yesShares > 0n || noShares > 0n) {
        console.log('');
        console.log(`  ${bold('Internal Outcomes')} (pending claims)`);
        console.log('  ' + '─'.repeat(40));
        console.log(`  YES: ${formatWad(yesShares)} shares`);
        console.log(`  NO:  ${formatWad(noShares)} shares`);
      }
    } catch {
      // Ignore if market doesn't exist
    }
  }

  console.log('');
  return { success: true };
}

export const vaultCommands = {
  deposit,
  withdraw,
  reserved,
};

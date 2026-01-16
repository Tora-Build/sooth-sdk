import type { SDKContext, CommandResult, OutputLine } from '../types';
import { ABIS, MOCK_ERC20_ABI } from '../../../config/abis';
import { formatWad, parseWad, shortTx, success, error, dim, bold, plain, lines, separator } from '../utils';
import { MAX_UINT256 } from '../types';

export async function deposit(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address } = ctx;
  
  if (!address || !config.walletClient) {
    return {
      result: { success: false, message: 'No wallet connected' },
      output: [error('No wallet connected')],
    };
  }

  if (args.length < 1) {
    return {
      result: { success: false, message: 'Usage: deposit <amount>' },
      output: [error('Usage: deposit <amount>')],
    };
  }

  const amount = parseWad(args[0]);

  try {
    const walletBalance = await config.publicClient.readContract({
      address: config.contracts.MockUSDC,
      abi: MOCK_ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    }) as bigint;

    if (walletBalance < amount) {
      return {
        result: { success: false, message: `Insufficient balance` },
        output: [error(`Insufficient wallet balance: ${formatWad(walletBalance)} < ${formatWad(amount)}`)],
      };
    }

    const currentAllowance = await config.publicClient.readContract({
      address: config.contracts.MockUSDC,
      abi: MOCK_ERC20_ABI,
      functionName: 'allowance',
      args: [address, config.contracts.TickBookVault],
    }) as bigint;

    if (currentAllowance < amount) {
      const approveHash = await config.walletClient.writeContract({
        address: config.contracts.MockUSDC,
        abi: MOCK_ERC20_ABI,
        functionName: 'approve',
        args: [config.contracts.TickBookVault, MAX_UINT256],
      });
      await config.publicClient.waitForTransactionReceipt({ hash: approveHash });
    }

    const hash = await config.walletClient.writeContract({
      address: config.contracts.TickBookVault,
      abi: ABIS.TickBookVault,
      functionName: 'depositUsdc',
      args: [amount],
    });

    await config.publicClient.waitForTransactionReceipt({ hash });

    return {
      result: { success: true, txHash: hash },
      output: [success(`Deposited ${formatWad(amount)} USDC to vault (tx: ${shortTx(hash)})`)],
    };
  } catch (err) {
    return {
      result: { success: false, message: (err as Error).message },
      output: [error(`Deposit failed: ${(err as Error).message.slice(0, 60)}`)],
    };
  }
}

export async function withdraw(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address } = ctx;
  
  if (!address || !config.walletClient) {
    return {
      result: { success: false, message: 'No wallet connected' },
      output: [error('No wallet connected')],
    };
  }

  if (args.length < 1) {
    return {
      result: { success: false, message: 'Usage: withdraw <amount|max>' },
      output: [error('Usage: withdraw <amount|max>')],
    };
  }

  try {
    const [available, reserved] = await Promise.all([
      config.publicClient.readContract({
        address: config.contracts.TickBookVault,
        abi: ABIS.TickBookVault,
        functionName: 'availableUsdcWad',
        args: [address],
      }) as Promise<bigint>,
      config.publicClient.readContract({
        address: config.contracts.TickBookVault,
        abi: ABIS.TickBookVault,
        functionName: 'reservedUsdcWad',
        args: [address],
      }) as Promise<bigint>,
    ]);

    const withdrawable = available > reserved ? available - reserved : 0n;

    let amount: bigint;
    if (args[0].toLowerCase() === 'max' || args[0].toLowerCase() === 'all') {
      amount = withdrawable;
      if (amount === 0n) {
        return {
          result: { success: false, message: 'No withdrawable balance' },
          output: [error('No withdrawable balance (all funds may be reserved)')],
        };
      }
    } else {
      amount = parseWad(args[0]);
    }

    if (amount > withdrawable) {
      return {
        result: { success: false, message: 'Insufficient withdrawable balance' },
        output: [error(`Insufficient withdrawable balance: ${formatWad(withdrawable)} (available: ${formatWad(available)}, reserved: ${formatWad(reserved)})`)],
      };
    }

    const hash = await config.walletClient.writeContract({
      address: config.contracts.TickBookVault,
      abi: ABIS.TickBookVault,
      functionName: 'withdrawUsdc',
      args: [amount],
    });

    await config.publicClient.waitForTransactionReceipt({ hash });

    return {
      result: { success: true, txHash: hash },
      output: [success(`Withdrew ${formatWad(amount)} USDC from vault (tx: ${shortTx(hash)})`)],
    };
  } catch (err) {
    return {
      result: { success: false, message: (err as Error).message },
      output: [error(`Withdraw failed: ${(err as Error).message.slice(0, 60)}`)],
    };
  }
}

export async function reserved(ctx: SDKContext): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketAddress } = ctx;
  
  if (!address) {
    return {
      result: { success: false, message: 'No wallet connected' },
      output: [error('No wallet connected')],
    };
  }

  try {
    const [available, reservedAmount] = await Promise.all([
      config.publicClient.readContract({
        address: config.contracts.TickBookVault,
        abi: ABIS.TickBookVault,
        functionName: 'availableUsdcWad',
        args: [address],
      }) as Promise<bigint>,
      config.publicClient.readContract({
        address: config.contracts.TickBookVault,
        abi: ABIS.TickBookVault,
        functionName: 'reservedUsdcWad',
        args: [address],
      }) as Promise<bigint>,
    ]);

    const withdrawable = available > reservedAmount ? available - reservedAmount : 0n;

    const output: OutputLine[] = [
      plain(''),
      bold('Vault Position'),
      separator(),
      plain(`Available:    ${formatWad(available)} USDC`),
      dim(`Reserved:     ${formatWad(reservedAmount)} USDC`),
      success(`Withdrawable: ${formatWad(withdrawable)} USDC`),
    ];

    if (marketAddress) {
      try {
        const [yesShares, noShares] = await config.publicClient.readContract({
          address: config.contracts.TickBookVault,
          abi: ABIS.TickBookVault,
          functionName: 'getInternalOutcomes',
          args: [marketAddress, address],
        }) as [bigint, bigint];

        if (yesShares > 0n || noShares > 0n) {
          output.push(plain(''));
          output.push(bold('Internal Outcomes'));
          output.push(separator());
          output.push(plain(`YES: ${formatWad(yesShares)} shares`));
          output.push(plain(`NO:  ${formatWad(noShares)} shares`));
        }
      } catch {}
    }

    output.push(plain(''));
    return { result: { success: true }, output };
  } catch (err) {
    return {
      result: { success: false, message: (err as Error).message },
      output: [error(`Failed to fetch reserved: ${(err as Error).message}`)],
    };
  }
}

export const vaultCommands = { deposit, withdraw, reserved };

import type { SDKContext, CommandResult, OutputLine, Balances } from '../types';
import { MOCK_ERC20_ABI } from '../../../config/abis';
import { formatWad, parseWad, shortAddress, shortTx, success, error, bold, plain, lines, separator } from '../utils';
import { MAX_UINT256 } from '../types';

export async function getBalances(ctx: SDKContext): Promise<Balances> {
  const { config, address } = ctx;
  if (!address) throw new Error('No address');

  const walletUsdc = await config.publicClient.readContract({
    address: config.contracts.MockUSDC,
    abi: MOCK_ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
  }) as bigint;

  return { walletUsdc, vaultAvailable: 0n, vaultReserved: 0n };
}

export async function balance(ctx: SDKContext): Promise<{ result: CommandResult; output: OutputLine[] }> {
  if (!ctx.address) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }

  try {
    const balances = await getBalances(ctx);
    return {
      result: { success: true, data: balances },
      output: lines(
        plain(''),
        bold(`Balances for ${shortAddress(ctx.address)}`),
        separator(),
        plain(`Wallet USDC: ${formatWad(balances.walletUsdc)} USDC`),
        plain('')
      ),
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`Failed to fetch balances: ${(err as Error).message}`)] };
  }
}

export async function mint(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address } = ctx;
  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }
  if (args.length < 1) {
    return { result: { success: false, message: 'Usage: mint <amount>' }, output: [error('Usage: mint <amount>')] };
  }

  const amount = parseWad(args[0]);
  try {
    const hash = await config.walletClient.writeContract({
      address: config.contracts.MockUSDC,
      abi: MOCK_ERC20_ABI,
      functionName: 'mint',
      args: [address, amount],
    });
    await config.publicClient.waitForTransactionReceipt({ hash });
    return { result: { success: true, txHash: hash }, output: [success(`Minted ${formatWad(amount)} USDC (tx: ${shortTx(hash)})`)] };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`Mint failed: ${(err as Error).message.slice(0, 60)}`)] };
  }
}

export async function approve(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address } = ctx;
  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }
  if (args.length < 1) {
    return { result: { success: false, message: 'Usage: approve <contract|all>' }, output: [error('Usage: approve <contract|all> (soothbook, launchpad, all)')] };
  }

  const contractArg = args[0].toLowerCase();
  const amount = args[1] ? parseWad(args[1]) : MAX_UINT256;
  const contractMap: Record<string, `0x${string}`> = {
    soothbook: (config.contracts.SoothBook || config.contracts.LaunchpadEngine) as `0x${string}`,
    launchpad: config.contracts.LaunchpadEngine,
    launchpadengine: config.contracts.LaunchpadEngine,
  };

  const approveOne = async (name: string, addr: `0x${string}`): Promise<OutputLine> => {
    try {
      const hash = await config.walletClient!.writeContract({
        address: config.contracts.MockUSDC,
        abi: MOCK_ERC20_ABI,
        functionName: 'approve',
        args: [addr, amount],
      });
      await config.publicClient.waitForTransactionReceipt({ hash });
      const amountStr = amount === MAX_UINT256 ? 'unlimited' : formatWad(amount);
      return success(`Approved ${name} for ${amountStr} USDC`);
    } catch (err) {
      return error(`Failed to approve ${name}: ${(err as Error).message.slice(0, 40)}`);
    }
  };

  const output: OutputLine[] = [];
  let allSuccess = true;

  if (contractArg === 'all') {
    for (const [name, addr] of Object.entries(contractMap)) {
      const result = await approveOne(name, addr as `0x${string}`);
      output.push(result);
      if (result.type === 'error') allSuccess = false;
    }
  } else {
    const contractAddress = contractMap[contractArg];
    if (!contractAddress) {
      return { result: { success: false, message: `Unknown contract: ${contractArg}` }, output: [error(`Unknown contract: ${contractArg}. Use: soothbook, launchpad, or all`)] };
    }
    const result = await approveOne(contractArg, contractAddress);
    output.push(result);
    allSuccess = result.type === 'success';
  }

  return { result: { success: allSuccess }, output };
}

export async function allowance(ctx: SDKContext): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address } = ctx;
  if (!address) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }

  const contracts = [
    { name: 'SoothBook', address: (config.contracts.SoothBook || config.contracts.LaunchpadEngine) as `0x${string}` },
    { name: 'Launchpad', address: config.contracts.LaunchpadEngine },
  ];

  const output: OutputLine[] = [plain(''), bold(`Allowances for ${shortAddress(address)}`), separator()];

  for (const contract of contracts) {
    const value = await config.publicClient.readContract({
      address: config.contracts.MockUSDC,
      abi: MOCK_ERC20_ABI,
      functionName: 'allowance',
      args: [address, contract.address],
    }) as bigint;

    const displayValue = value >= MAX_UINT256 / 2n ? 'unlimited' : `${formatWad(value)} USDC`;
    output.push(plain(`${contract.name.padEnd(12)}: ${displayValue}`));
  }

  output.push(plain(''));
  return { result: { success: true }, output };
}

export const walletCommands = { balance, mint, approve, allowance, getBalances };

import { type PublicClient, type WalletClient, type Address, type Account } from 'viem';
import { POOL_MANAGER_ABI, VAULT_ABI, ERC20_ABI, MAX_UINT256, WAD, type NetworkConfig } from './config.js';
import type { ArbitrageOpportunity } from './types.js';

export interface ExecutionResult {
  success: boolean;
  txHash?: `0x${string}`;
  error?: string;
  profitWad?: bigint;
}

export async function ensureVaultApproval(
  publicClient: PublicClient,
  walletClient: WalletClient,
  config: NetworkConfig,
  account: Account
): Promise<void> {
  const allowance = await publicClient.readContract({
    address: config.contracts.MockUSDC,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [account.address, config.contracts.TickBookVault],
  }) as bigint;

  if (allowance < WAD * 1_000_000n) {
    const hash = await walletClient.writeContract({
      address: config.contracts.MockUSDC,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [config.contracts.TickBookVault, MAX_UINT256],
      account,
      chain: config.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }
}

export async function ensureVaultBalance(
  publicClient: PublicClient,
  walletClient: WalletClient,
  config: NetworkConfig,
  account: Account,
  requiredWad: bigint
): Promise<void> {
  const available = await publicClient.readContract({
    address: config.contracts.TickBookVault,
    abi: VAULT_ABI,
    functionName: 'availableUsdcWad',
    args: [account.address],
  }) as bigint;

  if (available < requiredWad) {
    const needed = requiredWad - available;
    const hash = await walletClient.writeContract({
      address: config.contracts.TickBookVault,
      abi: VAULT_ABI,
      functionName: 'depositUsdc',
      args: [needed],
      account,
      chain: config.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }
}

export async function executeArbitrage(
  publicClient: PublicClient,
  walletClient: WalletClient,
  config: NetworkConfig,
  market: Address,
  marketKey: `0x${string}`,
  opp: ArbitrageOpportunity,
  account: Account
): Promise<ExecutionResult> {
  try {
    const freshSell = await publicClient.readContract({
      address: config.contracts.TickBookPoolManager,
      abi: POOL_MANAGER_ABI,
      functionName: 'getSpotSellOrder',
      args: [marketKey, opp.sellSource.sellId],
    }) as {
      owner: `0x${string}`;
      outcome: number;
      tickLower: number;
      tickUpper: number;
      active: boolean;
      sharesTotal: bigint;
      filledShares: bigint;
      proceedsClaimedWad: bigint;
    };

    if (!freshSell.active) {
      return { success: false, error: 'Spot sell no longer active' };
    }
    
    const freshRestingShares = freshSell.sharesTotal - freshSell.filledShares;
    if (freshRestingShares === 0n) {
      return { success: false, error: 'Spot sell fully filled' };
    }

    const sharesToBuy = freshRestingShares < opp.maxShares ? freshRestingShares : opp.maxShares;
    const maxCost = (sharesToBuy * BigInt(freshSell.tickUpper) * WAD) / (1000n * WAD) * 11n / 10n + WAD;

    await ensureVaultApproval(publicClient, walletClient, config, account);
    await ensureVaultBalance(publicClient, walletClient, config, account, maxCost);

    const [yesBefore, noBefore] = await publicClient.readContract({
      address: config.contracts.TickBookVault,
      abi: VAULT_ABI,
      functionName: 'getInternalOutcomes',
      args: [market, account.address],
    }) as [bigint, bigint];

    const buyTickLower = freshSell.tickLower;
    const buyTickUpper = freshSell.tickUpper;
    
    const { result: simResult } = await publicClient.simulateContract({
      address: config.contracts.TickBookPoolManager,
      abi: POOL_MANAGER_ABI,
      functionName: 'placeOrder',
      args: [
        marketKey,
        freshSell.outcome,
        sharesToBuy,
        buyTickLower,
        buyTickUpper,
        maxCost,
      ],
      account: account.address,
    });
    const [, filledShares, , ] = simResult as [bigint, bigint, bigint, bigint];
    
    if (filledShares === 0n) {
      return { 
        success: false, 
        error: `No fill: sell#${opp.sellSource.sellId} tick[${buyTickLower}-${buyTickUpper}] ${Number(sharesToBuy)/1e18}sh` 
      };
    }
    
    const buyHash = await walletClient.writeContract({
      address: config.contracts.TickBookPoolManager,
      abi: POOL_MANAGER_ABI,
      functionName: 'placeOrder',
      args: [
        marketKey,
        freshSell.outcome,
        sharesToBuy,
        buyTickLower,
        buyTickUpper,
        maxCost,
      ],
      account,
      chain: config.chain,
    });

    const buyReceipt = await publicClient.waitForTransactionReceipt({ hash: buyHash });

    if (buyReceipt.status !== 'success') {
      return { success: false, error: 'Buy transaction failed' };
    }

    const [yesAfter, noAfter] = await publicClient.readContract({
      address: config.contracts.TickBookVault,
      abi: VAULT_ABI,
      functionName: 'getInternalOutcomes',
      args: [market, account.address],
    }) as [bigint, bigint];

    const outcomeAfter = freshSell.outcome === 1 ? yesAfter : noAfter;
    const outcomeBefore = freshSell.outcome === 1 ? yesBefore : noBefore;
    const actualFilled = outcomeAfter - outcomeBefore;

    if (actualFilled <= 0n) {
      return { success: false, error: 'No tokens received from buy' };
    }

    const sellTick = opp.buyOrder.tickLower;

    const sellHash = await walletClient.writeContract({
      address: config.contracts.TickBookPoolManager,
      abi: POOL_MANAGER_ABI,
      functionName: 'placeSpotSell',
      args: [
        marketKey,
        freshSell.outcome,
        actualFilled,
        sellTick,
        sellTick,
      ],
      account,
      chain: config.chain,
    });

    const sellReceipt = await publicClient.waitForTransactionReceipt({ hash: sellHash });

    if (sellReceipt.status !== 'success') {
      return { success: false, error: 'Spot sell placement failed', txHash: buyHash };
    }

    return {
      success: true,
      txHash: sellHash,
      profitWad: opp.estimatedProfitWad,
    };
  } catch (err: unknown) {
    let error = 'Unknown error';
    if (err instanceof Error) {
      const msg = err.message;
      const revertMatch = msg.match(/reverted with the following reason:\s*(.+?)(?:\n|Contract Call:|$)/s);
      if (revertMatch) {
        error = revertMatch[1].trim() || 'Contract reverted';
      } else if (msg.includes('SlippageExceeded')) {
        error = 'SlippageExceeded';
      } else if (msg.includes('InsufficientBalance')) {
        error = 'InsufficientBalance';  
      } else {
        error = msg.split('\n')[0].slice(0, 80);
      }
    }
    return { success: false, error };
  }
}

export async function estimateGasCost(
  publicClient: PublicClient,
  config: NetworkConfig,
  marketKey: `0x${string}`,
  opp: ArbitrageOpportunity,
  account: Account
): Promise<bigint> {
  try {
    const maxCost = (opp.maxShares * BigInt(opp.sellSource.tickUpper) * WAD) / (1000n * WAD) + WAD;

    const buyGas = await publicClient.estimateContractGas({
      address: config.contracts.TickBookPoolManager,
      abi: POOL_MANAGER_ABI,
      functionName: 'placeOrder',
      args: [
        marketKey,
        opp.sellSource.outcome,
        opp.maxShares,
        opp.sellSource.tickLower,
        opp.sellSource.tickUpper,
        maxCost,
      ],
      account,
    });

    const sellGas = await publicClient.estimateContractGas({
      address: config.contracts.TickBookPoolManager,
      abi: POOL_MANAGER_ABI,
      functionName: 'placeSpotSell',
      args: [
        marketKey,
        opp.buyOrder.outcome,
        opp.maxShares,
        opp.buyOrder.tickLower,
        opp.buyOrder.tickLower,
      ],
      account,
    });

    return buyGas + sellGas;
  } catch {
    return 1_000_000n;
  }
}

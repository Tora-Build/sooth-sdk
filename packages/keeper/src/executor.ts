import { type PublicClient, type WalletClient, type Address } from 'viem';
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
  account: Address
): Promise<void> {
  const allowance = await publicClient.readContract({
    address: config.contracts.MockUSDC,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [account, config.contracts.TickBookVault],
  }) as bigint;

  if (allowance < WAD * 1_000_000n) {
    console.log('  Approving vault for USDC...');
    const hash = await walletClient.writeContract({
      address: config.contracts.MockUSDC,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [config.contracts.TickBookVault, MAX_UINT256],
      account,
      chain: config.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log('  Approved');
  }
}

export async function ensureVaultBalance(
  publicClient: PublicClient,
  walletClient: WalletClient,
  config: NetworkConfig,
  account: Address,
  requiredWad: bigint
): Promise<void> {
  const available = await publicClient.readContract({
    address: config.contracts.TickBookVault,
    abi: VAULT_ABI,
    functionName: 'availableUsdcWad',
    args: [account],
  }) as bigint;

  if (available < requiredWad) {
    const needed = requiredWad - available;
    console.log(`  Depositing ${Number(needed) / 1e18} USDC to vault...`);
    
    const hash = await walletClient.writeContract({
      address: config.contracts.TickBookVault,
      abi: VAULT_ABI,
      functionName: 'depositUsdc',
      args: [needed],
      account,
      chain: config.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log('  Deposited');
  }
}

export async function executeArbitrage(
  publicClient: PublicClient,
  walletClient: WalletClient,
  config: NetworkConfig,
  marketKey: `0x${string}`,
  opp: ArbitrageOpportunity,
  account: Address
): Promise<ExecutionResult> {
  try {
    const maxCost = (opp.maxShares * BigInt(opp.sellPrice) * WAD) / (1000n * WAD) + WAD;

    await ensureVaultApproval(publicClient, walletClient, config, account);
    await ensureVaultBalance(publicClient, walletClient, config, account, maxCost);

    console.log(`  Placing order to buy from spot sell at ${opp.sellPrice / 10}%...`);
    
    const buyHash = await walletClient.writeContract({
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
      chain: config.chain,
    });

    const buyReceipt = await publicClient.waitForTransactionReceipt({ hash: buyHash });
    
    if (buyReceipt.status !== 'success') {
      return { success: false, error: 'Buy transaction failed' };
    }

    console.log(`  Buy tx: ${buyHash}`);
    console.log(`  Placing spot sell to resting buyer at ${opp.buyPrice / 10}%...`);

    const sellHash = await walletClient.writeContract({
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
      chain: config.chain,
    });

    const sellReceipt = await publicClient.waitForTransactionReceipt({ hash: sellHash });
    
    if (sellReceipt.status !== 'success') {
      return { success: false, error: 'Sell transaction failed', txHash: buyHash };
    }

    console.log(`  Sell tx: ${sellHash}`);

    return {
      success: true,
      txHash: sellHash,
      profitWad: opp.estimatedProfitWad,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error };
  }
}

export async function estimateGasCost(
  publicClient: PublicClient,
  config: NetworkConfig,
  marketKey: `0x${string}`,
  opp: ArbitrageOpportunity,
  account: Address
): Promise<bigint> {
  try {
    const maxCost = (opp.maxShares * BigInt(opp.sellPrice) * WAD) / (1000n * WAD) + WAD;

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

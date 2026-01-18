import { type PublicClient, type WalletClient, type Address, type Account } from 'viem';
import { POOL_MANAGER_ABI, VAULT_ABI, type NetworkConfig, WAD } from './config.js';

const BATCH_SIZE = 15;
const DELAY_MS = 1500;
const MIN_TOKENS_TO_SELL = WAD;
const MIN_USDC_TO_WITHDRAW = WAD;

export interface MaintenanceResult {
  fillsClaimed: number;
  ordersCancelled: number;
  spotSellsCancelled: number;
  spotSellProceedsClaimed: number;
  tokensSold: { yes: bigint; no: bigint };
  usdcWithdrawn: bigint;
  errors: string[];
}

export interface MaintenanceCallbacks {
  onLog?: (msg: string) => void;
  onError?: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runMaintenance(
  publicClient: PublicClient,
  walletClient: WalletClient,
  config: NetworkConfig,
  account: Account,
  marketKey: `0x${string}`,
  market: Address,
  callbacks?: MaintenanceCallbacks
): Promise<MaintenanceResult> {
  const log = callbacks?.onLog || (() => {});
  const logError = callbacks?.onError || (() => {});
  const logSuccess = callbacks?.onSuccess || (() => {});

  const result: MaintenanceResult = {
    fillsClaimed: 0,
    ordersCancelled: 0,
    spotSellsCancelled: 0,
    spotSellProceedsClaimed: 0,
    tokensSold: { yes: 0n, no: 0n },
    usdcWithdrawn: 0n,
    errors: [],
  };

  try {
    const userOrders = await publicClient.readContract({
      address: config.contracts.TickBookPoolManager,
      abi: POOL_MANAGER_ABI,
      functionName: 'getUserOrders',
      args: [marketKey, account.address],
    }) as bigint[];

    if (userOrders.length > 0) {
      log(`Found ${userOrders.length} keeper orders`);

      const ordersWithFills: bigint[] = [];
      const activeOrders: bigint[] = [];

      for (const orderId of userOrders) {
        try {
          const order = await publicClient.readContract({
            address: config.contracts.TickBookPoolManager,
            abi: POOL_MANAGER_ABI,
            functionName: 'getOrder',
            args: [marketKey, orderId],
          }) as { active: boolean; liquidityRemoved: boolean };

          const [pendingShares, pendingUsdc] = await publicClient.readContract({
            address: config.contracts.TickBookPoolManager,
            abi: POOL_MANAGER_ABI,
            functionName: 'getPendingFills',
            args: [marketKey, orderId],
          }) as [bigint, bigint];

          if (pendingShares > 0n || pendingUsdc > 0n) {
            ordersWithFills.push(orderId);
          }

          if (order.active && !order.liquidityRemoved) {
            activeOrders.push(orderId);
          }
        } catch {
          continue;
        }
      }

      if (ordersWithFills.length > 0) {
        log(`Claiming fills from ${ordersWithFills.length} orders...`);
        
        for (let i = 0; i < ordersWithFills.length; i += BATCH_SIZE) {
          const batch = ordersWithFills.slice(i, i + BATCH_SIZE);
          try {
            const hash = await walletClient.writeContract({
              address: config.contracts.TickBookPoolManager,
              abi: POOL_MANAGER_ABI,
              functionName: 'batchClaimFills',
              args: [marketKey, batch],
              account,
              chain: config.chain,
            });
            
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            if (receipt.status === 'success') {
              result.fillsClaimed += batch.length;
              logSuccess(`Claimed ${batch.length} fills`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message.slice(0, 50) : 'Unknown';
            result.errors.push(`Claim batch failed: ${msg}`);
            logError(`Claim failed: ${msg}`);
          }
          await sleep(DELAY_MS);
        }
      }

      if (activeOrders.length > 0) {
        log(`Cancelling ${activeOrders.length} active orders...`);
        
        for (let i = 0; i < activeOrders.length; i += BATCH_SIZE) {
          const batch = activeOrders.slice(i, i + BATCH_SIZE);
          try {
            const hash = await walletClient.writeContract({
              address: config.contracts.TickBookPoolManager,
              abi: POOL_MANAGER_ABI,
              functionName: 'batchCancelOrders',
              args: [marketKey, batch],
              account,
              chain: config.chain,
              gas: 5_000_000n,
            });
            
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            if (receipt.status === 'success') {
              result.ordersCancelled += batch.length;
              logSuccess(`Cancelled ${batch.length} orders`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message.slice(0, 50) : 'Unknown';
            result.errors.push(`Cancel batch failed: ${msg}`);
            logError(`Cancel failed: ${msg}`);
          }
          await sleep(DELAY_MS);
        }
      }
    }

    const userSpotSells = await publicClient.readContract({
      address: config.contracts.TickBookPoolManager,
      abi: POOL_MANAGER_ABI,
      functionName: 'getUserSpotSells',
      args: [marketKey, account.address],
    }) as bigint[];

    if (userSpotSells.length > 0) {
      log(`Found ${userSpotSells.length} keeper spot sells`);

      const activeSpotSells: bigint[] = [];
      const spotSellsWithProceeds: bigint[] = [];

      for (const sellId of userSpotSells) {
        try {
          const sell = await publicClient.readContract({
            address: config.contracts.TickBookPoolManager,
            abi: POOL_MANAGER_ABI,
            functionName: 'getSpotSellOrder',
            args: [marketKey, sellId],
          }) as { active: boolean; sharesTotal: bigint; filledShares: bigint; proceedsClaimedWad: bigint };

          if (sell.active) {
            const restingShares = sell.sharesTotal - sell.filledShares;
            if (restingShares > 0n) {
              activeSpotSells.push(sellId);
            }
          }

          const hasUnclaimedProceeds = sell.filledShares > 0n;
          if (hasUnclaimedProceeds) {
            spotSellsWithProceeds.push(sellId);
          }
        } catch {
          continue;
        }
      }

      if (spotSellsWithProceeds.length > 0) {
        log(`Claiming proceeds from ${spotSellsWithProceeds.length} spot sells...`);
        
        for (const sellId of spotSellsWithProceeds) {
          try {
            const hash = await walletClient.writeContract({
              address: config.contracts.TickBookPoolManager,
              abi: POOL_MANAGER_ABI,
              functionName: 'claimSpotSellProceeds',
              args: [marketKey, sellId],
              account,
              chain: config.chain,
            });
            
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            if (receipt.status === 'success') {
              result.spotSellProceedsClaimed++;
              logSuccess(`Claimed proceeds from spot sell #${sellId}`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message.slice(0, 50) : 'Unknown';
            result.errors.push(`Claim spot sell proceeds failed: ${msg}`);
          }
          await sleep(DELAY_MS);
        }
      }

      if (activeSpotSells.length > 0) {
        log(`Cancelling ${activeSpotSells.length} active spot sells...`);
        
        for (const sellId of activeSpotSells) {
          try {
            const hash = await walletClient.writeContract({
              address: config.contracts.TickBookPoolManager,
              abi: POOL_MANAGER_ABI,
              functionName: 'cancelSpotSell',
              args: [marketKey, sellId],
              account,
              chain: config.chain,
            });
            
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            if (receipt.status === 'success') {
              result.spotSellsCancelled++;
              logSuccess(`Cancelled spot sell #${sellId}`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message.slice(0, 50) : 'Unknown';
            result.errors.push(`Cancel spot sell failed: ${msg}`);
          }
          await sleep(DELAY_MS);
        }
      }
    }

    const [yesBalance, noBalance] = await publicClient.readContract({
      address: config.contracts.TickBookVault,
      abi: VAULT_ABI,
      functionName: 'getInternalOutcomes',
      args: [market, account.address],
    }) as [bigint, bigint];

    if (yesBalance > MIN_TOKENS_TO_SELL) {
      log(`Selling ${(Number(yesBalance) / 1e18).toFixed(2)} YES tokens...`);
      try {
        const hash = await walletClient.writeContract({
          address: config.contracts.TickBookPoolManager,
          abi: POOL_MANAGER_ABI,
          functionName: 'placeSpotSell',
          args: [marketKey, 1, yesBalance, 1, 1],
          account,
          chain: config.chain,
        });
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === 'success') {
          result.tokensSold.yes = yesBalance;
          logSuccess(`Sold YES tokens`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message.slice(0, 50) : 'Unknown';
        result.errors.push(`YES sell failed: ${msg}`);
        logError(`YES sell failed: ${msg}`);
      }
    }

    if (noBalance > MIN_TOKENS_TO_SELL) {
      log(`Selling ${(Number(noBalance) / 1e18).toFixed(2)} NO tokens...`);
      try {
        const hash = await walletClient.writeContract({
          address: config.contracts.TickBookPoolManager,
          abi: POOL_MANAGER_ABI,
          functionName: 'placeSpotSell',
          args: [marketKey, 0, noBalance, 1, 1],
          account,
          chain: config.chain,
        });
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === 'success') {
          result.tokensSold.no = noBalance;
          logSuccess(`Sold NO tokens`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message.slice(0, 50) : 'Unknown';
        result.errors.push(`NO sell failed: ${msg}`);
        logError(`NO sell failed: ${msg}`);
      }
    }

    const availableUsdc = await publicClient.readContract({
      address: config.contracts.TickBookVault,
      abi: VAULT_ABI,
      functionName: 'availableUsdcWad',
      args: [account.address],
    }) as bigint;

    if (availableUsdc > MIN_USDC_TO_WITHDRAW) {
      log(`Withdrawing ${(Number(availableUsdc) / 1e18).toFixed(2)} USDC...`);
      try {
        const hash = await walletClient.writeContract({
          address: config.contracts.TickBookVault,
          abi: VAULT_ABI,
          functionName: 'withdrawUsdc',
          args: [availableUsdc],
          account,
          chain: config.chain,
        });
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === 'success') {
          result.usdcWithdrawn = availableUsdc;
          logSuccess(`Withdrew ${(Number(availableUsdc) / 1e18).toFixed(2)} USDC`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message.slice(0, 50) : 'Unknown';
        result.errors.push(`Withdraw failed: ${msg}`);
        logError(`Withdraw failed: ${msg}`);
      }
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    result.errors.push(`Maintenance error: ${msg}`);
    logError(`Maintenance error: ${msg}`);
  }

  return result;
}

export async function needsMaintenance(
  publicClient: PublicClient,
  config: NetworkConfig,
  account: Account,
  marketKey: `0x${string}`,
  market: Address
): Promise<{ needed: boolean; reason: string }> {
  try {
    const userOrders = await publicClient.readContract({
      address: config.contracts.TickBookPoolManager,
      abi: POOL_MANAGER_ABI,
      functionName: 'getUserOrders',
      args: [marketKey, account.address],
    }) as bigint[];

    if (userOrders.length > 0) {
      for (const orderId of userOrders) {
        try {
          const order = await publicClient.readContract({
            address: config.contracts.TickBookPoolManager,
            abi: POOL_MANAGER_ABI,
            functionName: 'getOrder',
            args: [marketKey, orderId],
          }) as { active: boolean };

          if (order.active) {
            return { needed: true, reason: `${userOrders.length} active orders` };
          }
        } catch {
          continue;
        }
      }
    }

    const [yesBalance, noBalance] = await publicClient.readContract({
      address: config.contracts.TickBookVault,
      abi: VAULT_ABI,
      functionName: 'getInternalOutcomes',
      args: [market, account.address],
    }) as [bigint, bigint];

    if (yesBalance > WAD || noBalance > WAD) {
      return { needed: true, reason: 'Holding outcome tokens' };
    }

    const userSpotSells = await publicClient.readContract({
      address: config.contracts.TickBookPoolManager,
      abi: POOL_MANAGER_ABI,
      functionName: 'getUserSpotSells',
      args: [marketKey, account.address],
    }) as bigint[];

    if (userSpotSells.length > 0) {
      for (const sellId of userSpotSells) {
        try {
          const sell = await publicClient.readContract({
            address: config.contracts.TickBookPoolManager,
            abi: POOL_MANAGER_ABI,
            functionName: 'getSpotSellOrder',
            args: [marketKey, sellId],
          }) as { active: boolean };

          if (sell.active) {
            return { needed: true, reason: `${userSpotSells.length} active spot sells` };
          }
        } catch {
          continue;
        }
      }
    }

    return { needed: false, reason: 'Clean state' };
  } catch {
    return { needed: false, reason: 'Check failed' };
  }
}

export async function getKeeperSpotSellIds(
  publicClient: PublicClient,
  config: NetworkConfig,
  account: Account,
  marketKey: `0x${string}`
): Promise<Set<bigint>> {
  const keeperSellIds = new Set<bigint>();

  try {
    const allSellIds = await publicClient.readContract({
      address: config.contracts.TickBookPoolManager,
      abi: POOL_MANAGER_ABI,
      functionName: 'getAllMarketSpotSells',
      args: [marketKey],
    }) as bigint[];

    for (const sellId of allSellIds) {
      try {
        const sell = await publicClient.readContract({
          address: config.contracts.TickBookPoolManager,
          abi: POOL_MANAGER_ABI,
          functionName: 'getSpotSellOrder',
          args: [marketKey, sellId],
        }) as { owner: Address; active: boolean };

        if (sell.active && sell.owner.toLowerCase() === account.address.toLowerCase()) {
          keeperSellIds.add(sellId);
        }
      } catch {
        continue;
      }
    }
  } catch {
  }

  return keeperSellIds;
}

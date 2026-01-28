import 'dotenv/config';
import { createPublicClient, createWalletClient, http, formatUnits, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getNetwork, LAUNCHPAD_ABI, COLLATERALIZER_ABI, POOL_MANAGER_ABI, VAULT_ABI, WAD } from './config.js';
import { keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';

const BATCH_SIZE = 15;
const DELAY_MS = 2000;

function computeMarketKey(market: Address, yesToken: Address, noToken: Address): `0x${string}` {
  return keccak256(encodeAbiParameters(
    parseAbiParameters('address, address, address'),
    [market, yesToken, noToken]
  ));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const chainName = process.env.CHAIN || 'baseSepolia';
  const privateKey = process.env.PRIVATE_KEY;
  const mode = process.argv[2] || 'status';
  
  if (!privateKey) {
    console.error('PRIVATE_KEY environment variable required');
    process.exit(1);
  }

  const config = getNetwork(chainName);
  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl || config.chain.rpcUrls.default.http[0]),
  });

  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport: http(config.rpcUrl || config.chain.rpcUrls.default.http[0]),
  });

  console.log('\n🧹 Keeper Cleanup Tool');
  console.log('═══════════════════════════════════════');
  console.log(`Chain: ${config.chain.name}`);
  console.log(`Wallet: ${account.address}`);
  console.log(`Mode: ${mode}`);
  console.log('═══════════════════════════════════════\n');

  const markets = await publicClient.readContract({
    address: config.contracts.LaunchpadEngine,
    abi: LAUNCHPAD_ABI,
    functionName: 'getMarkets',
  }) as Address[];

  for (const market of markets) {
    try {
      const [, , , , isGraduated] = await publicClient.readContract({
        address: config.contracts.LaunchpadEngine,
        abi: LAUNCHPAD_ABI,
        functionName: 'getMarketState',
        args: [market],
      }) as [Address, bigint, bigint, bigint, boolean, bigint];
      
      if (!isGraduated) continue;

      const [yesToken, noToken] = await publicClient.readContract({
        address: config.contracts.Collateralizer,
        abi: COLLATERALIZER_ABI,
        functionName: 'getOutcomeTokens',
        args: [market],
      }) as [Address, Address];

      const marketKey = computeMarketKey(market, yesToken, noToken);

      console.log(`\n📊 Market: ${market.slice(0, 10)}...`);
      console.log(`   Key: ${marketKey.slice(0, 10)}...`);

      const userOrders = await publicClient.readContract({
        address: config.contracts.TickBookPoolManager,
        abi: POOL_MANAGER_ABI,
        functionName: 'getUserOrders',
        args: [marketKey, account.address],
      }) as bigint[];

      console.log(`   Orders: ${userOrders.length}`);

      if (userOrders.length === 0) {
        console.log('   No orders to process');
        continue;
      }

      const activeOrders: bigint[] = [];
      const ordersWithFills: { orderId: bigint; pendingShares: bigint; pendingUsdc: bigint }[] = [];

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
            ordersWithFills.push({ orderId, pendingShares, pendingUsdc });
          }

          if (order.active && !order.liquidityRemoved) {
            activeOrders.push(orderId);
          }
        } catch {
          continue;
        }
      }

      const totalPendingShares = ordersWithFills.reduce((sum, o) => sum + o.pendingShares, 0n);
      const totalPendingUsdc = ordersWithFills.reduce((sum, o) => sum + o.pendingUsdc, 0n);

      console.log(`   Active orders: ${activeOrders.length}`);
      console.log(`   Orders with fills: ${ordersWithFills.length}`);
      console.log(`   Pending shares: ${(Number(totalPendingShares) / 1e18).toFixed(2)}`);
      console.log(`   Pending USDC: ${(Number(totalPendingUsdc) / 1e18).toFixed(2)}`);

      if (mode === 'status') {
        continue;
      }

      if (mode === 'claim' || mode === 'all') {
        if (ordersWithFills.length > 0) {
          console.log(`\n   📥 Claiming fills...`);
          
          for (let i = 0; i < ordersWithFills.length; i += BATCH_SIZE) {
            const batch = ordersWithFills.slice(i, i + BATCH_SIZE).map(o => o.orderId);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(ordersWithFills.length / BATCH_SIZE);
            
            console.log(`      Batch ${batchNum}/${totalBatches} (${batch.length} orders)...`);
            
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
                console.log(`      ✓ Success: ${hash.slice(0, 10)}...`);
              } else {
                console.log(`      ✗ Failed: ${hash.slice(0, 10)}...`);
              }
            } catch (err) {
              console.log(`      ✗ Error: ${err instanceof Error ? err.message.slice(0, 50) : 'Unknown'}`);
            }
            
            await sleep(DELAY_MS);
          }
        }
      }

      if (mode === 'cancel' || mode === 'all') {
        if (activeOrders.length > 0) {
          console.log(`\n   🗑️  Cancelling orders...`);
          
          for (let i = 0; i < activeOrders.length; i += BATCH_SIZE) {
            const batch = activeOrders.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(activeOrders.length / BATCH_SIZE);
            
            console.log(`      Batch ${batchNum}/${totalBatches} (${batch.length} orders)...`);
            
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
                console.log(`      ✓ Success: ${hash.slice(0, 10)}...`);
              } else {
                console.log(`      ✗ Failed: ${hash.slice(0, 10)}...`);
              }
            } catch (err) {
              console.log(`      ✗ Error: ${err instanceof Error ? err.message.slice(0, 50) : 'Unknown'}`);
            }
            
            await sleep(DELAY_MS);
          }
        }
      }

    } catch (err) {
      console.log(`   Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  if (mode === 'withdraw' || mode === 'all') {
    console.log('\n💰 Withdrawing from vault...');
    
    try {
      const available = await publicClient.readContract({
        address: config.contracts.TickBookVault,
        abi: VAULT_ABI,
        functionName: 'availableUsdcWad',
        args: [account.address],
      }) as bigint;

      if (available > WAD) {
        console.log(`   Available: ${(Number(available) / 1e18).toFixed(2)} USDC`);
        
        const hash = await walletClient.writeContract({
          address: config.contracts.TickBookVault,
          abi: VAULT_ABI,
          functionName: 'withdrawUsdc',
          args: [available],
          account,
          chain: config.chain,
        });
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        
        if (receipt.status === 'success') {
          console.log(`   ✓ Withdrawn: ${hash.slice(0, 10)}...`);
        } else {
          console.log(`   ✗ Failed: ${hash.slice(0, 10)}...`);
        }
      } else {
        console.log('   No USDC to withdraw');
      }
    } catch (err) {
      console.log(`   Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('Done!\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

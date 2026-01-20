import 'dotenv/config';
import { createPublicClient, createWalletClient, http, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getNetwork, POOL_MANAGER_ABI, LAUNCHPAD_ABI, COLLATERALIZER_ABI } from './config.js';
import { keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';

const BATCH_SIZE = 20;

function computeMarketKey(market: Address, yesToken: Address, noToken: Address): `0x${string}` {
  return keccak256(encodeAbiParameters(
    parseAbiParameters('address, address, address'),
    [market, yesToken, noToken]
  ));
}

async function main() {
  const chainName = process.env.CHAIN || 'baseSepolia';
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    console.error('PRIVATE_KEY required');
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

  console.log(`\nFast Cleanup - ${config.chain.name}`);
  console.log(`Wallet: ${account.address}\n`);

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

      const userOrders = await publicClient.readContract({
        address: config.contracts.TickBookPoolManager,
        abi: POOL_MANAGER_ABI,
        functionName: 'getUserOrders',
        args: [marketKey, account.address],
      }) as bigint[];

      const userSpotSells = await publicClient.readContract({
        address: config.contracts.TickBookPoolManager,
        abi: POOL_MANAGER_ABI,
        functionName: 'getUserSpotSells',
        args: [marketKey, account.address],
      }) as bigint[];

      console.log(`Market ${market.slice(0, 10)}... - ${userOrders.length} orders, ${userSpotSells.length} spot sells`);

      if (userOrders.length > 0) {
        const totalBatches = Math.ceil(userOrders.length / BATCH_SIZE);
        
        console.log(`  Claiming fills from ${userOrders.length} orders...`);
        for (let i = 0; i < userOrders.length; i += BATCH_SIZE) {
          const batch = userOrders.slice(i, i + BATCH_SIZE);
          const batchNum = Math.floor(i / BATCH_SIZE) + 1;
          
          process.stdout.write(`    Claim ${batchNum}/${totalBatches}...`);
          
          try {
            const hash = await walletClient.writeContract({
              address: config.contracts.TickBookPoolManager,
              abi: POOL_MANAGER_ABI,
              functionName: 'batchClaimFills',
              args: [marketKey, batch],
              account,
              chain: config.chain,
              gas: 8_000_000n,
            });
            
            await publicClient.waitForTransactionReceipt({ hash });
            console.log(` OK`);
          } catch {
            console.log(` skip`);
          }
        }

        const remainingOrders = await publicClient.readContract({
          address: config.contracts.TickBookPoolManager,
          abi: POOL_MANAGER_ABI,
          functionName: 'getUserOrders',
          args: [marketKey, account.address],
        }) as bigint[];

        if (remainingOrders.length > 0) {
          const remainingBatches = Math.ceil(remainingOrders.length / BATCH_SIZE);
          console.log(`  Cancelling ${remainingOrders.length} remaining orders...`);
          
          for (let i = 0; i < remainingOrders.length; i += BATCH_SIZE) {
            const batch = remainingOrders.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            
            process.stdout.write(`    Cancel ${batchNum}/${remainingBatches}...`);
            
            try {
              const hash = await walletClient.writeContract({
                address: config.contracts.TickBookPoolManager,
                abi: POOL_MANAGER_ABI,
                functionName: 'batchCancelOrders',
                args: [marketKey, batch],
                account,
                chain: config.chain,
                gas: 8_000_000n,
              });
              
              await publicClient.waitForTransactionReceipt({ hash });
              console.log(` OK`);
            } catch {
              console.log(` skip`);
            }
          }
        } else {
          console.log(`  All orders closed by claiming`);
        }
      }

      if (userSpotSells.length > 0) {
        console.log(`  Cancelling ${userSpotSells.length} spot sells...`);
        for (const sellId of userSpotSells) {
          process.stdout.write(`    Sell #${sellId}...`);
          try {
            const hash = await walletClient.writeContract({
              address: config.contracts.TickBookPoolManager,
              abi: POOL_MANAGER_ABI,
              functionName: 'cancelSpotSell',
              args: [marketKey, sellId],
              account,
              chain: config.chain,
            });
            await publicClient.waitForTransactionReceipt({ hash });
            console.log(` OK`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : '';
            if (msg.includes('SpotSellNotActive')) {
              console.log(` already closed`);
            } else {
              console.log(` FAIL: ${msg.slice(0, 40)}`);
            }
          }
        }
      }

    } catch (err) {
      console.log(`  Error: ${err instanceof Error ? err.message.slice(0, 50) : 'Unknown'}`);
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);

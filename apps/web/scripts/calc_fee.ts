import { createPublicClient, http, parseAbi, formatUnits, decodeEventLog } from 'viem';
import { baseSepolia } from 'viem/chains';
import deployments from '../src/config/deployments.json';

const SOOTH_MARKET_ABI = parseAbi([
  "function ammState() view returns (int256 qYes, int256 qNo)",
  "function trade(uint8 outcomeIndex, int256 deltaShares, int256 maxCost)",
  "event Trade(address indexed trader, uint8 outcomeIndex, int256 deltaShares, int256 cost)"
]);

const SOOTH_BALANCED_AMM_ABI = parseAbi([
  "function costDelta((int256 qYes, int256 qNo) s, uint8 outcomeIndex, int256 deltaShares, uint256 b) pure returns (int256 cost, (int256 qYes, int256 qNo) newState)"
]);

const SOOTH_RISK_MANAGER_ABI = parseAbi([
  "function getBForMarket(uint256 marketId) view returns (uint256 b)"
]);

async function main() {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http()
  });

  const marketId = 1n;
  const marketAddress = deployments.ExampleMarket as `0x${string}`;
  const ammAddress = deployments.SoothBalancedAMM as `0x${string}`;
  const riskManagerAddress = deployments.SoothRiskManager as `0x${string}`;

  console.log('Calculating Trading Fee...');

  // 1. Get Market State
  const [qYes, qNo] = await client.readContract({
    address: marketAddress,
    abi: SOOTH_MARKET_ABI,
    functionName: 'ammState'
  });
  
  const b = await client.readContract({
    address: riskManagerAddress,
    abi: SOOTH_RISK_MANAGER_ABI,
    functionName: 'getBForMarket',
    args: [marketId]
  });

  console.log(`State: qYes=${formatUnits(qYes, 18)}, qNo=${formatUnits(qNo, 18)}, b=${formatUnits(b, 18)}`);

  // 2. Calculate Pure AMM Cost for 10 YES shares
  const deltaShares = 10n * 10n**18n;
  const outcomeIndex = 0; // YES

  const [pureCost] = await client.readContract({
    address: ammAddress,
    abi: SOOTH_BALANCED_AMM_ABI,
    functionName: 'costDelta',
    args: [{ qYes, qNo }, outcomeIndex, deltaShares, b]
  });

  console.log(`Pure AMM Cost: ${formatUnits(pureCost, 18)} USDC`);

  // 3. Simulate Trade to get Actual Cost
  // We need a maxCost high enough to pass
  const maxCost = pureCost * 105n / 100n; // 5% buffer

  // Note: We can't easily simulate the *event* emission without a wallet that has funds and allowance.
  // However, we can use `simulateContract` which returns the result. 
  // But `trade` doesn't return the cost. It emits it.
  // `simulateContract` result.request is the request, result.result is the return value.
  // Since `trade` returns void, we can't get it from return value.
  
  // Alternative: We can calculate the fee if we know the fee rate.
  // Let's assume the fee is the difference.
  // Actually, without executing a tx, we can't see the event.
  // BUT, we can check if there's a `feeBps` public variable on the Market or Factory.
  
  // Let's try to read `feeBps` from the Market contract, just in case.
  try {
      const feeBps = await client.readContract({
          address: marketAddress,
          abi: parseAbi(["function feeBps() view returns (uint256)"]),
          functionName: 'feeBps'
      });
      console.log(`Fee BPS (from contract): ${feeBps}`);
  } catch (e) {
      console.log("Could not read 'feeBps' from market.");
  }

}

main();

import { createPublicClient, http, formatUnits } from 'viem';
import { baseSepolia } from 'viem/chains';

const MARKETS = [
  {
    id: 'example',
    name: 'Example Market',
    address: '0x3fa51a5160BCF4deD1F310476b07AcF36186B400',
    id_numeric: 1n
  },
  {
    id: 'example2',
    name: 'Second Market',
    address: '0xad042fd79F6B122C3D83a4fa03dDa390ecFf81Cd',
    id_numeric: 2n
  }
];

const RISK_MANAGER_ADDRESS = '0x44808be5Af27E6856ae40b26a594B03be728b506';

const MARKET_ABI = [
  { inputs: [], name: 'isLive', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'isSettled', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'ammState', outputs: [{ name: 'qYes', type: 'int256' }, { name: 'qNo', type: 'int256' }], stateMutability: 'view', type: 'function' }
];

const RISK_MANAGER_ABI = [
  { inputs: [{ name: 'marketId', type: 'uint256' }], name: 'getBForMarket', outputs: [{ name: 'b', type: 'uint256' }], stateMutability: 'view', type: 'function' }
];

async function main() {
  console.log('🔍 Debugging Market State on Base Sepolia...\n');

  const client = createPublicClient({
    chain: baseSepolia,
    transport: http()
  });

  for (const market of MARKETS) {
    console.log(`Checking Market: ${market.name} (${market.id})`);
    console.log(`Address: ${market.address}`);

    try {
      // Fetch Market State
      const [isLive, isSettled, ammState] = await client.multicall({
        contracts: [
          { address: market.address, abi: MARKET_ABI, functionName: 'isLive' },
          { address: market.address, abi: MARKET_ABI, functionName: 'isSettled' },
          { address: market.address, abi: MARKET_ABI, functionName: 'ammState' }
        ],
        allowFailure: false
      });

      // Fetch B Param
      const bParam = await client.readContract({
        address: RISK_MANAGER_ADDRESS,
        abi: RISK_MANAGER_ABI,
        functionName: 'getBForMarket',
        args: [market.id_numeric]
      });

      console.log(`✅ Status:`);
      console.log(`   - isLive: ${isLive}`);
      console.log(`   - isSettled: ${isSettled}`);
      console.log(`   - Status (Derived): ${isSettled ? 'SETTLED' : (isLive ? 'TRADING' : 'COOLDOWN/PAUSED')}`);
      
      console.log(`📊 AMM State:`);
      console.log(`   - qYes: ${ammState[0]}`);
      console.log(`   - qNo:  ${ammState[1]}`);
      console.log(`   - b:    ${bParam} (${formatUnits(bParam, 18)})`);

    } catch (error) {
      console.error(`❌ Error fetching data:`, error.message);
    }
    console.log('\n-----------------------------------\n');
  }
}

main().catch(console.error);

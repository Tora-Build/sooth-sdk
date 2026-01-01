/**
 * Market Commands
 * create, graduate, status, simulate
 */

import type { CommandContext, CommandResult } from './types';
import { ABIS, WAD, MAX_UINT256 } from '../config';
import {
  formatWad,
  parseWad,
  shortAddress,
  shortTx,
  Spinner,
  success,
  error,
  dim,
  bold,
  info,
  warn,
  printTable,
  sleep,
} from '../utils';
import { keccak256, encodeAbiParameters, parseAbiParameters, parseAbi, encodeDeployData } from 'viem';

// TruthMarket bytecode from compiled artifacts
const TRUTH_MARKET_BYTECODE = '0x60806040523461038b57610ef2803803806100198161038f565b92833981019060808183031261038b5780516001600160401b03811161038b57810182601f8201121561038b578051906001600160401b0382116102a85761006a601f8301601f191660200161038f565b938285526020838301011161038b57815f9260208093018387015e8401015260208101516001600160401b038116919082900361038b576100b960606100b2604084016103b4565b92016103b4565b42831115610346576001600160a01b03821615610301576001600160a01b03169182156102bc5783516001600160401b0381116102a857600154600181811c9116801561029e575b602082101461028a57601f8111610227575b50602094601f82116001146101c4579481929394955f926101b9575b50508160011b915f199060031b1c1916176001555b600280546001600160e01b03191690911733604090811b600160401b600160e01b039081169290921790925560038054600160401b600160e01b03191693831b90911692909217909155600480546001600160a01b031916929092179091555f805460ff1916905551610b2990816103c98239f35b015190505f8061012f565b601f1982169560015f52805f20915f5b88811061020f575083600195969798106101f7575b505050811b01600155610144565b01515f1960f88460031b161c191690555f80806101e9565b919260206001819286850151815501940192016101d4565b60015f527fb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6601f830160051c81019160208410610280575b601f0160051c01905b8181106102755750610113565b5f8155600101610268565b909150819061025f565b634e487b7160e01b5f52602260045260245ffd5b90607f1690610101565b634e487b7160e01b5f52604160045260245ffd5b60405162461bcd60e51b815260206004820152601a60248201527f54727574684d61726b65743a207a65726f20677561726469616e0000000000006044820152606490fd5b60405162461bcd60e51b815260206004820152601d60248201527f54727574684d61726b65743a207a65726f2061646a7564696361746f720000006044820152606490fd5b60405162461bcd60e51b815260206004820152601d60248201527f54727574684d61726b65743a20646561646c696e6520696e20706173740000006044820152606490fd5b5f80fd5b6040519190601f01601f191682016001600160401b038111838210176102a857604052565b51906001600160a01b038216820361038b5756fe6080806040526004361015610012575f80fd5b5f3560e01c90816302d05d3f14610984575080630f15f4c01461084057806329dcb0cf146108185780633270bb5b146107d65780633fad9ae01461069d578063452a9320146106755780634bb278f3146105a257806353c2ed8e1461057857806359217ba3146105505780638d4e40831461052457806396f25d42146104c55780639b34ae03146104a2578063aed4119114610477578063b43e2afd14610252578063b8f7a6651461020a578063c19d93fb146101e25763ef9b78c6146100d7575f80fd5b346101de575f3660031901126101de576004546001600160a01b0316330361019d5760ff5f5416600581101561018957600361011391146109ba565b60028054600380545f805460ff19168517905560ff60e01b1983169093556001600160401b03198316905560405130927fd928781d9dc29331b3bb4199b6c4b9e4ae738cd00bf919b6ad1c85b321a68ff3928291610184916001600160401b03919091169060e01c60ff1683610ad6565b0390a2005b634e487b7160e01b5f52602160045260245ffd5b60405162461bcd60e51b81526020600482015260196024820152782a393aba3426b0b935b2ba1d103737ba1033bab0b93234b0b760391b6044820152606490fd5b5f80fd5b346101de575f3660031901126101de5760ff5f54166040516005821015610189576020918152f35b346101de575f3660031901126101de5760ff5f54166005811015610189576001148061023e575b6020906040519015158152f35b506002546001600160401b03164210610231565b346101de5760403660031901126101de5761026b6109aa565b6024356001600160401b038116908181036101de57600354604081901c6001600160a01b031633036104335760ff5f541660058110156101895760018114908115610428575b50156103eb576102c7600260ff86161115610a01565b82610338575b6002805460ff60e01b191660e086901b60ff60e01b161790556001600160401b03191690911760039081555f805460ff1916909117905560405130927f1d70fe3b705dff19e2f3638f5308ff5245252369594c794c78dccb6b01dec503928291610184919083610ad6565b904283116103a7576002546001600160401b0316831161035857906102cd565b60405162461bcd60e51b815260206004820152602160248201527f54727574684d61726b65743a20745374617220616674657220646561646c696e6044820152606560f81b6064820152608490fd5b60405162461bcd60e51b815260206004820152601c60248201527b54727574684d61726b65743a20745374617220696e2066757475726560201b6044820152606490fd5b60405162461bcd60e51b815260206004820152601560248201527454727574684d61726b65743a206e6f74206c69766560581b6044820152606490fd5b6002915014856102b1565b60405162461bcd60e51b815260206004820152601c60248201527b2a393aba3426b0b935b2ba1d103737ba1030b2353ab234b1b0ba37b960211b6044820152606490fd5b346101de5760203660031901126101de57602061049a6104956109aa565b610a4c565b604051908152f35b346101de575f3660031901126101de57602060ff60025460e01c16604051908152f35b346101de575f3660031901126101de5760ff5f541660058110156101895780600160209214908161050e575b8115610503575b506040519015158152f35b6002915014826104f8565b6002546001600160401b031642101591506104f1565b346101de575f3660031901126101de5760ff5f5416600581101561018957602090600460405191148152f35b346101de575f3660031901126101de576003546040516001600160401b039091168152602090f35b346101de575f3660031901126101de576003546040805191901c6001600160a01b03168152602090f35b346101de575f3660031901126101de576003543360409190911c6001600160a01b0316148015610661575b1561061e5760ff5f541660058110156101895760036105ec91146109ba565b600460ff195f5416175f55307fea680de9d32012ab006cb4c36859d95875bc1fda742aabcc8810fe82e4309e6d5f80a2005b60405162461bcd60e51b815260206004820152601b60248201527a151c9d5d1a13585c9ad95d0e881b9bdd08185d5d1a1bdc9a5e9959602a1b6044820152606490fd5b506004546001600160a01b031633146105cd565b346101de575f3660031901126101de576004546040516001600160a01b039091168152602090f35b346101de575f3660031901126101de576040515f600154908160011c600183169283156107cc575b6020821084146107b857818552602085019390811561079f5750600114610749575b50829003601f01601f19168201916001600160401b03831181841017610735576040918391828452602083525180918160208501528484015e5f828201840152601f01601f19168101030190f35b634e487b7160e01b5f52604160045260245ffd5b60015f9081529091507fb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf65b828210610789575060209150830101836106e7565b6001816020925483858901015201910190610774565b60ff1916845250151560051b83016020019050836106e7565b634e487b7160e01b5f52602260045260245ffd5b90607f16906106c5565b346101de575f3660031901126101de5760ff5f54166005811015610189578060036020921490811561080d57506040519015158152f35b6004915014826104f8565b346101de575f3660031901126101de576002546040516001600160401b039091168152602090f35b346101de575f3660031901126101de57600254604081901c6001600160a01b031633036109445760ff5f5416600581101561018957610904576001600160401b03164210156108c257600160ff195f5416175f556040514281527f58a8b7fba1050fb318f768a3c190f08d007439609907800ff8d7b97763556ab760203092a2005b60405162461bcd60e51b815260206004820152601a60248201527954727574684d61726b65743a207061737420646561646c696e6560301b6044820152606490fd5b60405162461bcd60e51b8152602060048201526018602482015277151c9d5d1a13585c9ad95d0e881b9bdd0818dc99585d195960421b6044820152606490fd5b60405162461bcd60e51b81526020600482015260186024820152772a393aba3426b0b935b2ba1d103737ba1031b932b0ba37b960411b6044820152606490fd5b346101de575f3660031901126101de5760025460401c6001600160a01b03168152602090f35b6004359060ff821682036101de57565b156109c157565b60405162461bcd60e51b8152602060048201526018602482015277151c9d5d1a13585c9ad95d0e881b9bdd081cd95d1d1b195960421b6044820152606490fd5b15610a0857565b60405162461bcd60e51b815260206004820152601c60248201527b54727574684d61726b65743a20696e76616c6964206f7574636f6d6560201b6044820152606490fd5b60ff5f541690600582101561018957610a7382600360ff9414908115610acb575b506109ba565b16610a816001821115610a01565b60025460e01c60ff1680610aa45750610aa057670de0b6b3a764000090565b5f90565b600103610abe57600103610aa057670de0b6b3a764000090565b506706f05b59d3b2000090565b60049150145f610a6d565b60ff90911681526001600160401b0390911660208201526040019056fea2646970667358221220a6820373129387216c7e468fffd1af5ae03f41830982f5d0e2ff4205bebb82e264736f6c634300081e0033' as `0x${string}`;

const TruthMarketAbiForDeploy = parseAbi([
  'constructor(string question, uint64 deadline, address adjudicator, address guardian)',
]);

// Extended ABIs for market operations
const TruthMarketAbi = parseAbi([
  'function question() view returns (string)',
  'function deadline() view returns (uint64)',
  'function creator() view returns (address)',
  'function adjudicator() view returns (address)',
  'function isLive() view returns (bool)',
  'function isSettled() view returns (bool)',
  'function winningOutcome() view returns (uint8)',
  'function activate() external',
  'constructor(string question, uint64 deadline, address adjudicator, address guardian)',
]);

const CollateralizerAbi = parseAbi([
  'function registerMarket(address market, string name, string symbol) external returns (address yesToken, address noToken)',
  'function getOutcomeTokens(address market) view returns (address yesToken, address noToken)',
]);

const LaunchpadEngineAbi = parseAbi([
  'function createMarket(address market, uint256 initialLiquidity, string name, string symbol) external returns (uint256 lpTokens)',
  'function markets(address) view returns (address creator, uint256 bBase, uint256 bCurrent, uint256 creatorDeposit, uint256 feesAccrued, uint256 totalLPSupply, uint256 lpYieldPool, bool isGraduated, uint64 createdAt, uint64 graduatedAt, string name, string symbol)',
  'function getGraduationProgress(address market) view returns (uint256 feesAccrued, uint256 threshold, uint256 percentComplete)',
  'function tradePositions(address market, uint8 outcome, int256 deltaShares, uint256 maxCost) external returns (uint256)',
  'function preGradFeeBps() view returns (uint16)',
  'function postGradFeeBps() view returns (uint16)',
]);

const AMMEngineAbi = parseAbi([
  'function getPrice(address market, uint8 outcome) view returns (uint256)',
  'function getPosition(address market, address user) view returns (uint256 yesShares, uint256 noShares)',
]);

// Predefined market templates
const MARKET_TEMPLATES: Record<string, { question: string; name: string; symbol: string; deadlineDays: number }> = {
  alien: {
    question: 'Will UN confirm alien life by 2026?',
    name: 'UN Confirms Alien Life',
    symbol: 'ALIEN',
    deadlineDays: 365,
  },
  btc100k: {
    question: 'Will BTC reach $100k by end of 2025?',
    name: 'BTC Reaches 100k',
    symbol: 'BTC100K',
    deadlineDays: 180,
  },
  custom: {
    question: '',
    name: '',
    symbol: '',
    deadlineDays: 30,
  },
};

/**
 * Create a new market from scratch
 * Usage: createmarket <template> [liquidity]
 *
 * Example: createmarket alien 500
 * Example: createmarket btc100k 1000
 */
export async function createmarket(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment } = ctx;
  const walletClient = actorManager.currentWalletClient();
  const address = actorManager.currentAddress();
  const publicClient = actorManager.getPublicClient();

  if (!walletClient || !address) {
    return { success: false, message: 'No actor selected' };
  }

  if (args.length < 1) {
    console.log(`
  ${bold('Create Market')}

  Usage: createmarket <template> [liquidity]

  Templates: ${Object.keys(MARKET_TEMPLATES).join(', ')}

  ${info('Examples:')}
    createmarket alien 500      Create ALIEN market with 500 USDC
    createmarket btc100k 1000   Create BTC100K market with 1000 USDC

  ${dim('This will:')}
    1. Deploy TruthMarket contract
    2. Activate it
    3. Initialize in LaunchpadEngine
`);
    return { success: true };
  }

  const templateName = args[0].toLowerCase();
  const template = MARKET_TEMPLATES[templateName];

  if (!template) {
    return { success: false, message: `Unknown template: ${templateName}. Available: ${Object.keys(MARKET_TEMPLATES).join(', ')}` };
  }

  if (templateName === 'custom') {
    return { success: false, message: 'Custom template not yet supported. Use alien or btc100k.' };
  }

  // Parse liquidity as LMSR 'b' parameter (WAD, 18 decimals)
  // User specifies in whole units, e.g., "500" = 500 WAD = 500e18
  const liquidityWad = args[1] ? BigInt(Math.floor(parseFloat(args[1]))) * WAD : 500n * WAD;

  console.log(`\n  ${bold('Creating Market: ' + template.symbol)}`);
  console.log('  ' + '═'.repeat(50));
  console.log(`  Question:  ${template.question}`);
  console.log(`  Name:      ${template.name}`);
  console.log(`  Symbol:    ${template.symbol}`);
  console.log(`  Liquidity: ${formatWad(liquidityWad)} (b parameter)`);
  console.log(`  Deadline:  ${template.deadlineDays} days from now`);
  console.log('');

  try {
    // Step 1: Check USDC balance
    const usdcBalance = await publicClient.readContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'balanceOf',
      args: [address],
    }) as bigint;

    // Estimate required USDC: b × ln(2) in USDC decimals
    // LaunchpadEngine calculates: depositWad = (b × LN2_WAD) / WAD, then converts to USDC
    const LN2_WAD = 693147180559945309n; // ln(2) × 1e18
    const requiredWad = (liquidityWad * LN2_WAD) / WAD;
    const required = (requiredWad + WAD / 10n ** 12n - 1n) / (WAD / 10n ** 12n); // WAD to USDC ceil
    if (usdcBalance < required) {
      console.log(warn(`  Insufficient USDC. Minting ${(Number(required) / 1e6).toFixed(2)} USDC...`));
      const mintHash = await walletClient.writeContract({
        address: deployment.contracts.MockUSDC as `0x${string}`,
        abi: ABIS.MockUSDC,
        functionName: 'mint',
        args: [address, required * 2n],
      });
      await actorManager.waitForTransactionReceipt(mintHash);
      console.log(success('  Minted USDC'));
    }

    // Step 2: Deploy TruthMarket
    const spinner1 = new Spinner('[1/4] Deploying TruthMarket...');
    spinner1.start();

    const deadline = BigInt(Math.floor(Date.now() / 1000) + template.deadlineDays * 24 * 60 * 60);

    // Encode constructor args
    const deployData = encodeDeployData({
      abi: TruthMarketAbiForDeploy,
      bytecode: TRUTH_MARKET_BYTECODE,
      args: [template.question, deadline, address, address], // adjudicator & guardian = deployer
    });

    const deployHash = await walletClient.sendTransaction({
      data: deployData,
    });

    const deployReceipt = await actorManager.waitForTransactionReceipt(deployHash);
    const truthMarketAddr = deployReceipt.contractAddress as `0x${string}`;

    if (!truthMarketAddr) {
      spinner1.fail('Failed to deploy TruthMarket');
      return { success: false, message: 'Contract deployment failed - no address returned' };
    }

    spinner1.succeed(`TruthMarket deployed: ${shortAddress(truthMarketAddr)}`);

    // Step 3: Activate TruthMarket
    const spinner2 = new Spinner('[2/4] Activating TruthMarket...');
    spinner2.start();

    const activateHash = await walletClient.writeContract({
      address: truthMarketAddr,
      abi: TruthMarketAbi,
      functionName: 'activate',
      args: [],
    });
    await actorManager.waitForTransactionReceipt(activateHash);
    spinner2.succeed('TruthMarket activated');

    // Step 4: Approve USDC for LaunchpadEngine
    const spinner3 = new Spinner('[3/4] Approving USDC...');
    spinner3.start();

    const approveHash = await walletClient.writeContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'approve',
      args: [deployment.contracts.LaunchpadEngine as `0x${string}`, MAX_UINT256],
    });
    await actorManager.waitForTransactionReceipt(approveHash);
    spinner3.succeed('USDC approved');

    // Step 5: Initialize in LaunchpadEngine
    const spinner4 = new Spinner('[4/4] Creating market in LaunchpadEngine...');
    spinner4.start();

    const createHash = await walletClient.writeContract({
      address: deployment.contracts.LaunchpadEngine as `0x${string}`,
      abi: LaunchpadEngineAbi,
      functionName: 'createMarket',
      args: [truthMarketAddr, liquidityWad, template.name, template.symbol],
    });

    const createReceipt = await actorManager.waitForTransactionReceipt(createHash);
    spinner4.succeed(`Market initialized in LaunchpadEngine ${dim(`(gas: ${createReceipt.gasUsed})`)}`);

    console.log('');
    console.log('  ' + '═'.repeat(50));
    console.log(`  ${success('MARKET CREATED SUCCESSFULLY!')}`);
    console.log('');
    console.log(`  TruthMarket: ${truthMarketAddr}`);
    console.log(`  Name:        ${template.name}`);
    console.log(`  Symbol:      ${template.symbol}`);
    console.log('');
    console.log(`  ${info('Next steps:')}`);
    console.log(`    setmarket ${truthMarketAddr}`);
    console.log(`    marketstatus`);
    console.log('');

    return {
      success: true,
      txHash: createHash,
      data: { marketAddress: truthMarketAddr }
    };
  } catch (err) {
    return { success: false, message: `Market creation failed: ${(err as Error).message}` };
  }
}

/**
 * Graduate a market by executing trades to accumulate fees
 * Usage: graduate [steps]
 * Example: graduate      (default 8 steps)
 * Example: graduate 5    (5 steps to reach 110% of threshold)
 *
 * Auto-calculates trade size to reach 110% of graduation threshold
 */
export async function graduate(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketAddress } = ctx;
  const walletClient = actorManager.currentWalletClient();
  const address = actorManager.currentAddress();
  const publicClient = actorManager.getPublicClient();

  if (!walletClient || !address) {
    return { success: false, message: 'No actor selected' };
  }

  if (!marketAddress) {
    return { success: false, message: 'No market selected. Use: setmarket <address>' };
  }

  // Get current graduation status
  let progress: [bigint, bigint, bigint];
  try {
    progress = await publicClient.readContract({
      address: deployment.contracts.LaunchpadEngine as `0x${string}`,
      abi: LaunchpadEngineAbi,
      functionName: 'getGraduationProgress',
      args: [marketAddress],
    }) as [bigint, bigint, bigint];
  } catch (err) {
    return { success: false, message: `Market not found in LaunchpadEngine: ${(err as Error).message}` };
  }

  const [feesAccrued, threshold, percentComplete] = progress;

  // Also check if actually graduated on-chain
  const marketState = await publicClient.readContract({
    address: deployment.contracts.LaunchpadEngine as `0x${string}`,
    abi: LaunchpadEngineAbi,
    functionName: 'markets',
    args: [marketAddress],
  }) as [string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, bigint, bigint, string, string];
  const isGraduated = marketState[7];

  // percentComplete is in basis points (10000 = 100%)
  const progressPct = Number(percentComplete) / 100;

  console.log(`\n  ${bold('Graduation Status')}`);
  console.log('  ' + '─'.repeat(40));
  console.log(`  Fees Accrued: ${formatWad(feesAccrued)} USDC`);
  console.log(`  Threshold:    ${formatWad(threshold)} USDC`);
  console.log(`  Progress:     ${progressPct.toFixed(1)}%`);
  console.log(`  Graduated:    ${isGraduated ? success('Yes') : warn('No')}`);

  if (isGraduated) {
    console.log(`\n  ${success('Market is already graduated!')}\n`);
    return { success: true };
  }

  // If fees >= threshold but not graduated, do one small trade to trigger graduation
  if (percentComplete >= 10000n) {
    console.log(`\n  ${warn('Fees reached threshold but not graduated yet. Triggering graduation...')}`);

    // Approve and do a tiny trade to trigger graduation
    const tinyTrade = WAD; // 1 share
    await walletClient.writeContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'approve',
      args: [deployment.contracts.LaunchpadEngine as `0x${string}`, MAX_UINT256],
    });

    const hash = await walletClient.writeContract({
      address: deployment.contracts.LaunchpadEngine as `0x${string}`,
      abi: LaunchpadEngineAbi,
      functionName: 'tradePositions',
      args: [marketAddress, 1, tinyTrade, MAX_UINT256],
      gas: 2000000n,
    });
    await actorManager.waitForTransactionReceipt(hash);

    console.log(`  ${success('MARKET GRADUATED!')}\n`);
    return { success: true };
  }

  // Parse number of steps (default 8)
  const numTrades = args[0] ? parseInt(args[0], 10) : 8;

  // Get fee rate to calculate required volume
  const feeBpsRaw = await publicClient.readContract({
    address: deployment.contracts.LaunchpadEngine as `0x${string}`,
    abi: LaunchpadEngineAbi,
    functionName: 'preGradFeeBps',
  });
  const feeBps = BigInt(feeBpsRaw as bigint);

  // Calculate trade size to reach 110% of threshold
  // Fee = cost * feeBps / 10000
  // Total volume needed = targetFees * 10000 / feeBps
  // Each round-trip has 2 trades (buy + sell), so divide by numTrades * 2
  const remaining = threshold - feesAccrued;
  const targetFees = (remaining * 110n) / 100n; // 110% of remaining

  const numTradesBigInt = BigInt(numTrades);
  // Volume needed = targetFees * 10000 / feeBps
  // IMPORTANT: tradeSize is in SHARES, but fee is charged on COST (USDC spent)
  // With LMSR at ~50% price, cost ≈ 0.5 × shares
  // So we need to double the share amount to get the target cost/fees
  //
  // With alternating BUY/SELL where SELL is half size:
  // - numTrades/2 BUY trades at tradeSize (cost ≈ tradeSize * 0.5)
  // - numTrades/2 SELL trades at tradeSize/2 (cost ≈ tradeSize * 0.25)
  // Total cost ≈ (numTrades/2) * tradeSize * 0.5 + (numTrades/2) * tradeSize * 0.25
  //            = numTrades * tradeSize * 0.375
  // So: tradeSize = volumeNeeded / (0.375 * numTrades) = volumeNeeded * 8 / (3 * numTrades)
  const volumeNeeded = (targetFees * 10000n) / feeBps;
  const tradeSize = (volumeNeeded * 8n) / (3n * numTradesBigInt);

  console.log(`\n  Remaining to graduate: ${formatWad(remaining)} USDC`);
  console.log(`  Target fees (110%):    ${formatWad(targetFees)} USDC`);
  console.log(`  Fee rate:              ${Number(feeBps) / 100}%`);
  console.log(`  Trade size:            ${formatWad(tradeSize)} shares`);
  console.log(`  Steps:                 ${numTrades}`);
  console.log('');

  // Ensure sufficient USDC
  const requiredUsdc = tradeSize * BigInt(numTrades) * 2n; // Rough estimate
  const usdcBalance = await publicClient.readContract({
    address: deployment.contracts.MockUSDC as `0x${string}`,
    abi: ABIS.MockUSDC,
    functionName: 'balanceOf',
    args: [address],
  }) as bigint;

  if (usdcBalance < requiredUsdc) {
    console.log(warn(`  Low USDC balance. Minting more...`));
    const mintHash = await walletClient.writeContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'mint',
      args: [address, requiredUsdc * 2n],
    });
    await actorManager.waitForTransactionReceipt(mintHash);
    console.log(success('  Minted USDC'));
  }

  // Approve LaunchpadEngine
  const approveHash = await walletClient.writeContract({
    address: deployment.contracts.MockUSDC as `0x${string}`,
    abi: ABIS.MockUSDC,
    functionName: 'approve',
    args: [deployment.contracts.LaunchpadEngine as `0x${string}`, MAX_UINT256],
  });
  await actorManager.waitForTransactionReceipt(approveHash);

  // Execute graduation trades
  console.log('  ' + '─'.repeat(40));
  let totalGas = 0n;
  let tradesExecuted = 0;

  for (let i = 0; i < numTrades; i++) {
    // Alternate buy/sell to accumulate fees
    const isBuy = i % 2 === 0;
    const outcome = 1; // YES
    const delta = isBuy ? tradeSize : -tradeSize / 2n;

    const spinner = new Spinner(`  Trade ${i + 1}/${numTrades}: ${isBuy ? 'BUY' : 'SELL'} ${formatWad(delta > 0n ? delta : -delta)} shares...`);
    spinner.start();

    try {
      const hash = await walletClient.writeContract({
        address: deployment.contracts.LaunchpadEngine as `0x${string}`,
        abi: LaunchpadEngineAbi,
        functionName: 'tradePositions',
        args: [marketAddress, outcome, delta, MAX_UINT256],
        gas: 2000000n, // High gas for potential graduation
      });

      const receipt = await actorManager.waitForTransactionReceipt(hash);
      totalGas += receipt.gasUsed;
      tradesExecuted++;

      spinner.succeed(`Trade ${i + 1}: ${isBuy ? 'BUY' : 'SELL'} ${formatWad(delta > 0n ? delta : -delta)} ${dim(`(gas: ${receipt.gasUsed})`)}`);

      // Check if graduated
      const [, , newPercent] = await publicClient.readContract({
        address: deployment.contracts.LaunchpadEngine as `0x${string}`,
        abi: LaunchpadEngineAbi,
        functionName: 'getGraduationProgress',
        args: [marketAddress],
      }) as [bigint, bigint, bigint];

      if (newPercent >= 10000n) { // 10000 bps = 100%
        console.log(`\n  ${success('MARKET GRADUATED!')} after ${tradesExecuted} trades\n`);
        return { success: true, data: { tradesExecuted, totalGas } };
      }
    } catch (err) {
      spinner.fail(`Trade ${i + 1} failed: ${(err as Error).message.slice(0, 50)}`);
      // Continue trying
    }

    await sleep(500); // Brief pause between trades
  }

  // Final status
  const [finalFees, finalThreshold, finalPercent] = await publicClient.readContract({
    address: deployment.contracts.LaunchpadEngine as `0x${string}`,
    abi: LaunchpadEngineAbi,
    functionName: 'getGraduationProgress',
    args: [marketAddress],
  }) as [bigint, bigint, bigint];

  console.log(`\n  Final Progress: ${(Number(finalPercent) / 100).toFixed(1)}%`);
  console.log(`  Fees: ${formatWad(finalFees)} / ${formatWad(finalThreshold)} USDC`);
  console.log(`  Total gas used: ${totalGas.toString()}`);
  console.log('');

  return { success: true, data: { tradesExecuted, totalGas, percentComplete: Number(finalPercent) / 100 } };
}

/**
 * Show comprehensive market status
 * Usage: marketstatus [address]
 */
export async function marketstatus(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketAddress: ctxMarket } = ctx;
  const publicClient = actorManager.getPublicClient();

  const marketAddress = args[0] ? args[0] as `0x${string}` : ctxMarket;

  if (!marketAddress) {
    return { success: false, message: 'No market address. Use: marketstatus <address> or setmarket first' };
  }

  console.log(`\n  ${bold('Market Status')}: ${shortAddress(marketAddress)}`);
  console.log('  ' + '═'.repeat(50));

  // 1. TruthMarket Status
  console.log(`\n  ${info('TruthMarket')}`);
  console.log('  ' + '─'.repeat(40));

  try {
    const [question, deadline, creator, adjudicator, isLive, isSettled] = await Promise.all([
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'question' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'deadline' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'creator' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'adjudicator' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'isLive' }),
      publicClient.readContract({ address: marketAddress, abi: TruthMarketAbi, functionName: 'isSettled' }),
    ]);

    const deadlineDate = new Date(Number(deadline) * 1000);
    const isActive = isLive && !isSettled;

    console.log(`  Question:   ${(question as string).slice(0, 50)}${(question as string).length > 50 ? '...' : ''}`);
    console.log(`  Creator:    ${shortAddress(creator as string)}`);
    console.log(`  Adjudicator: ${shortAddress(adjudicator as string)}`);
    console.log(`  Deadline:   ${deadlineDate.toISOString().slice(0, 10)}`);
    console.log(`  Status:     ${isActive ? success('LIVE') : isSettled ? dim('SETTLED') : warn('INACTIVE')}`);

    if (isSettled) {
      const winningOutcome = await publicClient.readContract({
        address: marketAddress,
        abi: TruthMarketAbi,
        functionName: 'winningOutcome',
      });
      console.log(`  Winner:     ${winningOutcome === 1 ? 'YES' : winningOutcome === 0 ? 'NO' : 'INVALID'}`);
    }
  } catch (err) {
    console.log(`  ${error('Not a TruthMarket or not deployed')}`);
    return { success: false, message: 'Failed to read TruthMarket' };
  }

  // 2. Collateralizer Status
  console.log(`\n  ${info('Collateralizer')}`);
  console.log('  ' + '─'.repeat(40));

  try {
    const [yesToken, noToken] = await publicClient.readContract({
      address: deployment.contracts.Collateralizer as `0x${string}`,
      abi: CollateralizerAbi,
      functionName: 'getOutcomeTokens',
      args: [marketAddress],
    }) as [string, string];

    const registered = yesToken !== '0x0000000000000000000000000000000000000000';
    console.log(`  Registered: ${registered ? success('YES') : warn('NO')}`);
    if (registered) {
      console.log(`  YES Token:  ${shortAddress(yesToken)}`);
      console.log(`  NO Token:   ${shortAddress(noToken)}`);
    }
  } catch {
    console.log(`  Registered: ${warn('NO')}`);
  }

  // 3. LaunchpadEngine Status
  console.log(`\n  ${info('LaunchpadEngine (AMM)')}`);
  console.log('  ' + '─'.repeat(40));

  try {
    const marketState = await publicClient.readContract({
      address: deployment.contracts.LaunchpadEngine as `0x${string}`,
      abi: LaunchpadEngineAbi,
      functionName: 'markets',
      args: [marketAddress],
    }) as any;

    const initialized = marketState[0] !== '0x0000000000000000000000000000000000000000';

    if (initialized) {
      console.log(`  Initialized: ${success('YES')}`);
      console.log(`  Creator:     ${shortAddress(marketState[0])}`);
      console.log(`  bBase:       ${formatWad(marketState[1])}`);
      console.log(`  bCurrent:    ${formatWad(marketState[2])}`);
      console.log(`  Deposit:     ${(Number(marketState[3]) / 1e6).toFixed(2)} USDC`);
      console.log(`  Fees:        ${formatWad(marketState[4])} USDC`);
      console.log(`  LP Supply:   ${formatWad(marketState[5])}`);
      console.log(`  Graduated:   ${marketState[7] ? success('YES') : warn('NO')}`);

      if (!marketState[7]) {
        const [feesAccrued, threshold, percent] = await publicClient.readContract({
          address: deployment.contracts.LaunchpadEngine as `0x${string}`,
          abi: LaunchpadEngineAbi,
          functionName: 'getGraduationProgress',
          args: [marketAddress],
        }) as [bigint, bigint, bigint];

        console.log(`  Progress:    ${(Number(percent) / 100).toFixed(1)}% (${formatWad(feesAccrued)}/${formatWad(threshold)} USDC)`);
      }

      // Get current price
      try {
        const yesPrice = await publicClient.readContract({
          address: deployment.contracts.AMMEngine as `0x${string}`,
          abi: AMMEngineAbi,
          functionName: 'getPrice',
          args: [marketAddress, 1],
        }) as bigint;

        console.log(`  YES Price:   ${(Number(yesPrice) / 1e18 * 100).toFixed(2)}%`);
      } catch {
        // Price not available
      }
    } else {
      console.log(`  Initialized: ${warn('NO')}`);
    }
  } catch {
    console.log(`  Initialized: ${warn('NO')}`);
  }

  // 4. TickBook Status
  console.log(`\n  ${info('TickBook (Orderbook)')}`);
  console.log('  ' + '─'.repeat(40));

  try {
    // Try to get market info from TickBook
    // This would need the marketKey
    console.log(`  ${dim('Use "state" command with market set')}`);
  } catch {
    console.log(`  Registered: ${warn('NO')}`);
  }

  console.log('');
  return { success: true };
}

/**
 * Simulate realistic orderbook fills
 * Usage: simulate [numOrders] [avgSize]
 * Example: simulate 20 100
 */
export async function simulate(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketKey, marketAddress } = ctx;
  const walletClient = actorManager.currentWalletClient();
  const address = actorManager.currentAddress();
  const publicClient = actorManager.getPublicClient();

  if (!walletClient || !address) {
    return { success: false, message: 'No actor selected' };
  }

  if (!marketKey || !marketAddress) {
    return { success: false, message: 'No market selected. Use: setmarket <address>' };
  }

  const numOrders = args[0] ? parseInt(args[0], 10) : 10;
  const avgSize = args[1] ? parseWad(args[1]) : 100n * WAD;
  const seed = args[2] ? Number(args[2]) : Date.now();
  const rng = (() => {
    // Deterministic PRNG (mulberry32)
    let t = (seed >>> 0) || 1;
    return () => {
      t += 0x6d2b79f5;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  })();

  if (!Number.isFinite(numOrders) || numOrders <= 0) {
    return {
      success: false,
      message: 'Usage: simulate [numOrders] [avgSize] [seed]\n  Example: simulate 20 100 123',
    };
  }

  // Ensure TickBook market is active/registered for this marketKey
  try {
    const [truthMarket, yesToken, noToken] = await publicClient.readContract({
      address: deployment.contracts.TickBookPoolManager as `0x${string}`,
      abi: ABIS.TickBookPoolManager,
      functionName: 'getMarketInfo',
      args: [marketKey],
    }) as [string, string, string, string];

    const active =
      truthMarket !== '0x0000000000000000000000000000000000000000' &&
      yesToken !== '0x0000000000000000000000000000000000000000' &&
      noToken !== '0x0000000000000000000000000000000000000000';

    if (!active) {
      return {
        success: false,
        message: 'TickBook marketKey is not active/registered. Ensure the market is graduated and registered into TickBook, then re-run setmarket.',
      };
    }
  } catch (err) {
    return { success: false, message: `Failed to validate TickBook marketKey: ${(err as Error).message}` };
  }

  console.log(`\n  ${bold('Orderbook Simulation')}`);
  console.log('  ' + '─'.repeat(50));
  console.log(`  Orders to place: ${numOrders}`);
  console.log(`  Average size: ${formatWad(avgSize)} shares`);
  console.log(`  Seed: ${seed}`);
  console.log('');

  // Ensure sufficient vault balance - ALWAYS deposit enough for simulation
  const available = await publicClient.readContract({
    address: deployment.contracts.TickBookVault as `0x${string}`,
    abi: ABIS.TickBookVault,
    functionName: 'availableUsdcWad',
    args: [address],
  }) as bigint;

  // Increase buffer for randomized order sizes (50%-150% of avg) + market orders
  const requiredBalance = avgSize * BigInt(numOrders) * 10n; // 10x buffer

  console.log(dim(`  Current vault balance: ${formatWad(available)} USDC`));

  if (available < requiredBalance) {
    console.log(warn(`  Insufficient vault balance. Depositing ${formatWad(requiredBalance)}...`));

    // Mint USDC
    const mintHash = await walletClient.writeContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'mint',
      args: [address, requiredBalance * 2n],
    });
    await actorManager.waitForTransactionReceipt(mintHash);

    // Approve vault
    const approveHash = await walletClient.writeContract({
      address: deployment.contracts.MockUSDC as `0x${string}`,
      abi: ABIS.MockUSDC,
      functionName: 'approve',
      args: [deployment.contracts.TickBookVault as `0x${string}`, MAX_UINT256],
    });
    await actorManager.waitForTransactionReceipt(approveHash);

    // Deposit to vault (depositUsdc takes USDC amount in 6 decimals, not WAD)
    // Convert WAD to USDC: divide by 1e12
    const depositUsdc = requiredBalance * 2n / (10n ** 12n);
    const depositHash = await walletClient.writeContract({
      address: deployment.contracts.TickBookVault as `0x${string}`,
      abi: ABIS.TickBookVault,
      functionName: 'depositUsdc',
      args: [depositUsdc],
    });
    await actorManager.waitForTransactionReceipt(depositHash);

    // Verify new balance
    const newBalance = await publicClient.readContract({
      address: deployment.contracts.TickBookVault as `0x${string}`,
      abi: ABIS.TickBookVault,
      functionName: 'availableUsdcWad',
      args: [address],
    }) as bigint;
    console.log(success(`  Deposited. New balance: ${formatWad(newBalance)} USDC`));
  }

  // Place orders at various price levels
  console.log('  ' + '─'.repeat(50));
  console.log(`  ${bold('Phase 1: Placing Limit Orders')}`);

  const placedOrders: {
    orderId: bigint;
    outcome: number;
    tickLower: number;
    tickUpper: number;
    shares: bigint;
    filledShares: bigint;
    filledCost: bigint;
    restingShares: bigint;
    txHash: `0x${string}`;
  }[] = [];

  const writePlaceOrder = async (params: {
    outcome: number;
    shares: bigint;
    tickLower: number;
    tickUpper: number;
    maxCost: bigint;
  }) => {
    // Direct writeContract (no simulateContract) for RPC compatibility
    const txHash = await walletClient.writeContract({
      address: deployment.contracts.TickBookPoolManager as `0x${string}`,
      abi: ABIS.TickBookPoolManager,
      functionName: 'placeOrder',
      args: [marketKey, params.outcome, params.shares, params.tickLower, params.tickUpper, params.maxCost],
    });

    const receipt = await actorManager.waitForTransactionReceipt(txHash);

    // Parse return values from logs (PlaceOrder event)
    // For now, return placeholder values - the order is placed successfully
    // TODO: Parse actual return values from receipt logs
    return {
      txHash,
      result: [0n, 0n, 0n, params.shares] as [bigint, bigint, bigint, bigint], // orderId, filled, cost, resting
    };
  };

  // Debug: show first order params
  const debugFirstOrder = true;

  for (let i = 0; i < numOrders; i++) {
    // Randomize order parameters
    const outcome = i % 2; // Alternate YES/NO (0=NO, 1=YES)
    const baseTickLower = 200 + (i % 5) * 100; // 200, 300, 400, 500, 600
    const tickLower = baseTickLower + Math.floor(rng() * 50);
    const tickUpper = tickLower + 50 + Math.floor(rng() * 50);
    const shares = (avgSize * BigInt(50 + Math.floor(rng() * 100))) / 100n; // 50%-150% of avg
    const maxCost = shares * 2n; // 200% slippage tolerance

    // Debug output for first order
    if (debugFirstOrder && i === 0) {
      console.log(dim(`  Debug: marketKey=${(marketKey as string).slice(0, 18)}...`));
      console.log(dim(`  Debug: outcome=${outcome}, shares=${shares.toString()}, tickLower=${tickLower}, tickUpper=${tickUpper}, maxCost=${maxCost.toString()}`));
    }

    const spinner = new Spinner(`  Order ${i + 1}/${numOrders}: ${outcome === 1 ? 'YES' : 'NO'} [${(tickLower / 10).toFixed(1)}%-${(tickUpper / 10).toFixed(1)}%] ${formatWad(shares)}...`);
    spinner.start();

    try {
      // V9.9.6: Use unified placeOrder API
      const { txHash, result } = await writePlaceOrder({ outcome, shares, tickLower, tickUpper, maxCost });
      const [orderId, filledShares, filledCost, restingShares] = result as [bigint, bigint, bigint, bigint];

      spinner.succeed(
        `Order ${i + 1}: #${orderId} ${outcome === 1 ? 'YES' : 'NO'} [${(tickLower / 10).toFixed(1)}%-${(tickUpper / 10).toFixed(1)}%] ${formatWad(shares)} (filled: ${formatWad(filledShares)}, resting: ${formatWad(restingShares)})`
      );

      placedOrders.push({ orderId, outcome, tickLower, tickUpper, shares, filledShares, filledCost, restingShares, txHash });
    } catch (err) {
      const errMsg = (err as Error).message;
      // Extract revert reason if present
      const revertMatch = errMsg.match(/reverted with.*?["']([^"']+)["']/i)
        || errMsg.match(/reason:\s*([^\n]+)/i)
        || errMsg.match(/Error:\s*([^\n]+)/i);
      const shortErr = revertMatch ? revertMatch[1] : errMsg.slice(0, 80);
      spinner.fail(`Order ${i + 1} failed: ${shortErr}`);

      // Show full error on first failure for debugging
      if (i === 0) {
        console.log(dim(`  Full error: ${errMsg.slice(0, 300)}`));
      }
    }

    await sleep(200);
  }

  // Execute market orders to cross liquidity
  // Only run if we placed some limit orders to fill against
  console.log('');
  console.log(`  ${bold('Phase 2: Executing Market Orders')}`);

  let marketOrdersExecuted = 0;
  let totalRequested = 0n;
  let totalFilled = 0n;
  let totalCost = 0n;

  if (placedOrders.length === 0) {
    console.log(dim('  Skipping - no limit orders to fill against'));
  } else {
    const numMarketOrders = Math.min(Math.floor(numOrders / 3), placedOrders.length);

    for (let i = 0; i < numMarketOrders; i++) {
      // Target opposite side of a placed order
      const targetOrder = placedOrders[i % placedOrders.length];
      const outcome = targetOrder.outcome === 1 ? 0 : 1; // Opposite side
      const shares = (avgSize * BigInt(20 + Math.floor(rng() * 30))) / 100n; // Smaller size (20-50%)
      totalRequested += shares;

      const spinner = new Spinner(`  Market ${i + 1}/${numMarketOrders}: BUY ${outcome === 1 ? 'YES' : 'NO'} ${formatWad(shares)}...`);
      spinner.start();

      try {
        // V9.9.6: Market orders use placeOrder with full tick range (1-999)
        const maxCost = shares * 2n;
        const { result } = await writePlaceOrder({ outcome, shares, tickLower: 1, tickUpper: 999, maxCost });
        const [, filledShares, filledCost] = result as [bigint, bigint, bigint, bigint];

        marketOrdersExecuted++;
        totalFilled += filledShares;
        totalCost += filledCost;
        spinner.succeed(
          `Market ${i + 1}: BUY ${outcome === 1 ? 'YES' : 'NO'} ${formatWad(shares)} (filled: ${formatWad(filledShares)}, cost: ${formatWad(filledCost)})`
        );
      } catch (err) {
        spinner.fail(`Market ${i + 1} failed: ${(err as Error).message.slice(0, 50)}`);
      }

      await sleep(200);
    }
  }

  // Summary
  console.log('');
  console.log('  ' + '─'.repeat(50));
  console.log(`  ${bold('Simulation Complete')}`);
  console.log(`  Limit orders placed: ${placedOrders.length}`);
  console.log(`  Market orders executed: ${marketOrdersExecuted}`);
  console.log(`  Market shares requested: ${formatWad(totalRequested)}`);
  console.log(`  Market shares filled:    ${formatWad(totalFilled)}`);
  console.log(`  Total cost:              ${formatWad(totalCost)} USDC`);
  console.log('');

  return { success: true, data: { placedOrders: placedOrders.length, marketOrders: marketOrdersExecuted, totalRequested, totalFilled, totalCost } };
}

export const marketCommands = {
  createmarket,
  graduate,
  marketstatus,
  simulate,
};

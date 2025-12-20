// @ts-nocheck
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '../../packages/contracts-evm/.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MegaETH Frontier Net chain definition
const megaethFrontier = defineChain({
    id: 4326,
    name: 'MegaETH Frontier',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
        default: { http: [process.env.MEGAETH_FRONTIER_RPC_URL || 'https://mainnet.megaeth.com/rpc'] },
    },
    blockExplorers: {
        default: { name: 'MegaExplorer', url: 'https://explorer.megaeth.com' },
    },
    testnet: false,
});

// Load contract ABIs and bytecode from forge output
function loadArtifact(contractName: string) {
    const artifactPath = path.join(__dirname, `../../../packages/contracts-evm/out/${contractName}.sol/${contractName}.json`);
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    return {
        abi: artifact.abi,
        bytecode: artifact.bytecode.object as `0x${string}`,
    };
}

async function deployContract(
    walletClient: any,
    publicClient: any,
    contractName: string,
    constructorArgs: any[] = []
) {
    const { abi, bytecode } = loadArtifact(contractName);

    console.log(`Deploying ${contractName}...`);

    const hash = await walletClient.deployContract({
        abi,
        bytecode,
        args: constructorArgs,
        gas: 999999999n, // MegaETH requires explicit high gas limit
    });

    console.log(`  TX Hash: ${hash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  Deployed at: ${receipt.contractAddress}`);

    return receipt.contractAddress;
}

async function callContract(
    walletClient: any,
    publicClient: any,
    contractAddress: string,
    contractName: string,
    functionName: string,
    args: any[]
) {
    const { abi } = loadArtifact(contractName);

    console.log(`  Calling ${functionName} on ${contractName} at ${contractAddress}...`);

    const hash = await walletClient.writeContract({
        address: contractAddress,
        abi,
        functionName,
        args,
        gas: 999999999n,
    });

    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  Done: ${hash}`);
}

async function main() {
    // Get private key from environment
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error('PRIVATE_KEY environment variable required');
    }

    const account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}`);

    const publicClient = createPublicClient({
        chain: megaethFrontier,
        transport: http(),
    });

    const walletClient = createWalletClient({
        account,
        chain: megaethFrontier,
        transport: http(),
    });

    console.log('=== MegaETH V6.1.8 Frontier Deployment ===');
    console.log(`Deployer: ${account.address}`);
    console.log(`Chain ID: ${megaethFrontier.id}`);
    console.log('');

    // Check balance
    const balance = await publicClient.getBalance({ address: account.address });
    console.log(`Balance: ${Number(balance) / 1e18} ETH`);
    console.log('');

    // 1. Deploy Infrastructure
    console.log('=== Infrastructure ===');

    const mockUSDC = await deployContract(walletClient, publicClient, 'MockUSDC', []);

    const feeController = await deployContract(walletClient, publicClient, 'SoothFeeController', [
        account.address, // treasury
    ]);
    await callContract(walletClient, publicClient, feeController, 'SoothFeeController', 'setOrderbookFee', [10n]);

    const liquidityVault = await deployContract(walletClient, publicClient, 'SoothLiquidityVault', [
        mockUSDC,
    ]);

    const traderVault = await deployContract(walletClient, publicClient, 'SoothTraderVaultV4', [
        mockUSDC,
        liquidityVault,
    ]);

    // 2. Deploy Launchpad System
    console.log('\n=== Launchpad System ===');

    const outcomeTokenImpl = await deployContract(walletClient, publicClient, 'LaunchpadOutcomeToken', []);
    const marketImpl = await deployContract(walletClient, publicClient, 'LaunchpadMarket', []);
    const protocolConfig = await deployContract(walletClient, publicClient, 'ProtocolConfig', [
        account.address, // owner
        0n               // initial version
    ]);

    const factory = await deployContract(walletClient, publicClient, 'LaunchpadFactory', [
        marketImpl,
        mockUSDC,
        traderVault,
        feeController,
        outcomeTokenImpl,
        account.address, // treasury
        account.address, // adjudicator
        protocolConfig
    ]);

    // 3. Setup Permissions
    console.log('\n=== Setting Permissions ===');
    await callContract(walletClient, publicClient, liquidityVault, 'SoothLiquidityVault', 'setAuthorized', [traderVault, true]);

    // 4. Create Demo Markets
    console.log('\n=== Creating Demo Markets ===');
    
    // Mint USDC for market creation
    await callContract(walletClient, publicClient, mockUSDC, 'MockUSDC', 'mint', [account.address, 20000n * 1000000n]); // 20k USDC
    await callContract(walletClient, publicClient, mockUSDC, 'MockUSDC', 'approve', [factory, 115792089237316195423570985008687907853269984665640564039457584007913129639935n]); // max uint

    // Market 1: Alien Life
    console.log('Creating Market 1...');
    const hash1 = await walletClient.writeContract({
        address: factory,
        abi: loadArtifact('LaunchpadFactory').abi,
        functionName: 'createMarket',
        args: [
            "UN Confirms Alien Life",
            "ALIEN",
            "Will the UN confirm the existence of alien life?",
            1, // Tier 1 ($1k)
            false,
            BigInt(90 * 24 * 60 * 60)
        ],
        gas: 999999999n
    });
    const receipt1 = await publicClient.waitForTransactionReceipt({ hash: hash1 });
    // In V6, createMarket emits MarketCreated(address market, uint256 marketId, address creator, uint256 tier)
    // We need to extract the market address from logs. 
    // For simplicity in this script, we can call factory.allMarkets(0)
    const market1Addr = await publicClient.readContract({
        address: factory,
        abi: loadArtifact('LaunchpadFactory').abi,
        functionName: 'allMarkets',
        args: [0n]
    });
    console.log(`  Market 1: ${market1Addr}`);

    // Market 2: BTC $100k
    console.log('Creating Market 2...');
    const hash2 = await walletClient.writeContract({
        address: factory,
        abi: loadArtifact('LaunchpadFactory').abi,
        functionName: 'createMarket',
        args: [
            "BTC 7-day TWAP >= $100k",
            "BTC100K",
            "Will BTC 7-day TWAP reach $100k?",
            2, // Tier 2 ($10k)
            false,
            BigInt(90 * 24 * 60 * 60)
        ],
        gas: 999999999n
    });
    await publicClient.waitForTransactionReceipt({ hash: hash2 });
    const market2Addr = await publicClient.readContract({
        address: factory,
        abi: loadArtifact('LaunchpadFactory').abi,
        functionName: 'allMarkets',
        args: [1n]
    });
    console.log(`  Market 2: ${market2Addr}`);

    // Authorize markets in TraderVault
    console.log('\n=== Finalizing TraderVault ===');
    await callContract(walletClient, publicClient, traderVault, 'SoothTraderVaultV4', 'setMarket', [market1Addr, true]);
    await callContract(walletClient, publicClient, traderVault, 'SoothTraderVaultV4', 'setMarket', [market2Addr, true]);

    const market1Contract = { address: market1Addr, abi: loadArtifact('LaunchpadMarket').abi };
    const market2Contract = { address: market2Addr, abi: loadArtifact('LaunchpadMarket').abi };
    
    const token1Addr = await publicClient.readContract({ ...market1Contract, functionName: 'outcomeToken' });
    const token2Addr = await publicClient.readContract({ ...market2Contract, functionName: 'outcomeToken' });

    await callContract(walletClient, publicClient, traderVault, 'SoothTraderVaultV4', 'setOutcomeToken', [token1Addr, true]);
    await callContract(walletClient, publicClient, traderVault, 'SoothTraderVaultV4', 'setOutcomeToken', [token2Addr, true]);

    console.log('\n========================================');
    console.log('=== DEPLOYMENT COMPLETE ===');
    console.log('========================================');
    console.log(`Chain ID: ${megaethFrontier.id}`);
    console.log('');
    console.log('Infrastructure:');
    console.log(`  MockUSDC:       ${mockUSDC}`);
    console.log(`  FeeController:  ${feeController}`);
    console.log(`  LiquidityVault: ${liquidityVault}`);
    console.log(`  TraderVaultV4:  ${traderVault}`);
    console.log(`  ProtocolConfig: ${protocolConfig}`);
    console.log('');
    console.log('Launchpad:');
    console.log(`  Factory:        ${factory}`);
    console.log(`  MarketImpl:     ${marketImpl}`);
    console.log(`  TokenImpl:      ${outcomeTokenImpl}`);
    console.log('');
    console.log('Demo Markets:');
    console.log(`  Market 1:       ${market1Addr}`);
    console.log(`  Token 1:        ${token1Addr}`);
    console.log(`  Market 2:       ${market2Addr}`);
    console.log(`  Token 2:        ${token2Addr}`);
    console.log('========================================');
}

main().catch(console.error);

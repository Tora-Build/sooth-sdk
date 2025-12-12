// @ts-nocheck
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MegaETH Testnet chain definition
const megaethTestnet = defineChain({
    id: 6343,
    name: 'MegaETH Testnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://timothy.megaeth.com/rpc'] },
    },
    blockExplorers: {
        default: { name: 'Blockscout', url: 'https://megaeth-testnet-v2.blockscout.com' },
    },
    testnet: true,
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

    console.log(`  Calling ${functionName}...`);

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
        chain: megaethTestnet,
        transport: http(),
    });

    const walletClient = createWalletClient({
        account,
        chain: megaethTestnet,
        transport: http(),
    });

    console.log('=== MegaETH V4.5 Deployment ===');
    console.log(`Deployer: ${account.address}`);
    console.log(`Chain ID: ${megaethTestnet.id}`);
    console.log('');

    // Check balance
    const balance = await publicClient.getBalance({ address: account.address });
    console.log(`Balance: ${Number(balance) / 1e18} ETH`);
    console.log('');

    // Deploy infrastructure
    console.log('=== Infrastructure ===');

    // MockUSDC - no constructor args
    const mockUSDC = await deployContract(walletClient, publicClient, 'MockUSDC', []);

    // SoothFeeController - constructor(address _treasury)
    const feeController = await deployContract(walletClient, publicClient, 'SoothFeeController', [
        account.address, // treasury
    ]);

    // SoothGovernorVault - constructor(IERC20 _asset)
    const governorVault = await deployContract(walletClient, publicClient, 'SoothGovernorVault', [
        mockUSDC,
    ]);

    // SoothTraderVaultV4 - constructor(IERC20 asset_, ISoothGovernorVault governorVault_)
    const traderVault = await deployContract(walletClient, publicClient, 'SoothTraderVaultV4', [
        mockUSDC,
        governorVault,
    ]);

    console.log('');
    console.log('=== Markets ===');

    // Deploy OutcomeToken for Market 1
    const token1 = await deployContract(walletClient, publicClient, 'OutcomeToken', []);

    // Deploy SoothMarketV4 (no constructor args)
    const market1 = await deployContract(walletClient, publicClient, 'SoothMarketV4', []);

    // Initialize Market 1
    console.log('Initializing Market 1...');
    await callContract(walletClient, publicClient, market1, 'SoothMarketV4', 'initialize', [
        1n,                    // marketId
        governorVault,         // governorVault
        traderVault,           // traderVault
        feeController,         // feeController
        token1,                // outcomeToken
        '0x0000000000000000000000000000000000000000000000000000000000000001', // adjudicatorId
        parseUnits('10000', 18), // bBase (10k USDC)
        account.address,       // governor
        0n,                    // initialQYes
        0n,                    // initialQNo
    ]);

    // Initialize OutcomeToken 1
    console.log('Initializing OutcomeToken 1...');
    await callContract(walletClient, publicClient, token1, 'OutcomeToken', 'initialize', [
        market1,
        traderVault,
    ]);

    // Deploy OutcomeToken for Market 2
    const token2 = await deployContract(walletClient, publicClient, 'OutcomeToken', []);

    // Deploy SoothMarketV4 (no constructor args)
    const market2 = await deployContract(walletClient, publicClient, 'SoothMarketV4', []);

    // Initialize Market 2
    console.log('Initializing Market 2...');
    await callContract(walletClient, publicClient, market2, 'SoothMarketV4', 'initialize', [
        2n,                    // marketId
        governorVault,         // governorVault
        traderVault,           // traderVault
        feeController,         // feeController
        token2,                // outcomeToken
        '0x0000000000000000000000000000000000000000000000000000000000000002', // adjudicatorId
        parseUnits('10000', 18), // bBase (10k USDC)
        account.address,       // governor
        0n,                    // initialQYes
        0n,                    // initialQNo
    ]);

    // Initialize OutcomeToken 2
    console.log('Initializing OutcomeToken 2...');
    await callContract(walletClient, publicClient, token2, 'OutcomeToken', 'initialize', [
        market2,
        traderVault,
    ]);

    // Set permissions
    console.log('');
    console.log('=== Setting Permissions ===');

    // TraderVault: setMarket
    await callContract(walletClient, publicClient, traderVault, 'SoothTraderVaultV4', 'setMarket', [market1, true]);
    await callContract(walletClient, publicClient, traderVault, 'SoothTraderVaultV4', 'setMarket', [market2, true]);

    // TraderVault: setOutcomeToken
    await callContract(walletClient, publicClient, traderVault, 'SoothTraderVaultV4', 'setOutcomeToken', [token1, true]);
    await callContract(walletClient, publicClient, traderVault, 'SoothTraderVaultV4', 'setOutcomeToken', [token2, true]);

    // GovernorVault: setAuthorized
    await callContract(walletClient, publicClient, governorVault, 'SoothGovernorVault', 'setAuthorized', [traderVault, true]);
    await callContract(walletClient, publicClient, governorVault, 'SoothGovernorVault', 'setAuthorized', [market1, true]);
    await callContract(walletClient, publicClient, governorVault, 'SoothGovernorVault', 'setAuthorized', [market2, true]);
    await callContract(walletClient, publicClient, governorVault, 'SoothGovernorVault', 'setAuthorized', [token1, true]);
    await callContract(walletClient, publicClient, governorVault, 'SoothGovernorVault', 'setAuthorized', [token2, true]);

    // Mint initial USDC to GovernorVault
    console.log('');
    console.log('=== Funding GovernorVault ===');
    await callContract(walletClient, publicClient, mockUSDC, 'MockUSDC', 'mint', [
        governorVault,
        parseUnits('100000', 18), // 100k USDC
    ]);

    console.log('');
    console.log('========================================');
    console.log('=== DEPLOYMENT COMPLETE ===');
    console.log('========================================');
    console.log(`Chain ID: ${megaethTestnet.id}`);
    console.log('');
    console.log('Infrastructure:');
    console.log(`  MockUSDC:       ${mockUSDC}`);
    console.log(`  FeeController:  ${feeController}`);
    console.log(`  GovernorVault:  ${governorVault}`);
    console.log(`  TraderVaultV4:  ${traderVault}`);
    console.log('');
    console.log('Markets:');
    console.log(`  Market1 (Alien): ${market1}`);
    console.log(`  Token1:          ${token1}`);
    console.log(`  Market2 (BTC):   ${market2}`);
    console.log(`  Token2:          ${token2}`);
    console.log('========================================');
}

main().catch(console.error);

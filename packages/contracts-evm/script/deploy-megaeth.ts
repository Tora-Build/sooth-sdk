import { createWalletClient, createPublicClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import * as fs from 'fs';
import * as path from 'path';

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
    const artifactPath = path.join(__dirname, `../out/${contractName}.sol/${contractName}.json`);
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    return {
        abi: artifact.abi,
        bytecode: artifact.bytecode.object,
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

    const mockUSDC = await deployContract(walletClient, publicClient, 'MockUSDC', [
        'Mock USDC',
        'USDC',
    ]);

    const feeController = await deployContract(walletClient, publicClient, 'SoothFeeController', [
        50, // 0.5%
        account.address, // treasury
    ]);

    const governorVault = await deployContract(walletClient, publicClient, 'SoothGovernorVault', [
        mockUSDC,
    ]);

    const traderVault = await deployContract(walletClient, publicClient, 'SoothTraderVaultV4', [
        mockUSDC,
        governorVault,
    ]);

    console.log('');
    console.log('=== Markets ===');

    // Market 1: UN Confirms Alien Life
    const market1 = await deployContract(walletClient, publicClient, 'SoothMarketV4', [
        1, // marketId
        traderVault,
        governorVault,
        feeController,
    ]);

    // Market 2: BTC TWAP
    const market2 = await deployContract(walletClient, publicClient, 'SoothMarketV4', [
        2, // marketId
        traderVault,
        governorVault,
        feeController,
    ]);

    console.log('');
    console.log('=== Deployment Summary ===');
    console.log(`MockUSDC:       ${mockUSDC}`);
    console.log(`FeeController:  ${feeController}`);
    console.log(`GovernorVault:  ${governorVault}`);
    console.log(`TraderVaultV4:  ${traderVault}`);
    console.log(`Market1:        ${market1}`);
    console.log(`Market2:        ${market2}`);
}

main().catch(console.error);

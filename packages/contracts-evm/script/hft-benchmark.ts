#!/usr/bin/env bun
/**
 * HFT Benchmark Script for Sooth Protocol V9
 * Measures orderbook performance: placement latency, fill execution, and batch operations
 */

import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, monadTestnet } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';

// Parse CLI args
const args = process.argv.slice(2);
const chainArg = args.find(a => a.startsWith('--chain='))?.split('=')[1] || 'baseSepolia';

// Chain configs
const chains: Record<string, typeof baseSepolia> = {
    baseSepolia: baseSepolia,
    monadTestnet: monadTestnet as typeof baseSepolia,
};

const rpcs: Record<string, string> = {
    baseSepolia: 'https://sepolia.base.org',
    monadTestnet: 'https://testnet-rpc.monad.xyz',
};

// Load deployment
const deploymentsPath = path.join(__dirname, '..', 'deployments', `v9-${chainArg}.json`);
if (!fs.existsSync(deploymentsPath)) {
    console.error(`❌ Deployment file not found: ${deploymentsPath}`);
    process.exit(1);
}
const deployment = JSON.parse(fs.readFileSync(deploymentsPath, 'utf-8'));

// Load env
const envPath = path.join(__dirname, '..', '..', '..', '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length) {
            process.env[key.trim()] = valueParts.join('=').trim();
        }
    });
}

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
    console.error('❌ PRIVATE_KEY not found in .env');
    process.exit(1);
}

const account = privateKeyToAccount(privateKey as `0x${string}`);
const chain = chains[chainArg];

const publicClient = createPublicClient({
    chain,
    transport: http(rpcs[chainArg]),
});

const walletClient = createWalletClient({
    chain,
    transport: http(rpcs[chainArg]),
    account,
});

// ABIs (minimal for benchmark)
const TickBookVaultAbi = [
    { name: 'depositUsdc', type: 'function', inputs: [{ type: 'uint256', name: 'amount' }], outputs: [], stateMutability: 'nonpayable' },
    { name: 'availableUsdcWad', type: 'function', inputs: [{ type: 'address', name: 'user' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const;

const TickBookPoolManagerAbi = [
    {
        name: 'placeRangeOrder', type: 'function', inputs: [
            { type: 'bytes32', name: 'marketKey' },
            { type: 'uint8', name: 'outcome' },
            { type: 'uint16', name: 'tickLower' },
            { type: 'uint16', name: 'tickUpper' },
            { type: 'uint128', name: 'shares' },
        ], outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }], stateMutability: 'nonpayable'
    },
    {
        name: 'cancelOrder', type: 'function', inputs: [
            { type: 'bytes32', name: 'marketKey' },
            { type: 'uint256', name: 'orderId' },
        ], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable'
    },
    {
        name: 'executeMarketOrder', type: 'function', inputs: [
            { type: 'bytes32', name: 'marketKey' },
            { type: 'uint8', name: 'outcome' },
            { type: 'uint128', name: 'shares' },
            { type: 'uint256', name: 'maxCost' },
        ], outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }], stateMutability: 'nonpayable'
    },
    { name: 'getMarketKey', type: 'function', inputs: [{ type: 'address', name: 'market' }], outputs: [{ type: 'bytes32' }], stateMutability: 'view' },
] as const;

const MockUsdcAbi = [
    { name: 'approve', type: 'function', inputs: [{ type: 'address', name: 'spender' }, { type: 'uint256', name: 'amount' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
    { name: 'mint', type: 'function', inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'amount' }], outputs: [], stateMutability: 'nonpayable' },
] as const;

// Benchmark results
interface BenchmarkResult {
    operation: string;
    latencyMs: number;
    gasUsed: bigint;
    success: boolean;
    txHash?: string;
}

const results: BenchmarkResult[] = [];

async function measureTx(name: string, txPromise: Promise<`0x${string}`>): Promise<BenchmarkResult> {
    const start = performance.now();
    try {
        const hash = await txPromise;
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        const latency = performance.now() - start;

        const result: BenchmarkResult = {
            operation: name,
            latencyMs: Math.round(latency),
            gasUsed: receipt.gasUsed,
            success: receipt.status === 'success',
            txHash: hash,
        };
        results.push(result);
        console.log(`  ✓ ${name}: ${result.latencyMs}ms, ${formatUnits(receipt.gasUsed, 0)} gas`);
        return result;
    } catch (err: any) {
        const latency = performance.now() - start;
        const result: BenchmarkResult = {
            operation: name,
            latencyMs: Math.round(latency),
            gasUsed: 0n,
            success: false,
        };
        results.push(result);
        console.log(`  ✗ ${name}: FAILED (${err.message?.slice(0, 50)}...)`);
        return result;
    }
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           SOOTH V9.9.2 HFT BENCHMARK                        ║');
    console.log(`╠════════════════════════════════════════════════════════════╣`);
    console.log(`║ Chain: ${chainArg.padEnd(52)}║`);
    console.log(`║ Account: ${account.address.slice(0, 10)}...${account.address.slice(-8).padEnd(42)}║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const contracts = deployment.contracts;
    const market = deployment.markets?.[1]; // Graduated market (BTC100K)

    if (!market) {
        console.error('❌ No graduated market found in deployment');
        process.exit(1);
    }

    console.log(`📊 Market: ${market.name} (${market.address})`);
    console.log(`   Graduated: ${market.isGraduated ? '✓' : '✗'}\n`);

    // Compute market key using pool key hash (same as contract: keccak256(abi.encode(...)))
    const { keccak256, encodeAbiParameters, parseAbiParameters } = await import('viem');
    const hookAddress = contracts.DynamicFeeHook || '0x0000000000000000000000000000000000000000';
    const marketKey = keccak256(
        encodeAbiParameters(
            parseAbiParameters('address, address, address, address'),
            [market.address as `0x${string}`, market.yesToken as `0x${string}`, market.noToken as `0x${string}`, hookAddress as `0x${string}`]
        )
    );
    console.log(`   MarketKey: ${marketKey.slice(0, 18)}...\n`);

    // === Setup Phase ===
    console.log('=== SETUP PHASE ===');

    // Check balance
    const balance = await publicClient.readContract({
        address: contracts.TickBookVault as `0x${string}`,
        abi: TickBookVaultAbi,
        functionName: 'availableUsdcWad',
        args: [account.address],
    });
    console.log(`  Vault Balance: ${formatUnits(balance, 18)} USDC`);

    if (balance < parseUnits('1000', 18)) {
        console.log('  Minting 10,000 USDC...');
        await measureTx('mint USDC', walletClient.writeContract({
            address: contracts.MockUSDC as `0x${string}`,
            abi: MockUsdcAbi,
            functionName: 'mint',
            args: [account.address, parseUnits('10000', 18)],
        }));

        console.log('  Approving Vault...');
        await measureTx('approve Vault', walletClient.writeContract({
            address: contracts.MockUSDC as `0x${string}`,
            abi: MockUsdcAbi,
            functionName: 'approve',
            args: [contracts.TickBookVault as `0x${string}`, parseUnits('1000000', 18)],
        }));

        console.log('  Depositing 10,000 USDC...');
        await measureTx('deposit USDC', walletClient.writeContract({
            address: contracts.TickBookVault as `0x${string}`,
            abi: TickBookVaultAbi,
            functionName: 'depositUsdc',
            args: [parseUnits('10000', 18)],
        }));
    }

    // === Benchmark: Limit Orders ===
    console.log('\n=== BENCHMARK: LIMIT ORDER PLACEMENT ===');
    const orderIds: bigint[] = [];

    for (let i = 0; i < 5; i++) {
        const tickLower = 400 + i * 20;
        const tickUpper = tickLower + 50;
        const result = await measureTx(`placeRangeOrder #${i + 1} [${tickLower}-${tickUpper}]`,
            walletClient.writeContract({
                address: contracts.TickBookPoolManager as `0x${string}`,
                abi: TickBookPoolManagerAbi,
                functionName: 'placeRangeOrder',
                args: [marketKey, 1, tickLower, tickUpper, parseUnits('100', 18)],
            })
        );
        // Note: we can't easily get orderId from here without parsing logs
    }

    // === Benchmark: Market Orders ===
    console.log('\n=== BENCHMARK: MARKET ORDER EXECUTION ===');

    for (let i = 0; i < 3; i++) {
        await measureTx(`executeMarketOrder BUY #${i + 1}`,
            walletClient.writeContract({
                address: contracts.TickBookPoolManager as `0x${string}`,
                abi: TickBookPoolManagerAbi,
                functionName: 'executeMarketOrder',
                args: [marketKey, 0, parseUnits('50', 18), parseUnits('100', 18)], // Buy NO (fills YES)
            })
        );
    }

    // === Summary ===
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('                      BENCHMARK SUMMARY                       ');
    console.log('════════════════════════════════════════════════════════════\n');

    const successful = results.filter(r => r.success);
    const avgLatency = successful.length > 0
        ? successful.reduce((sum, r) => sum + r.latencyMs, 0) / successful.length
        : 0;
    const avgGas = successful.length > 0
        ? successful.reduce((sum, r) => sum + r.gasUsed, 0n) / BigInt(successful.length)
        : 0n;

    console.log(`  Total Operations: ${results.length}`);
    console.log(`  Successful: ${successful.length}`);
    console.log(`  Failed: ${results.length - successful.length}`);
    console.log(`  Average Latency: ${avgLatency.toFixed(0)}ms`);
    console.log(`  Average Gas: ${formatUnits(avgGas, 0)}`);

    // Save results (convert BigInt to string for JSON serialization)
    const resultsPath = path.join(__dirname, '..', 'deployments', 'benchmark-results.json');
    const serializableResults = results.map(r => ({
        ...r,
        gasUsed: r.gasUsed.toString(),
    }));
    fs.writeFileSync(resultsPath, JSON.stringify({
        chain: chainArg,
        timestamp: new Date().toISOString(),
        results: serializableResults,
        summary: {
            totalOps: results.length,
            successfulOps: successful.length,
            avgLatencyMs: avgLatency,
            avgGas: avgGas.toString(),
        },
    }, null, 2));
    console.log(`\n  Results saved to: ${resultsPath}`);
}

main().catch(console.error);

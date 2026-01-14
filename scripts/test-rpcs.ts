import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const rpcLists = {
    'MegaETH Testnet': [
        'https://megaeth-testnet.g.alchemy.com/v2/REDACTED_ALCHEMY_TOKEN',
        // Potential candidates (unverified)
        'https://rpc.megaeth.com',
        'https://testnet.megaeth.com',
    ],
    'Arc Testnet': [
        'https://rpc-public.testnet.arc.network',
        'https://rpc.blockdaemon.testnet.arc.network',
        'https://rpc.drpc.testnet.arc.network',
        'https://rpc.testnet.arc.network',
        'https://rpc.quicknode.testnet.arc.network',
    ],
    'Monad Testnet': [
        'https://rpc.ankr.com/monad_testnet',
    ],
    'Base Sepolia': [
        'https://sepolia.base.org',
    ]
};

async function checkRpc(url: string, name: string) {
    try {
        const client = createPublicClient({
            transport: http(url),
        });
        const block = await client.getBlockNumber();
        console.log(`[PASS] ${name} (${url}): Block ${block}`);
        return true;
    } catch (e) {
        console.log(`[FAIL] ${name} (${url}): ${e.message.split('\n')[0]}`);
        return false;
    }
}

async function run() {
    console.log('Testing RPC endpoints...');
    for (const [chain, urls] of Object.entries(rpcLists)) {
        console.log(`\nTesting ${chain}...`);
        for (const url of urls) {
            await checkRpc(url, chain);
        }
    }
}

run();

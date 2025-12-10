const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG_PATH = path.resolve(__dirname, '../../../apps/web/src/config/deployments.json');
const BROADCAST_DIR = path.resolve(__dirname, '../broadcast/DeployFreshV4.s.sol');
const OUT_DIR = path.resolve(__dirname, '../out');
const ABI_DEST_DIR = path.resolve(__dirname, '../../../apps/web/src/config/abis');

// Chain IDs
const CHAINS = {
    84532: 'baseSepolia',
    10143: 'monadTestnet'
};

// Contracts to track
const CONTRACTS = [
    'MockUSDC',
    'SoothTraderVaultV4',
    'SoothMarketV4',
    'OutcomeToken',
    'SoothGovernorVault',
    'SoothFeeController',
    // 'SoothBalancedAMM' // Future-proofing
];

function main() {
    console.log('🚀 Starting deployment sync...');

    // 1. Read existing config
    let config;
    try {
        config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        console.log(`📖 Loaded config from ${CONFIG_PATH}`);
    } catch (e) {
        console.error(`❌ Error reading config: ${e.message}`);
        process.exit(1);
    }

    // 2. Update addresses from broadcast artifacts
    let updated = false;
    for (const [chainId, networkKey] of Object.entries(CHAINS)) {
        const runFile = path.join(BROADCAST_DIR, chainId, 'run-latest.json');

        if (!fs.existsSync(runFile)) {
            console.log(`⚠️  No broadcast file found for ${networkKey} (${chainId}). Skipping.`);
            continue;
        }

        console.log(`Processing ${networkKey} (${chainId})...`);
        try {
            const data = JSON.parse(fs.readFileSync(runFile, 'utf8'));
            const transactions = data.transactions;
            const newContracts = {};

            // Map existing contracts first to preserve manual overrides if needed,
            // but here we intend to overwrite with latest deployment.
            // Actually, let's start with current config and update found ones.
            const currentContracts = config.networks[networkKey]?.contracts || {};

            // Helper to clean contract name (e.g., "MockUSDC" from "script/Deploy.s.sol:MockUSDC")
            // Broadcast json usually has "contractName": "MockUSDC" directly.

            transactions.forEach(tx => {
                if (tx.transactionType === 'CREATE' && tx.contractName) {
                    if (CONTRACTS.includes(tx.contractName)) {
                        // Map V4 names to legacy keys for frontend compatibility
                        let key = tx.contractName;
                        if (key === 'SoothTraderVaultV4') key = 'SoothTraderVault';
                        if (key === 'SoothMarketV4') key = 'SoothMarket';

                        newContracts[key] = tx.contractAddress;
                    }
                }
            });

            // Update config
            if (Object.keys(newContracts).length > 0) {
                config.networks[networkKey].contracts = {
                    ...currentContracts,
                    ...newContracts
                };

                // Update status if it was paused/empty (optional helper)
                // config.networks[networkKey].status = "✅ Live & Updated"; 

                updated = true;
                console.log(`   ✅ Updated ${Object.keys(newContracts).length} contracts for ${networkKey}`);
            } else {
                console.log(`   ℹ️  No relevant contract deployments found in latest run.`);
            }

        } catch (e) {
            console.error(`   ❌ Error processing ${runFile}: ${e.message}`);
        }
    }

    // 3. Write Updated Config
    if (updated) {
        config.lastUpdated = new Date().toISOString().split('T')[0];
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        console.log(`💾 Saved updated config to ${CONFIG_PATH}`);

        // 3b. Sync markets.json
        const MARKETS_PATH = path.resolve(__dirname, '../../../apps/web/src/config/markets.json');
        if (fs.existsSync(MARKETS_PATH)) {
            try {
                const marketsConfig = JSON.parse(fs.readFileSync(MARKETS_PATH, 'utf8'));
                let marketUpdated = false;

                // Find deployed market address
                const marketAddress = config.networks.baseSepolia?.contracts?.SoothMarket;

                if (marketAddress) {
                    // Update example_v3 market
                    const market = marketsConfig.markets.find(m => m.id === 'example_v3');
                    if (market && market.contractAddress !== marketAddress) {
                        console.log(`   🔄 Updating example_v3 market address to ${marketAddress}`);
                        market.contractAddress = marketAddress;
                        marketUpdated = true;
                    }
                }

                if (marketUpdated) {
                    fs.writeFileSync(MARKETS_PATH, JSON.stringify(marketsConfig, null, 2));
                    console.log(`💾 Saved updated markets config to ${MARKETS_PATH}`);
                }
            } catch (e) {
                console.error(`   ❌ Error updating markets.json: ${e.message}`);
            }
        }
    } else {
        console.log('no updates necessary for deployments.json');
    }

    // 4. Sync ABIs
    console.log('\n📦 Syncing ABIs...');
    if (!fs.existsSync(ABI_DEST_DIR)) {
        fs.mkdirSync(ABI_DEST_DIR, { recursive: true });
    }

    const abiFiles = [
        // Map V4 contracts to standard names for frontend compatibility
        { src: 'SoothTraderVaultV4.sol/SoothTraderVaultV4.json', dest: 'SoothTraderVault.json' },
        { src: 'SoothGovernorVault.sol/SoothGovernorVault.json', dest: 'SoothGovernorVault.json' },
        { src: 'SoothMarketV4.sol/SoothMarketV4.json', dest: 'SoothMarket.json' },
        { src: 'SoothFeeController.sol/SoothFeeController.json', dest: 'SoothFeeController.json' },
        { src: 'OutcomeToken.sol/OutcomeToken.json', dest: 'OutcomeToken.json' },
        { src: 'MockUSDC.sol/MockUSDC.json', dest: 'MockUSDC.json', optional: true },
    ];

    let abiCount = 0;
    abiFiles.forEach(file => {
        const srcPath = path.join(OUT_DIR, file.src);
        const destPath = path.join(ABI_DEST_DIR, file.dest);

        if (fs.existsSync(srcPath)) {
            try {
                // Read and minify? Or just copy. Copying full JSON is safer for wagmi/viem which might need ABI + bytecode sometimes,
                // but usually we just want the 'abi' field.
                // Let's just copy the file for now to match bash behavior.
                fs.copyFileSync(srcPath, destPath);
                // console.log(`   - Copied ${file.dest}`);
                abiCount++;
            } catch (e) {
                console.error(`   ❌ Error copying ${file.src}: ${e.message}`);
            }
        } else {
            if (!file.optional) {
                console.warn(`   ⚠️  Source ABI not found: ${file.src}`);
            }
        }
    });
    console.log(`✅ Synced ${abiCount} ABIs.`);

    console.log('\n🎉 Sync complete!');
}

main();

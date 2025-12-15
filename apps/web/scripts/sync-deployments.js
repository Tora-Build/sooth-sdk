const fs = require('fs');
const path = require('path');

// Configuration
const CHAIN_ID = 84532; // Base Sepolia
const BROADCAST_DIR = path.resolve(__dirname, '../../../packages/contracts-evm/broadcast');
const TARGET_CONFIG = path.resolve(__dirname, '../src/config/deployments.json');

// Mappings: Contract Name (in Foundry) -> Config Key (in FE)
const CONTRACT_MAP = {
    'SoothTraderVaultV4': 'SoothTraderVault',
    'SoothGovernorVault': 'SoothGovernorVault',
    'SoothFeeController': 'SoothFeeController',
    'LaunchpadFactory': 'LaunchpadFactory',
    'LaunchpadOutcomeToken': 'LaunchpadOutcomeToken',
    'LaunchpadMarket': 'LaunchpadMarketImpl',
    'MarketLPVault': 'MarketLPVaultImpl'
};

async function main() {
    console.log('🔄 Syncing deployments...');

    // 1. Find latest run file
    // Check multiple scripts, prioritize V5Upgrade
    const scripts = ['DeployV5Upgrade.s.sol', 'DeployLaunchpad.s.sol', 'DeployV4Infra.s.sol'];
    let latestRun = null;
    let usedScript = '';

    for (const script of scripts) {
        const runPath = path.join(BROADCAST_DIR, script, CHAIN_ID.toString(), 'run-latest.json');
        if (fs.existsSync(runPath)) {
            const stat = fs.statSync(runPath);
            // Simple logic: Use the first one found or check timestamps? 
            // For now, V5 is the authority.
            if (script === 'DeployV5Upgrade.s.sol') {
                latestRun = JSON.parse(fs.readFileSync(runPath, 'utf8'));
                usedScript = script;
                break;
            }
        }
    }

    if (!latestRun) {
        console.error('❌ No broadcast file found for V5 Upgrade.');
        process.exit(1);
    }

    console.log(`✅ Found deployment: ${usedScript}`);

    // 2. Extract Addresses
    const newAddresses = {};
    for (const tx of latestRun.transactions) {
        if (tx.transactionType === 'CREATE') {
            const name = tx.contractName;
            const addr = tx.contractAddress;

            if (CONTRACT_MAP[name]) {
                const key = CONTRACT_MAP[name];
                newAddresses[key] = addr;
                console.log(`   - ${key}: ${addr}`);
            }
        }
    }

    // 3. Update Config
    const config = JSON.parse(fs.readFileSync(TARGET_CONFIG, 'utf8'));

    // Ensure network entry exists
    if (!config.networks.baseSepolia) config.networks.baseSepolia = { contracts: {} };

    // Merge
    Object.assign(config.networks.baseSepolia.contracts, newAddresses);

    // Update Metadata
    config.lastUpdated = new Date().toISOString().split('T')[0];

    fs.writeFileSync(TARGET_CONFIG, JSON.stringify(config, null, 2));
    console.log(`🎉 Updated ${TARGET_CONFIG}`);
}

main();

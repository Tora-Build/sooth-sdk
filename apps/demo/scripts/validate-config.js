const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m"
};

const CONFIG_DIR = path.join(__dirname, '../src/config');
const DEPLOYMENTS_PATH = path.join(CONFIG_DIR, 'deployments.json');
const MARKETS_PATH = path.join(CONFIG_DIR, 'markets.json');
const CONTENT_PATH = path.join(CONFIG_DIR, 'ui-content.json');

function log(color, msg) {
    console.log(`${color}${msg}${colors.reset}`);
}

function error(msg) {
    log(colors.red, `✖ ${msg}`);
    process.exit(1);
}

function success(msg) {
    log(colors.green, `✓ ${msg}`);
}

// 1. Validate Deployments
if (!fs.existsSync(DEPLOYMENTS_PATH)) error(`deployments.json not found at ${DEPLOYMENTS_PATH}`);
const deployments = require(DEPLOYMENTS_PATH);

if (!deployments.networks) error('deployments.json missing "networks" key');

Object.entries(deployments.networks).forEach(([netName, netConfig]) => {
    if (!netConfig.chainId) error(`Network ${netName} missing chainId`);
    if (!netConfig.contracts) error(`Network ${netName} missing contracts object`);

    // Check if this network has incomplete deployment (null contracts)
    const hasNullContracts = Object.values(netConfig.contracts).some(addr => addr === null);
    if (hasNullContracts) {
        log(colors.yellow, `⚠ Skipping ${netName}: incomplete deployment (has null contracts)`);
        return;
    }

    Object.entries(netConfig.contracts).forEach(([contractName, address]) => {
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            error(`Invalid address for ${contractName} on ${netName}: ${address}`);
        }

        // Custom Check: MockUSDC on BaseSepolia
        if (netName === 'baseSepolia' && contractName === 'MockUSDC') {
            // log(colors.yellow, `Checking MockUSDC... OK`);
        }
    });
});
success('deployments.json is valid');

// 2. Validate Markets
if (!fs.existsSync(MARKETS_PATH)) error(`markets.json not found`);
const markets = require(MARKETS_PATH);

if (!Array.isArray(markets.markets)) error('markets.json must have "markets" array');

const marketIds = new Set();
markets.markets.forEach((m, idx) => {
    if (!m.id) error(`Market at index ${idx} missing "id"`);
    if (marketIds.has(m.id)) error(`Duplicate market ID: ${m.id}`);
    marketIds.add(m.id);

    if (!m.name) error(`Market ${m.id} missing "name"`);
    if (!m.outcomes || m.outcomes.length !== 2) error(`Market ${m.id} must have exactly 2 outcomes (YES/NO)`);

    // Check images
    if (m.image && !m.image.startsWith('/')) error(`Market ${m.id} image should start with /`);
});
success(`markets.json is valid (${markets.markets.length} markets)`);

// 3. Validate UI Content
if (!fs.existsSync(CONTENT_PATH)) error(`ui-content.json not found`);
const content = require(CONTENT_PATH);

function checkStrings(obj, updatePath = '') {
    Object.entries(obj).forEach(([key, val]) => {
        const currentPath = updatePath ? `${updatePath}.${key}` : key;
        if (typeof val === 'object') {
            checkStrings(val, currentPath);
        } else if (typeof val === 'string') {
            if (val.trim() === '') log(colors.yellow, `⚠ Warning: Empty string at ${currentPath}`);
        } else if (typeof val === 'boolean' || typeof val === 'number') {
            // Booleans and numbers are also allowed in UI content
        } else {
            error(`Invalid type at ${currentPath}: ${typeof val}`);
        }
    });
}

checkStrings(content);
success('ui-content.json is valid');

log(colors.blue, '\nAll configurations validated successfully!');

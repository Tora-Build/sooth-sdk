#!/bin/bash
# verify-deployment.sh
# Validates that deployments.json is consistent with on-chain state
# Run after any deployment to catch config errors BEFORE frontend testing

set -e

RPC_URL="${RPC_URL:-https://sepolia.base.org}"
# Which network block in apps/web/src/config/deployments.json to validate.
# Example: NETWORK=bnbTestnet RPC_URL=https://data-seed-prebsc-1-s1.bnbchain.org:8545 ./script/verify-deployment.sh
NETWORK="${NETWORK:-baseSepolia}"
# Resolve paths relative to this script (robust to cwd)
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../../.." >/dev/null 2>&1 && pwd)"
DEPLOYMENTS_JSON="${REPO_ROOT}/apps/web/src/config/deployments.json"

echo "=========================================="
echo "  Deployment Verification Script"
echo "=========================================="
echo "RPC: $RPC_URL"
echo "Network: $NETWORK"
echo ""

# Read addresses from deployments.json
CHAIN_ID=$(jq -r --arg net "$NETWORK" '.networks[$net].chainId // empty' "$DEPLOYMENTS_JSON")
if [ -z "$CHAIN_ID" ] || [ "$CHAIN_ID" == "null" ]; then
    echo "❌ Error: Could not resolve chainId for NETWORK=$NETWORK in deployments.json"
    exit 1
fi

TRADER_VAULT=$(jq -r --arg net "$NETWORK" '.networks[$net].contracts.SoothTraderVault' "$DEPLOYMENTS_JSON")
GOVERNOR_VAULT=$(jq -r --arg net "$NETWORK" '.networks[$net].contracts.SoothGovernorVault' "$DEPLOYMENTS_JSON")
FEE_CONTROLLER=$(jq -r --arg net "$NETWORK" '.networks[$net].contracts.SoothFeeController' "$DEPLOYMENTS_JSON")
USDC=$(jq -r --arg net "$NETWORK" '.networks[$net].contracts.MockUSDC' "$DEPLOYMENTS_JSON")
MARKET1=$(jq -r --arg net "$NETWORK" '.networks[$net].marketInfo.market1.address' "$DEPLOYMENTS_JSON")
MARKET2=$(jq -r --arg net "$NETWORK" '.networks[$net].marketInfo.market2.address' "$DEPLOYMENTS_JSON")

echo "Config Addresses:"
echo "  ChainId:       $CHAIN_ID"
echo "  TraderVault:   $TRADER_VAULT"
echo "  GovernorVault: $GOVERNOR_VAULT"
echo "  FeeController: $FEE_CONTROLLER"
echo "  USDC:          $USDC"
echo "  Market1:       $MARKET1"
echo "  Market2:       $MARKET2"
echo ""

ERRORS=0

# Helper function
check_code() {
    local name=$1
    local addr=$2
    local code=$(cast code $addr --rpc-url $RPC_URL 2>/dev/null || echo "0x")
    if [ "$code" == "0x" ] || [ -z "$code" ]; then
        echo "❌ $name ($addr): NO CODE ON CHAIN"
        ERRORS=$((ERRORS + 1))
    else
        echo "✅ $name: Has code"
    fi
}

# 1. Verify all contracts have code
echo "--- Step 1: Verify Contracts Exist ---"
check_code "TraderVault" $TRADER_VAULT
check_code "GovernorVault" $GOVERNOR_VAULT
check_code "FeeController" $FEE_CONTROLLER
check_code "USDC" $USDC
check_code "Market1" $MARKET1
check_code "Market2" $MARKET2
echo ""

# 2. Verify TraderVault.asset() == USDC
echo "--- Step 2: Verify TraderVault Asset ---"
VAULT_ASSET=$(cast call $TRADER_VAULT "asset()(address)" --rpc-url $RPC_URL 2>/dev/null || echo "FAILED")
# Normalize to lowercase for comparison
VAULT_ASSET_LOWER=$(echo "$VAULT_ASSET" | tr '[:upper:]' '[:lower:]')
USDC_LOWER=$(echo "$USDC" | tr '[:upper:]' '[:lower:]')
if [ "$VAULT_ASSET_LOWER" == "$USDC_LOWER" ]; then
    echo "✅ TraderVault.asset() matches USDC"
else
    echo "❌ TraderVault.asset() = $VAULT_ASSET (expected $USDC)"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 3. Verify Market1.traderVault() == TraderVault
echo "--- Step 3: Verify Market -> Vault Link ---"
M1_VAULT=$(cast call $MARKET1 "traderVault()(address)" --rpc-url $RPC_URL 2>/dev/null || echo "FAILED")
if [ "$M1_VAULT" == "$TRADER_VAULT" ]; then
    echo "✅ Market1.traderVault() matches config"
else
    echo "❌ Market1.traderVault() = $M1_VAULT (expected $TRADER_VAULT)"
    ERRORS=$((ERRORS + 1))
fi

M2_VAULT=$(cast call $MARKET2 "traderVault()(address)" --rpc-url $RPC_URL 2>/dev/null || echo "FAILED")
if [ "$M2_VAULT" == "$TRADER_VAULT" ]; then
    echo "✅ Market2.traderVault() matches config"
else
    echo "❌ Market2.traderVault() = $M2_VAULT (expected $TRADER_VAULT)"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 4. Verify TraderVault.isMarket() for both markets
echo "--- Step 4: Verify Vault Knows Markets ---"
IS_M1=$(cast call $TRADER_VAULT "isMarket(address)(bool)" $MARKET1 --rpc-url $RPC_URL 2>/dev/null || echo "false")
if [ "$IS_M1" == "true" ]; then
    echo "✅ TraderVault.isMarket(Market1) = true"
else
    echo "❌ TraderVault.isMarket(Market1) = $IS_M1 (expected true)"
    ERRORS=$((ERRORS + 1))
fi

IS_M2=$(cast call $TRADER_VAULT "isMarket(address)(bool)" $MARKET2 --rpc-url $RPC_URL 2>/dev/null || echo "false")
if [ "$IS_M2" == "true" ]; then
    echo "✅ TraderVault.isMarket(Market2) = true"
else
    echo "❌ TraderVault.isMarket(Market2) = $IS_M2 (expected true)"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 5. Verify markets.json markets are registered
echo "--- Step 5: Verify markets.json Markets ---"
MARKETS_JSON="${REPO_ROOT}/apps/web/src/config/markets.json"

# Extract all real-mode markets for this chain
MARKET_ADDRESSES=$(jq -r --argjson chainId "$CHAIN_ID" '.markets[] | select(.mode == "real" and .chainId == $chainId) | .contractAddress' "$MARKETS_JSON" 2>/dev/null)

if [ -z "$MARKET_ADDRESSES" ]; then
    echo "⚠️  No real markets found in markets.json for chainId=$CHAIN_ID"
else
    for ADDR in $MARKET_ADDRESSES; do
        if [ "$ADDR" != "null" ] && [ -n "$ADDR" ]; then
            # Check if market has code
            CODE=$(cast code $ADDR --rpc-url $RPC_URL 2>/dev/null || echo "0x")
            if [ "$CODE" == "0x" ] || [ -z "$CODE" ]; then
                echo "❌ Market $ADDR: NO CODE ON CHAIN"
                ERRORS=$((ERRORS + 1))
                continue
            fi
            
            # Check if market is registered in TraderVault
            IS_REGISTERED=$(cast call $TRADER_VAULT "isMarket(address)(bool)" $ADDR --rpc-url $RPC_URL 2>/dev/null || echo "false")
            if [ "$IS_REGISTERED" == "true" ]; then
                echo "✅ markets.json: $ADDR is registered"
            else
                echo "❌ markets.json: $ADDR NOT registered in TraderVault"
                ERRORS=$((ERRORS + 1))
            fi
        fi
    done
fi
echo ""

# Summary
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
    echo "✅ ALL CHECKS PASSED"
    exit 0
else
    echo "❌ $ERRORS ERROR(S) FOUND"
    echo "Fix deployments.json/markets.json or redeploy contracts."
    exit 1
fi

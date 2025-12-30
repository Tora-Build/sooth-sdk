#!/bin/bash
# verify-deployment.sh
# Validates that deployments.json is consistent with on-chain state for V9 Architecture
# Run after any deployment to catch config errors BEFORE frontend testing

set -e

RPC_URL="${RPC_URL:-https://sepolia.base.org}"
# Which network block in apps/web/src/config/deployments.json to validate.
NETWORK="${NETWORK:-baseSepolia}"
# Resolve paths relative to this script (robust to cwd)
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../../.." >/dev/null 2>&1 && pwd)"
DEPLOYMENTS_JSON="${REPO_ROOT}/apps/web/src/config/deployments.json"
MARKETS_JSON="${REPO_ROOT}/apps/web/src/config/markets.json"

echo "=========================================="
echo "  V9 Deployment Verification Script"
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

USDC=$(jq -r --arg net "$NETWORK" '.networks[$net].contracts.MockUSDC' "$DEPLOYMENTS_JSON")
AMM_ENGINE=$(jq -r --arg net "$NETWORK" '.networks[$net].contracts.AMMEngine' "$DEPLOYMENTS_JSON")
COLLATERALIZER=$(jq -r --arg net "$NETWORK" '.networks[$net].contracts.Collateralizer' "$DEPLOYMENTS_JSON")
LAUNCHPAD_ENGINE=$(jq -r --arg net "$NETWORK" '.networks[$net].contracts.LaunchpadEngine' "$DEPLOYMENTS_JSON")
TICKBOOK=$(jq -r --arg net "$NETWORK" '.networks[$net].contracts.TickBook // .networks[$net].contracts.TickBookVault' "$DEPLOYMENTS_JSON")

echo "Config Addresses:"
echo "  ChainId:          $CHAIN_ID"
echo "  USDC:             $USDC"
echo "  AMMEngine:        $AMM_ENGINE"
echo "  Collateralizer:   $COLLATERALIZER"
echo "  LaunchpadEngine:  $LAUNCHPAD_ENGINE"
echo "  TickBook:         $TICKBOOK"
echo ""

ERRORS=0

# Helper function to get contract code
get_code() {
    local addr=$1
    local code=$(cast code $addr --rpc-url $RPC_URL 2>/dev/null)
    if [ $? -eq 0 ] && [ -n "$code" ] && [ "$code" != "0x" ]; then
        echo "$code"
        return
    fi
    # Fallback to curl
    local result=$(curl -s -X POST -H "Content-Type: application/json" \
        --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getCode\",\"params\":[\"$addr\",\"latest\"],\"id\":1}" \
        "$RPC_URL" 2>/dev/null | jq -r '.result // "0x"')
    echo "$result"
}

# Helper function to call a contract
# Usage: call_contract <to_address> "<signature> [arg]"
call_contract() {
    local to=$1
    local data=$2
    local sig=$(echo "$data" | awk '{print $1}')
    local arg=$(echo "$data" | awk '{print $2}')
    
    # Try cast first
    if [ -n "$arg" ]; then
        local result=$(cast call $to "$sig" "$arg" --rpc-url $RPC_URL 2>/dev/null)
    else
        local result=$(cast call $to "$sig" --rpc-url $RPC_URL 2>/dev/null)
    fi
    if [ $? -eq 0 ] && [ -n "$result" ] && [ "$result" != "FAILED" ]; then
        echo "$result"
        return
    fi
    
    # Fallback to curl for known selectors (V9 updated)
    local calldata=""
    case "$sig" in
        "usdc()(address)")
            calldata="0x3e413bee"
            ;;
        "ammEngine()(address)")
            calldata="0x7a3c2cca"
            ;;
        "collateralizer()(address)")
            calldata="0x869f0511"
            ;;
        "tickBook()(address)")
            calldata="0x92089e8c"
            ;;
        "router()(address)")
            calldata="0xf887ea40"
            ;;
        "isMarketRegistered(address)(bool)")
            local addr_clean="${arg#0x}"
            calldata="0x8e7d8a2a000000000000000000000000${addr_clean}"
            ;;
        *)
            echo "FAILED"
            return
            ;;
    esac
    
    local json_result=$(curl -s -X POST -H "Content-Type: application/json" \
        --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_call\",\"params\":[{\"to\":\"$to\",\"data\":\"$calldata\"},\"latest\"],\"id\":1}" \
        "$RPC_URL" 2>/dev/null)
    local hex_result=$(echo "$json_result" | jq -r '.result // "FAILED"')
    
    if [ "$hex_result" != "FAILED" ] && [ "$hex_result" != "null" ] && [ -n "$hex_result" ]; then
        case "$sig" in
            *"(address)")
                echo "0x${hex_result: -40}"
                ;;
            *"(bool)")
                if [ "${hex_result: -1}" == "1" ]; then echo "true"; else echo "false"; fi
                ;;
            *)
                echo "$hex_result"
                ;;
        esac
    else
        echo "FAILED"
    fi
}

check_code() {
    local name=$1
    local addr=$2
    if [ "$addr" == "null" ] || [ -z "$addr" ]; then
         echo "❌ $name: Not configured in deployments.json"
         ERRORS=$((ERRORS + 1))
         return
    fi
    
    local code=$(get_code $addr)
    if [ "$code" == "0x" ] || [ -z "$code" ] || [ "$code" == "null" ]; then
        echo "❌ $name ($addr): NO CODE ON CHAIN"
        ERRORS=$((ERRORS + 1))
    else
        echo "✅ $name: Has code"
    fi
}

# 1. Verify all contracts have code
echo "--- Step 1: Verify Contracts Exist ---"
check_code "USDC" $USDC
check_code "AMMEngine" $AMM_ENGINE
check_code "Collateralizer" $COLLATERALIZER
check_code "LaunchpadEngine" $LAUNCHPAD_ENGINE
check_code "TickBook" $TICKBOOK
echo ""

# 2. Verify USDC linkages
echo "--- Step 2: Verify USDC Links ---"
validate_link() {
    local contract_name=$1
    local contract_addr=$2
    local method="usdc()(address)"
    local expected=$3
    
    local val=$(call_contract $contract_addr "$method")
    local val_lower=$(echo "$val" | tr '[:upper:]' '[:lower:]')
    local expected_lower=$(echo "$expected" | tr '[:upper:]' '[:lower:]')
    
    if [ "$val_lower" == "$expected_lower" ]; then
        echo "✅ $contract_name.usdc() matches"
    else
        echo "❌ $contract_name.usdc() = $val (expected $expected)"
        ERRORS=$((ERRORS + 1))
    fi
}

if [ "$AMM_ENGINE" != "null" ]; then validate_link "AMMEngine" $AMM_ENGINE $USDC; fi
if [ "$COLLATERALIZER" != "null" ]; then validate_link "Collateralizer" $COLLATERALIZER $USDC; fi
if [ "$LAUNCHPAD_ENGINE" != "null" ]; then validate_link "LaunchpadEngine" $LAUNCHPAD_ENGINE $USDC; fi
echo ""

# 3. Verify V9 Engine Links
echo "--- Step 3: Verify Engine Topology ---"

# AMMEngine.router() -> LaunchpadEngine (if set)
if [ "$AMM_ENGINE" != "null" ] && [ "$LAUNCHPAD_ENGINE" != "null" ]; then
    VAL=$(call_contract $AMM_ENGINE "router()(address)")
    VAL_L=$(echo "$VAL" | tr '[:upper:]' '[:lower:]')
    EXP_L=$(echo "$LAUNCHPAD_ENGINE" | tr '[:upper:]' '[:lower:]')
    
    if [ "$VAL_L" == "$EXP_L" ]; then
        echo "✅ AMMEngine.router() -> LaunchpadEngine"
    else
        echo "⚠️  AMMEngine.router() = $VAL (expected LaunchpadEngine for full integration)"
        # Not a hard error if we are in partial setup, but usually expected
    fi
fi

# LaunchpadEngine.ammEngine()
if [ "$LAUNCHPAD_ENGINE" != "null" ]; then
    VAL=$(call_contract $LAUNCHPAD_ENGINE "ammEngine()(address)")
    VAL_L=$(echo "$VAL" | tr '[:upper:]' '[:lower:]')
    EXP_L=$(echo "$AMM_ENGINE" | tr '[:upper:]' '[:lower:]')
    
    if [ "$VAL_L" == "$EXP_L" ]; then
        echo "✅ LaunchpadEngine.ammEngine() matches"
    else
        echo "❌ LaunchpadEngine.ammEngine() = $VAL"
        ERRORS=$((ERRORS + 1))
    fi
fi

# LaunchpadEngine.collateralizer()
if [ "$LAUNCHPAD_ENGINE" != "null" ]; then
    VAL=$(call_contract $LAUNCHPAD_ENGINE "collateralizer()(address)")
    VAL_L=$(echo "$VAL" | tr '[:upper:]' '[:lower:]')
    EXP_L=$(echo "$COLLATERALIZER" | tr '[:upper:]' '[:lower:]')
    
    if [ "$VAL_L" == "$EXP_L" ]; then
        echo "✅ LaunchpadEngine.collateralizer() matches"
    else
        echo "❌ LaunchpadEngine.collateralizer() = $VAL"
        ERRORS=$((ERRORS + 1))
    fi
fi

# LaunchpadEngine.tickBook()
if [ "$LAUNCHPAD_ENGINE" != "null" ]; then
    VAL=$(call_contract $LAUNCHPAD_ENGINE "tickBook()(address)")
    VAL_L=$(echo "$VAL" | tr '[:upper:]' '[:lower:]')
    EXP_L=$(echo "$TICKBOOK" | tr '[:upper:]' '[:lower:]')
    
    if [ "$VAL_L" == "$EXP_L" ]; then
        echo "✅ LaunchpadEngine.tickBook() matches"
    else
        echo "❌ LaunchpadEngine.tickBook() = $VAL"
        ERRORS=$((ERRORS + 1))
    fi
fi
echo ""

# 4. Verify Markets
echo "--- Step 4: Verify markets.json ---"

# Extract all real-mode markets for this chain from markets.json
MARKET_IDS=$(jq -r --argjson chainId "$CHAIN_ID" '.markets[] | select(.mode == "real" and .chainId == $chainId) | .id' "$MARKETS_JSON" 2>/dev/null)

if [ -z "$MARKET_IDS" ]; then
    echo "⚠️  No real markets found in markets.json for chainId=$CHAIN_ID"
else
    # We iterate by ID to fetch address and name nicely
    for MID in $MARKET_IDS; do
        ADDR=$(jq -r --arg mid "$MID" '.markets[] | select(.id == $mid) | .contractAddress' "$MARKETS_JSON")
        NAME=$(jq -r --arg mid "$MID" '.markets[] | select(.id == $mid) | .name' "$MARKETS_JSON")
        
        if [ "$ADDR" != "null" ] && [ -n "$ADDR" ]; then
            # 1. Check code
            CODE=$(get_code $ADDR)
            if [ "$CODE" == "0x" ] || [ -z "$CODE" ] || [ "$CODE" == "null" ]; then
                echo "❌ $MID ($NAME): NO CODE at $ADDR"
                ERRORS=$((ERRORS + 1))
                continue
            fi
            
            # 2. Check AMMEngine state (initialized)
            # Use cast call directly to check if getMarketState success
            # getMarketState(address) signature 0x1f7b8cb0 (Need to verify this)
            # Actually let's use cast call which handles text signature
            IS_INIT=$(cast call $AMM_ENGINE "getMarketState(address)(uint256,uint256,uint256)" "$ADDR" --rpc-url $RPC_URL 2>/dev/null | grep -v "revert" || echo "FAILED")
            
            if [ "$IS_INIT" != "FAILED" ] && [ -n "$IS_INIT" ]; then
                 echo "✅ $MID: AMM Initialized"
            else
                 echo "❌ $MID: AMM Not Initialized (getMarketState failed)"
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

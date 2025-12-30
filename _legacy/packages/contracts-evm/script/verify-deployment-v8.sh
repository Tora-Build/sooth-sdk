#!/bin/bash
# verify-deployment-v8.sh
# Validates that V8 deployments are consistent with on-chain state
# Run after any V8 deployment to catch config errors BEFORE frontend testing

set -e

RPC_URL="${RPC_URL:-https://sepolia.base.org}"
NETWORK="${NETWORK:-baseSepolia}"
CHAIN_ID="${CHAIN_ID:-84532}"

# Resolve paths relative to this script
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../../.." >/dev/null 2>&1 && pwd)"
DEPLOYMENTS_JSON="${REPO_ROOT}/apps/web/src/config/deployments.json"
MARKETS_JSON="${REPO_ROOT}/apps/web/src/config/markets.json"
V8_DEPLOYMENT="${SCRIPT_DIR}/../deployments/v8-latest.json"

echo "=========================================="
echo "  V8 Deployment Verification Script"
echo "=========================================="
echo "RPC: $RPC_URL"
echo "Network: $NETWORK"
echo "Chain ID: $CHAIN_ID"
echo ""

ERRORS=0

# Load addresses from environment or v8-latest.json
if [ -f "$V8_DEPLOYMENT" ]; then
    echo "Loading addresses from v8-latest.json..."
    LAUNCHPAD_ENGINE=$(jq -r '.launchpadEngine // empty' "$V8_DEPLOYMENT")
    COLLATERALIZER=$(jq -r '.collateralizer // empty' "$V8_DEPLOYMENT")
    AMM_ENGINE=$(jq -r '.ammEngine // empty' "$V8_DEPLOYMENT")
    TICK_BOOK=$(jq -r '.tickBook // empty' "$V8_DEPLOYMENT")
    OUTCOME_TOKEN=$(jq -r '.outcomeToken // empty' "$V8_DEPLOYMENT")
else
    echo "⚠️  v8-latest.json not found, using environment variables..."
    LAUNCHPAD_ENGINE="${LAUNCHPAD_ENGINE}"
    COLLATERALIZER="${COLLATERALIZER}"
    AMM_ENGINE="${AMM_ENGINE}"
    TICK_BOOK="${TICK_BOOK}"
    OUTCOME_TOKEN="${OUTCOME_TOKEN}"
fi

# USDC address (prefer env; otherwise fall back to canonical Base Sepolia MockUSDC from apps/web deployments.json)
USDC="${USDC_ADDRESS:-}"
if [ -z "$USDC" ] && [ -f "$DEPLOYMENTS_JSON" ]; then
  USDC=$(jq -r '.networks.baseSepolia.contracts.MockUSDC // empty' "$DEPLOYMENTS_JSON")
fi
if [ -z "$USDC" ] || [ "$USDC" == "null" ]; then
  # Legacy fallback (should be overridden)
  USDC="0x8dD2ABE2a78BB70F8E0fFE363BbFdc6022aA00Cd"
fi

echo "V8 Contract Addresses:"
echo "  LaunchpadEngine: $LAUNCHPAD_ENGINE"
echo "  Collateralizer:  $COLLATERALIZER"
echo "  AMMEngine:       $AMM_ENGINE"
echo "  TickBook:        $TICK_BOOK"
echo "  OutcomeToken:    $OUTCOME_TOKEN"
echo "  USDC:            $USDC"
echo ""

# Helper: Get contract code
get_code() {
    local addr=$1
    cast code $addr --rpc-url $RPC_URL 2>/dev/null || echo "0x"
}

# Helper: Call contract
call_contract() {
    local to=$1
    local sig=$2
    shift 2
    cast call $to "$sig" "$@" --rpc-url $RPC_URL 2>/dev/null || echo "FAILED"
}

# Helper: Check code exists
check_code() {
    local name=$1
    local addr=$2
    if [ -z "$addr" ] || [ "$addr" == "null" ]; then
        echo "⚠️  $name: Address not set (skipping)"
        return
    fi
    local code=$(get_code $addr)
    if [ "$code" == "0x" ] || [ -z "$code" ]; then
        echo "❌ $name ($addr): NO CODE ON CHAIN"
        ERRORS=$((ERRORS + 1))
    else
        echo "✅ $name: Has code"
    fi
}

# 1. Verify all core contracts have code
echo "--- Step 1: Verify Core Contracts Exist ---"
check_code "LaunchpadEngine" $LAUNCHPAD_ENGINE
check_code "Collateralizer" $COLLATERALIZER
check_code "AMMEngine" $AMM_ENGINE
check_code "TickBook" $TICK_BOOK
check_code "OutcomeToken" $OUTCOME_TOKEN
check_code "USDC" $USDC
echo ""

# 2. Verify LaunchpadEngine configuration
echo "--- Step 2: Verify LaunchpadEngine Config ---"
if [ -n "$LAUNCHPAD_ENGINE" ] && [ "$LAUNCHPAD_ENGINE" != "null" ]; then
    # Check USDC address
    LE_USDC=$(call_contract $LAUNCHPAD_ENGINE "usdc()(address)")
    LE_USDC_LOWER=$(echo "$LE_USDC" | tr '[:upper:]' '[:lower:]')
    USDC_LOWER=$(echo "$USDC" | tr '[:upper:]' '[:lower:]')
    if [ "$LE_USDC_LOWER" == "$USDC_LOWER" ]; then
        echo "✅ LaunchpadEngine.usdc() matches expected USDC"
    else
        echo "❌ LaunchpadEngine.usdc() = $LE_USDC (expected $USDC)"
        ERRORS=$((ERRORS + 1))
    fi
    
    # Check AMMEngine address
    LE_AMM=$(call_contract $LAUNCHPAD_ENGINE "ammEngine()(address)")
    LE_AMM_LOWER=$(echo "$LE_AMM" | tr '[:upper:]' '[:lower:]')
    AMM_LOWER=$(echo "$AMM_ENGINE" | tr '[:upper:]' '[:lower:]')
    if [ "$LE_AMM_LOWER" == "$AMM_LOWER" ]; then
        echo "✅ LaunchpadEngine.ammEngine() matches expected AMMEngine"
    else
        echo "❌ LaunchpadEngine.ammEngine() = $LE_AMM (expected $AMM_ENGINE)"
        ERRORS=$((ERRORS + 1))
    fi
    
    # Check owner
    LE_OWNER=$(call_contract $LAUNCHPAD_ENGINE "owner()(address)")
    echo "ℹ️  LaunchpadEngine.owner() = $LE_OWNER"
else
    echo "⚠️  LaunchpadEngine address not set, skipping config checks"
fi
echo ""

# 3. Verify Collateralizer configuration
echo "--- Step 3: Verify Collateralizer Config ---"
if [ -n "$COLLATERALIZER" ] && [ "$COLLATERALIZER" != "null" ]; then
    # Check USDC address
    COLL_USDC=$(call_contract $COLLATERALIZER "usdc()(address)")
    COLL_USDC_LOWER=$(echo "$COLL_USDC" | tr '[:upper:]' '[:lower:]')
    if [ "$COLL_USDC_LOWER" == "$USDC_LOWER" ]; then
        echo "✅ Collateralizer.usdc() matches expected USDC"
    else
        echo "❌ Collateralizer.usdc() = $COLL_USDC (expected $USDC)"
        ERRORS=$((ERRORS + 1))
    fi
    
    # Note: V8 Collateralizer creates OutcomeTokens dynamically (no implementation pattern)
    echo "ℹ️  Collateralizer creates OutcomeTokens dynamically (no impl contract)"
else
    echo "⚠️  Collateralizer address not set, skipping config checks"
fi
echo ""

# 4. Verify AMMEngine configuration
echo "--- Step 4: Verify AMMEngine Config ---"
if [ -n "$AMM_ENGINE" ] && [ "$AMM_ENGINE" != "null" ]; then
    # Check USDC address
    AMM_USDC=$(call_contract $AMM_ENGINE "usdc()(address)")
    AMM_USDC_LOWER=$(echo "$AMM_USDC" | tr '[:upper:]' '[:lower:]')
    if [ "$AMM_USDC_LOWER" == "$USDC_LOWER" ]; then
        echo "✅ AMMEngine.usdc() matches expected USDC"
    else
        echo "❌ AMMEngine.usdc() = $AMM_USDC (expected $USDC)"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "⚠️  AMMEngine address not set, skipping config checks"
fi
echo ""

# 5. Verify V8 markets (if deployed via DeployV8Markets.s.sol)
echo "--- Step 5: Verify V8 Markets (if deployed) ---"
V8_MARKETS_JSON="${SCRIPT_DIR}/../deployments/v8-markets.json"
if [ -f "$V8_MARKETS_JSON" ]; then
  MARKET1=$(jq -r '.market1.address // empty' "$V8_MARKETS_JSON")
  MARKET2=$(jq -r '.market2.address // empty' "$V8_MARKETS_JSON")

  for MARKET in "$MARKET1" "$MARKET2"; do
    if [ -z "$MARKET" ] || [ "$MARKET" == "null" ]; then
      continue
    fi

    echo "Market: $MARKET"
    check_code "TruthMarket" $MARKET

    IS_LIVE=$(call_contract $MARKET "isLive()(bool)")
    if [ "$IS_LIVE" == "true" ]; then
      echo "✅ TruthMarket.isLive() = true"
    else
      echo "❌ TruthMarket.isLive() = $IS_LIVE (expected true)"
      ERRORS=$((ERRORS + 1))
    fi

    # LaunchpadEngine should have market registered (creator != 0)
    if [ -n "$LAUNCHPAD_ENGINE" ] && [ "$LAUNCHPAD_ENGINE" != "null" ]; then
      CREATOR=$(call_contract $LAUNCHPAD_ENGINE "markets(address)(address,uint256,uint256,uint256,uint256,uint256,uint256,bool,uint64,uint64)" $MARKET | head -n 1)
      if [ "$CREATOR" != "FAILED" ] && [ "$CREATOR" != "0x0000000000000000000000000000000000000000" ]; then
        echo "✅ LaunchpadEngine.market.creator set"
      else
        echo "❌ LaunchpadEngine.market.creator missing (market not registered?)"
        ERRORS=$((ERRORS + 1))
      fi
    fi

    # Collateralizer should have market registered
    if [ -n "$COLLATERALIZER" ] && [ "$COLLATERALIZER" != "null" ]; then
      IS_REG=$(call_contract $COLLATERALIZER "isMarketRegistered(address)(bool)" $MARKET)
      if [ "$IS_REG" == "true" ]; then
        echo "✅ Collateralizer.isMarketRegistered(market) = true"
      else
        echo "❌ Collateralizer.isMarketRegistered(market) = $IS_REG (expected true)"
        ERRORS=$((ERRORS + 1))
      fi
    fi

    # AMMEngine should have initialized state (getLiquidity > 0)
    if [ -n "$AMM_ENGINE" ] && [ "$AMM_ENGINE" != "null" ]; then
      LIQ=$(call_contract $AMM_ENGINE "getLiquidity(address)(uint256)" $MARKET)
      if [ "$LIQ" != "FAILED" ] && [ "$LIQ" != "0" ]; then
        echo "✅ AMMEngine.getLiquidity(market) non-zero"
      else
        echo "❌ AMMEngine.getLiquidity(market) failed or returned 0"
        ERRORS=$((ERRORS + 1))
      fi
    fi

    echo ""
  done
else
  echo "⚠️  No markets deployed (deployments/v8-markets.json not found)"
fi
echo ""

# 6. Verify frontend config (if exists)
echo "--- Step 6: Verify Frontend Config ---"
if [ -f "$DEPLOYMENTS_JSON" ]; then
    # Check if V8 addresses are in frontend config
    FE_LAUNCHPAD=$(jq -r --arg chainId "$CHAIN_ID" '.networks[] | select(.chainId == ($chainId | tonumber)) | .contracts.LaunchpadEngine // empty' "$DEPLOYMENTS_JSON")
    
    if [ -n "$FE_LAUNCHPAD" ] && [ "$FE_LAUNCHPAD" != "null" ]; then
        FE_LAUNCHPAD_LOWER=$(echo "$FE_LAUNCHPAD" | tr '[:upper:]' '[:lower:]')
        LE_LOWER=$(echo "$LAUNCHPAD_ENGINE" | tr '[:upper:]' '[:lower:]')
        if [ "$FE_LAUNCHPAD_LOWER" == "$LE_LOWER" ]; then
            echo "✅ Frontend config LaunchpadEngine matches deployment"
        else
            echo "❌ Frontend config LaunchpadEngine = $FE_LAUNCHPAD (expected $LAUNCHPAD_ENGINE)"
            echo "   Update apps/web/src/config/deployments.json"
            ERRORS=$((ERRORS + 1))
        fi
    else
        echo "⚠️  LaunchpadEngine not found in frontend config"
        echo "   Update apps/web/src/config/deployments.json with V8 addresses"
    fi
else
    echo "⚠️  Frontend config not found at $DEPLOYMENTS_JSON"
fi
echo ""

# Summary
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
    echo "✅ ALL CHECKS PASSED"
    echo ""
    echo "Next steps:"
    echo "1. Update frontend config if needed"
    echo "2. Run sync script: ./sync-deployments.sh"
    echo "3. Test frontend: cd apps/web && npm run dev"
    exit 0
else
    echo "❌ $ERRORS ERROR(S) FOUND"
    echo ""
    echo "Fix issues before proceeding:"
    echo "1. Check contract addresses in .env"
    echo "2. Verify contracts deployed to correct network"
    echo "3. Re-run deployment if needed"
    exit 1
fi

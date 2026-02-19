#!/usr/bin/env bash
# verify-deployment.sh
# Validates V12 deployment topology and market registration using RPC-only calls.

set -euo pipefail

NETWORK="${NETWORK:-baseSepolia}"

if [ -z "${RPC_URL:-}" ]; then
  case "$NETWORK" in
    baseSepolia) RPC_URL="https://sepolia.base.org" ;;
    monadTestnet) RPC_URL="https://testnet-rpc.monad.xyz" ;;
    arcTestnet) RPC_URL="https://rpc.testnet.arc.network" ;;
    *) RPC_URL="https://sepolia.base.org" ;;
  esac
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../../.." >/dev/null 2>&1 && pwd)"
DEPLOYMENTS_JSON="${REPO_ROOT}/apps/web/src/config/deployments.json"

echo "=========================================="
echo "  V12 Deployment Verification Script"
echo "=========================================="
echo "RPC: $RPC_URL"
echo "Network: $NETWORK"
echo ""

if [ ! -f "$DEPLOYMENTS_JSON" ]; then
  echo "❌ deployments.json not found: $DEPLOYMENTS_JSON"
  exit 1
fi

CHAIN_ID=$(jq -r --arg net "$NETWORK" '.networks[$net].chainId // empty' "$DEPLOYMENTS_JSON")
if [ -z "$CHAIN_ID" ] || [ "$CHAIN_ID" = "null" ]; then
  echo "❌ Could not resolve chainId for NETWORK=$NETWORK in deployments.json"
  exit 1
fi

MOCK_USDC=$(jq -r --arg net "$NETWORK" '.networks[$net].contracts.MockUSDC // empty' "$DEPLOYMENTS_JSON")
PROTOCOL_CONFIG=$(jq -r --arg net "$NETWORK" '.networks[$net].contracts.ProtocolConfig // empty' "$DEPLOYMENTS_JSON")
COLLATERALIZER=$(jq -r --arg net "$NETWORK" '.networks[$net].contracts.Collateralizer // empty' "$DEPLOYMENTS_JSON")
AMM_ENGINE=$(jq -r --arg net "$NETWORK" '.networks[$net].contracts.AMMEngine // empty' "$DEPLOYMENTS_JSON")
SOOTH_BOOK=$(jq -r --arg net "$NETWORK" '.networks[$net].contracts.SoothBook // empty' "$DEPLOYMENTS_JSON")
LAUNCHPAD_ENGINE=$(jq -r --arg net "$NETWORK" '.networks[$net].contracts.LaunchpadEngine // empty' "$DEPLOYMENTS_JSON")

MARKET_KEYS_RAW="$(jq -r --arg net "$NETWORK" '.networks[$net].markets[]? // empty' "$DEPLOYMENTS_JSON")"

echo "Config Addresses:"
echo "  ChainId:         $CHAIN_ID"
echo "  MockUSDC:        $MOCK_USDC"
echo "  ProtocolConfig:  $PROTOCOL_CONFIG"
echo "  Collateralizer:  $COLLATERALIZER"
echo "  AMMEngine:       $AMM_ENGINE"
echo "  SoothBook:       $SOOTH_BOOK"
echo "  LaunchpadEngine: $LAUNCHPAD_ENGINE"
if [ -n "$MARKET_KEYS_RAW" ]; then
  MARKET_KEY_COUNT=$(printf "%s\n" "$MARKET_KEYS_RAW" | sed '/^$/d' | wc -l | tr -d ' ')
else
  MARKET_KEY_COUNT=0
fi
echo "  MarketKeys:      ${MARKET_KEY_COUNT}"
echo ""

ERRORS=0
WARNINGS=0

json_rpc() {
  local method="$1"
  local params="$2"
  curl -s -X POST \
    -H "Content-Type: application/json" \
    --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"${method}\",\"params\":${params}}" \
    "$RPC_URL"
}

eth_get_code() {
  local addr="$1"
  json_rpc "eth_getCode" "[\"${addr}\",\"latest\"]" | jq -r '.result // "0x"'
}

eth_call() {
  local to="$1"
  local data="$2"
  json_rpc "eth_call" "[{\"to\":\"${to}\",\"data\":\"${data}\"},\"latest\"]" | jq -r '.result // "0x"'
}

to_lower() {
  echo "$1" | tr '[:upper:]' '[:lower:]'
}

decode_address() {
  local hex="$1"
  if [[ ! "$hex" =~ ^0x[0-9a-fA-F]+$ ]] || [ "${#hex}" -lt 42 ]; then
    echo ""
    return
  fi
  echo "0x${hex: -40}" | tr '[:upper:]' '[:lower:]'
}

decode_bool() {
  local hex="$1"
  if [[ ! "$hex" =~ ^0x[0-9a-fA-F]+$ ]] || [ "${#hex}" -lt 3 ]; then
    echo "false"
    return
  fi
  if [ "${hex: -1}" = "1" ]; then
    echo "true"
  else
    echo "false"
  fi
}

decode_u256() {
  local hex="$1"
  python3 - "$hex" <<'PY'
import sys
h = sys.argv[1]
if not h.startswith("0x"):
    print("0")
else:
    print(int(h, 16))
PY
}

require_nonempty_addr() {
  local name="$1"
  local addr="$2"
  if [[ ! "$addr" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
    echo "❌ ${name}: missing/invalid address in deployments.json (${addr})"
    ERRORS=$((ERRORS + 1))
  fi
}

check_code() {
  local name="$1"
  local addr="$2"
  if [[ ! "$addr" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
    return
  fi
  local code
  code="$(eth_get_code "$addr")"
  if [ "$code" = "0x" ] || [ -z "$code" ] || [ "$code" = "null" ]; then
    echo "❌ ${name} (${addr}): no code on chain"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅ ${name}: has code"
  fi
}

check_link_address() {
  local label="$1"
  local contract_addr="$2"
  local selector="$3"
  local expected_addr="$4"
  local hard_fail="$5"

  local raw
  raw="$(eth_call "$contract_addr" "$selector")"
  local got
  got="$(decode_address "$raw")"
  local expected
  expected="$(to_lower "$expected_addr")"

  if [ -z "$got" ]; then
    if [ "$hard_fail" = "true" ]; then
      echo "❌ ${label}: call failed"
      ERRORS=$((ERRORS + 1))
    else
      echo "⚠️  ${label}: call failed"
      WARNINGS=$((WARNINGS + 1))
    fi
    return
  fi

  if [ "$got" = "$expected" ]; then
    echo "✅ ${label}"
  else
    if [ "$hard_fail" = "true" ]; then
      echo "❌ ${label}: ${got} (expected ${expected})"
      ERRORS=$((ERRORS + 1))
    else
      echo "⚠️  ${label}: ${got} (expected ${expected})"
      WARNINGS=$((WARNINGS + 1))
    fi
  fi
}

echo "--- Step 1: Validate Config Addresses ---"
require_nonempty_addr "MockUSDC" "$MOCK_USDC"
require_nonempty_addr "ProtocolConfig" "$PROTOCOL_CONFIG"
require_nonempty_addr "Collateralizer" "$COLLATERALIZER"
require_nonempty_addr "AMMEngine" "$AMM_ENGINE"
require_nonempty_addr "SoothBook" "$SOOTH_BOOK"
require_nonempty_addr "LaunchpadEngine" "$LAUNCHPAD_ENGINE"
echo ""

echo "--- Step 2: Verify Contract Code ---"
check_code "MockUSDC" "$MOCK_USDC"
check_code "ProtocolConfig" "$PROTOCOL_CONFIG"
check_code "Collateralizer" "$COLLATERALIZER"
check_code "AMMEngine" "$AMM_ENGINE"
check_code "SoothBook" "$SOOTH_BOOK"
check_code "LaunchpadEngine" "$LAUNCHPAD_ENGINE"
echo ""

echo "--- Step 3: Verify Topology Links ---"
# selectors
SEL_USDC="0x3e413bee"
SEL_AMM_ENGINE="0x7a3c2cca"
SEL_COLLATERALIZER="0x869f0511"
SEL_SOOTHBOOK="0x5ecd5a64"
SEL_PROTOCOL_CONFIG="0xf5efbb4f"
SEL_ROUTER="0xf887ea40"
SEL_OWNER="0x8da5cb5b"

check_link_address "LaunchpadEngine.usdc() -> MockUSDC" "$LAUNCHPAD_ENGINE" "$SEL_USDC" "$MOCK_USDC" "true"
check_link_address "LaunchpadEngine.ammEngine() -> AMMEngine" "$LAUNCHPAD_ENGINE" "$SEL_AMM_ENGINE" "$AMM_ENGINE" "true"
check_link_address "LaunchpadEngine.collateralizer() -> Collateralizer" "$LAUNCHPAD_ENGINE" "$SEL_COLLATERALIZER" "$COLLATERALIZER" "true"
check_link_address "LaunchpadEngine.soothBook() -> SoothBook" "$LAUNCHPAD_ENGINE" "$SEL_SOOTHBOOK" "$SOOTH_BOOK" "true"
check_link_address "AMMEngine.usdc() -> MockUSDC" "$AMM_ENGINE" "$SEL_USDC" "$MOCK_USDC" "true"
check_link_address "Collateralizer.usdc() -> MockUSDC" "$COLLATERALIZER" "$SEL_USDC" "$MOCK_USDC" "true"
check_link_address "AMMEngine.protocolConfig() -> ProtocolConfig" "$AMM_ENGINE" "$SEL_PROTOCOL_CONFIG" "$PROTOCOL_CONFIG" "true"
check_link_address "AMMEngine.router() -> LaunchpadEngine" "$AMM_ENGINE" "$SEL_ROUTER" "$LAUNCHPAD_ENGINE" "false"
check_link_address "SoothBook.owner() -> LaunchpadEngine" "$SOOTH_BOOK" "$SEL_OWNER" "$LAUNCHPAD_ENGINE" "true"
echo ""

echo "--- Step 4: Verify SoothBook Market Keys ---"
SEL_MARKETS="0x7564912b"
if [ "$MARKET_KEY_COUNT" -eq 0 ]; then
  echo "⚠️  No market keys configured in deployments.json for ${NETWORK}"
  WARNINGS=$((WARNINGS + 1))
else
  while IFS= read -r key; do
    if [ -z "$key" ]; then
      continue
    fi
    if [[ ! "$key" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
      echo "❌ Invalid market key format: ${key}"
      ERRORS=$((ERRORS + 1))
      continue
    fi

    raw="$(eth_call "$SOOTH_BOOK" "${SEL_MARKETS}${key#0x}")"
    if [[ ! "$raw" =~ ^0x[0-9a-fA-F]+$ ]] || [ "${#raw}" -lt 386 ]; then
      echo "❌ SoothBook.markets(${key}) call failed"
      ERRORS=$((ERRORS + 1))
      continue
    fi

    # tuple layout: collateral, yesToken, noToken, active, finalized, outcome
    w1="${raw:2:64}"
    w2="${raw:66:64}"
    w3="${raw:130:64}"
    w4="${raw:194:64}"
    w6="${raw:322:64}"

    collateral="0x${w1:24:40}"
    yes_token="0x${w2:24:40}"
    no_token="0x${w3:24:40}"
    active="$(decode_bool "0x${w4}")"
    outcome="$(decode_u256 "0x${w6}")"

    if [ "$collateral" = "0x0000000000000000000000000000000000000000" ] && \
       [ "$yes_token" = "0x0000000000000000000000000000000000000000" ] && \
       [ "$no_token" = "0x0000000000000000000000000000000000000000" ] && \
       [ "$active" != "true" ]; then
      echo "⚠️  ${key}: not registered in SoothBook yet (Launchpad market may exist before first SoothBook interaction)"
      WARNINGS=$((WARNINGS + 1))
      continue
    fi

    if [ "$(to_lower "$collateral")" != "$(to_lower "$MOCK_USDC")" ]; then
      echo "❌ ${key}: collateral mismatch ${collateral} (expected ${MOCK_USDC})"
      ERRORS=$((ERRORS + 1))
      continue
    fi
    if [ "$yes_token" = "0x0000000000000000000000000000000000000000" ] || [ "$no_token" = "0x0000000000000000000000000000000000000000" ]; then
      echo "❌ ${key}: zero outcome token address"
      ERRORS=$((ERRORS + 1))
      continue
    fi
    if [ "$active" != "true" ]; then
      echo "❌ ${key}: market not active"
      ERRORS=$((ERRORS + 1))
      continue
    fi

    echo "✅ ${key}: active=${active}, outcome=${outcome}, yes=${yes_token}, no=${no_token}"
  done <<< "$MARKET_KEYS_RAW"
fi
echo ""

echo "=========================================="
if [ "$ERRORS" -eq 0 ]; then
  if [ "$WARNINGS" -gt 0 ]; then
    echo "✅ Verification passed with ${WARNINGS} warning(s)"
  else
    echo "✅ All checks passed"
  fi
  exit 0
else
  echo "❌ Verification failed: ${ERRORS} error(s), ${WARNINGS} warning(s)"
  exit 1
fi

#!/bin/bash
#
# Fresh V8.1 deployment to Base Sepolia (infra + markets) and config sync.
#
# Requirements:
# - Foundry installed (forge, cast)
# - jq installed
# - Env vars:
#   - PRIVATE_KEY            (deployer EOA private key, hex without 0x)
#   - GUARDIAN_ADDRESS       (guardian address for TruthMarket)
#   - DEFAULT_ADJUDICATOR    (adjudicator address for TruthMarket)
# Optional:
#   - USDC_ADDRESS           (defaults to apps/web/src/config/deployments.json baseSepolia.MockUSDC)
#   - ETHERSCAN_API_KEY      (for --verify)
#
# This script:
# 1) Deploys V8 infra via packages/contracts-evm/script/DeployV8.s.sol
# 2) Deploys the two default markets via packages/contracts-evm/script/DeployV8Markets.s.sol
# 3) Updates apps/web/src/config/{deployments.json,markets.json} for Base Sepolia
# 4) Runs ./sync-deployments.sh
# 5) Runs the V8 verification script
#
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

DEPLOYMENTS_JSON="$REPO_ROOT/apps/web/src/config/deployments.json"
MARKETS_JSON="$REPO_ROOT/apps/web/src/config/markets.json"
V8_LATEST_JSON="$REPO_ROOT/packages/contracts-evm/deployments/v8-latest.json"
V8_MARKETS_JSON="$REPO_ROOT/packages/contracts-evm/deployments/v8-markets.json"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required. Install it first."
  exit 1
fi

if [ -z "${PRIVATE_KEY:-}" ]; then
  echo "Missing PRIVATE_KEY env var."
  exit 1
fi
if [ -z "${GUARDIAN_ADDRESS:-}" ]; then
  echo "Missing GUARDIAN_ADDRESS env var."
  exit 1
fi
if [ -z "${DEFAULT_ADJUDICATOR:-}" ]; then
  echo "Missing DEFAULT_ADJUDICATOR env var."
  exit 1
fi

if [ -z "${USDC_ADDRESS:-}" ]; then
  USDC_ADDRESS="$(jq -r '.networks.baseSepolia.contracts.MockUSDC // empty' "$DEPLOYMENTS_JSON")"
  if [ -z "$USDC_ADDRESS" ] || [ "$USDC_ADDRESS" == "null" ]; then
    echo "Could not infer USDC_ADDRESS from deployments.json; set USDC_ADDRESS explicitly."
    exit 1
  fi
  export USDC_ADDRESS
fi

echo "================================================="
echo " Deploying V8.1 to Base Sepolia"
echo "================================================="
echo "USDC_ADDRESS:        $USDC_ADDRESS"
echo "GUARDIAN_ADDRESS:    $GUARDIAN_ADDRESS"
echo "DEFAULT_ADJUDICATOR: $DEFAULT_ADJUDICATOR"
echo ""

pushd "$REPO_ROOT/packages/contracts-evm" >/dev/null

echo "--- Step 1: Deploy infra (DeployV8) ---"
forge script script/DeployV8.s.sol:DeployV8 \
  --rpc-url baseSepolia \
  --broadcast \
  ${ETHERSCAN_API_KEY:+--verify} \
  -vvv

echo ""
echo "--- Step 2: Deploy markets (DeployV8Markets) ---"
export LAUNCHPAD_ENGINE="$(jq -r '.launchpadEngine' "$V8_LATEST_JSON")"
export COLLATERALIZER="$(jq -r '.collateralizer' "$V8_LATEST_JSON")"
forge script script/DeployV8Markets.s.sol:DeployV8Markets \
  --rpc-url baseSepolia \
  --broadcast \
  ${ETHERSCAN_API_KEY:+--verify} \
  -vvv

popd >/dev/null

echo ""
echo "--- Step 3: Update frontend config from deployments/v8-*.json ---"
AMM_ENGINE="$(jq -r '.ammEngine' "$V8_LATEST_JSON")"
TICK_BOOK="$(jq -r '.tickBook' "$V8_LATEST_JSON")"
LAUNCHPAD_ENGINE="$(jq -r '.launchpadEngine' "$V8_LATEST_JSON")"
COLLATERALIZER="$(jq -r '.collateralizer' "$V8_LATEST_JSON")"

BTC_MARKET="$(jq -r '.market2.address' "$V8_MARKETS_JSON")"
BTC_YES="$(jq -r '.market2.yesToken' "$V8_MARKETS_JSON")"
BTC_NO="$(jq -r '.market2.noToken' "$V8_MARKETS_JSON")"
BTC_DEADLINE="$(jq -r '.market2.deadline' "$V8_MARKETS_JSON")"

ALIEN_MARKET="$(jq -r '.market1.address' "$V8_MARKETS_JSON")"
ALIEN_YES="$(jq -r '.market1.yesToken' "$V8_MARKETS_JSON")"
ALIEN_NO="$(jq -r '.market1.noToken' "$V8_MARKETS_JSON")"
ALIEN_DEADLINE="$(jq -r '.market1.deadline' "$V8_MARKETS_JSON")"

NOW_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
CUR_VER="$(jq -r '.version' "$DEPLOYMENTS_JSON")"
IFS='.' read -r VER_MAJ VER_MIN VER_PATCH <<< "$CUR_VER"
NEW_VER="${VER_MAJ}.${VER_MIN}.$((VER_PATCH + 1))"

tmp="$(mktemp)"
jq \
  --arg ver "$NEW_VER" \
  --arg now "$NOW_UTC" \
  --arg usdc "$USDC_ADDRESS" \
  --arg le "$LAUNCHPAD_ENGINE" \
  --arg coll "$COLLATERALIZER" \
  --arg amm "$AMM_ENGINE" \
  --arg tick "$TICK_BOOK" \
  '
  .version = $ver
  | .lastUpdated = $now
  | .networks.baseSepolia.contracts.MockUSDC = $usdc
  | .networks.baseSepolia.contracts.LaunchpadEngine = $le
  | .networks.baseSepolia.contracts.Collateralizer = $coll
  | .networks.baseSepolia.contracts.AMMEngine = $amm
  | .networks.baseSepolia.contracts.TickBook = $tick
  ' "$DEPLOYMENTS_JSON" > "$tmp"
mv "$tmp" "$DEPLOYMENTS_JSON"

tmp="$(mktemp)"
jq \
  --arg btcMarket "$BTC_MARKET" --arg btcYes "$BTC_YES" --arg btcNo "$BTC_NO" --argjson btcDeadline "$BTC_DEADLINE" \
  --arg alienMarket "$ALIEN_MARKET" --arg alienYes "$ALIEN_YES" --arg alienNo "$ALIEN_NO" --argjson alienDeadline "$ALIEN_DEADLINE" \
  '
  .markets |= map(
    if (.id == "v8-btc-100k" and .chainId == 84532) then
      .contractAddress = $btcMarket
      | .yesToken = $btcYes
      | .noToken = $btcNo
      | .deadline = $btcDeadline
      | .version = "v8.1"
      | .isGraduated = false
    elif (.id == "v8-alien-life" and .chainId == 84532) then
      .contractAddress = $alienMarket
      | .yesToken = $alienYes
      | .noToken = $alienNo
      | .deadline = $alienDeadline
      | .version = "v8.1"
      | .isGraduated = false
    else .
    end
  )
  ' "$MARKETS_JSON" > "$tmp"
mv "$tmp" "$MARKETS_JSON"

echo "Updated:"
echo "  - apps/web/src/config/deployments.json (version -> $NEW_VER)"
echo "  - apps/web/src/config/markets.json (Base Sepolia BTC/ALIEN addresses + tokens)"

echo ""
echo "--- Step 4: Sync deployments.json to contracts package ---"
pushd "$REPO_ROOT" >/dev/null
./sync-deployments.sh
popd >/dev/null

echo ""
echo "--- Step 5: Verify deployment consistency ---"
pushd "$REPO_ROOT/packages/contracts-evm" >/dev/null
RPC_URL="https://sepolia.base.org" NETWORK="baseSepolia" CHAIN_ID="84532" ./script/verify-deployment-v8.sh
popd >/dev/null

echo ""
echo "✅ Done. Next: run 'cd apps/web && npm run dev' and trade on Base Sepolia."



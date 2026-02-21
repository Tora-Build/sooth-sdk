#!/usr/bin/env bash
#
# Deploy SoothPostAction to Lens Testnet (zkSync)
#
# Prerequisites:
#   1. Foundry-zksync installed: foundryup-zksync
#   2. GRASS tokens from faucet in deployer wallet
#   3. apps/lens/.env.local with LENS_PRIVATE_KEY set
#
# Usage:
#   bash packages/contracts-plugin/script/deploy-lens-testnet.sh

set -euo pipefail

# ─── Constants ───────────────────────────────────────────────────────────────
RPC_URL="https://rpc.testnet.lens.xyz"
CHAIN_ID=37111
WGRASS="0xeee5a340Cdc9c179Db25dea45AcfD5FE8d4d3eB8"
ACTION_HUB="0x4A92a97Ff3a3604410945ae8CA25df4fBB2fDC11"
EVIDENCE_DIR=".sisyphus/evidence"

# ─── Load credentials ───────────────────────────────────────────────────────
ENV_FILE="apps/lens/.env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Create it with LENS_PRIVATE_KEY."
  exit 1
fi

# Source env vars (handles lines like KEY=value)
set -a
source "$ENV_FILE"
set +a

if [ -z "${LENS_PRIVATE_KEY:-}" ]; then
  echo "ERROR: LENS_PRIVATE_KEY not set in $ENV_FILE"
  exit 1
fi

# ─── Derive deployer address ────────────────────────────────────────────────
DEPLOYER_ADDRESS=$(cast wallet address --private-key "$LENS_PRIVATE_KEY")
echo "═══════════════════════════════════════════════════════════════"
echo "  SoothPostAction → Lens Testnet Deployment"
echo "═══════════════════════════════════════════════════════════════"
echo "  Deployer:   $DEPLOYER_ADDRESS"
echo "  WGRASS:     $WGRASS"
echo "  ActionHub:  $ACTION_HUB"
echo "  Owner:      $DEPLOYER_ADDRESS"
echo "  RPC:        $RPC_URL"
echo "  Chain ID:   $CHAIN_ID"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ─── Check deployer balance ─────────────────────────────────────────────────
echo "[1/4] Checking deployer GRASS balance..."
BALANCE=$(cast balance "$DEPLOYER_ADDRESS" --rpc-url "$RPC_URL" --ether 2>/dev/null || echo "0")
echo "  Balance: $BALANCE GRASS"
echo ""

# ─── Deploy ─────────────────────────────────────────────────────────────────
echo "[2/4] Deploying SoothPostAction..."
echo "  (foundry-zksync: --constructor-args MUST be last flag)"
echo ""

cd packages/contracts-plugin

# Capture full output to parse deployed address
DEPLOY_OUTPUT=$(FOUNDRY_PROFILE=zksync forge create \
  src/lens/SoothPostAction.sol:SoothPostAction \
  --rpc-url "$RPC_URL" \
  --chain "$CHAIN_ID" \
  --private-key "$LENS_PRIVATE_KEY" \
  --zksync \
  --legacy \
  --constructor-args \
    "$WGRASS" \
    "$ACTION_HUB" \
    "$DEPLOYER_ADDRESS" \
  2>&1)

echo "$DEPLOY_OUTPUT"
echo ""

# Parse deployed address from output (line: "Deployed to: 0x...")
DEPLOYED_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -i "Deployed to:" | awk '{print $NF}')

if [ -z "$DEPLOYED_ADDRESS" ]; then
  echo "ERROR: Could not parse deployed address from forge output."
  echo "Full output:"
  echo "$DEPLOY_OUTPUT"
  exit 1
fi

echo "  ✓ Deployed to: $DEPLOYED_ADDRESS"
echo ""

# Return to repo root
cd ../..

# ─── Save deployed address ──────────────────────────────────────────────────
echo "[3/4] Saving deployed address..."
mkdir -p "$EVIDENCE_DIR"
echo "$DEPLOYED_ADDRESS" > "$EVIDENCE_DIR/task-5-deployed-address.txt"
echo "  ✓ Saved to $EVIDENCE_DIR/task-5-deployed-address.txt"
echo ""

# ─── Verify deployment ──────────────────────────────────────────────────────
echo "[4/4] Verifying deployment..."
VERIFY_FILE="$EVIDENCE_DIR/task-5-deployment-verify.txt"
echo "SoothPostAction Deployment Verification" > "$VERIFY_FILE"
echo "=======================================" >> "$VERIFY_FILE"
echo "Date: $(date -u)" >> "$VERIFY_FILE"
echo "Address: $DEPLOYED_ADDRESS" >> "$VERIFY_FILE"
echo "Chain: Lens Testnet ($CHAIN_ID)" >> "$VERIFY_FILE"
echo "" >> "$VERIFY_FILE"

# Check bytecode exists
echo "  Checking bytecode..."
CODE=$(cast code "$DEPLOYED_ADDRESS" --rpc-url "$RPC_URL" 2>/dev/null)
if [ "$CODE" = "0x" ] || [ -z "$CODE" ]; then
  echo "  ✗ No bytecode at address — deployment may have failed!"
  echo "BYTECODE: EMPTY (FAILED)" >> "$VERIFY_FILE"
  exit 1
else
  CODE_LEN=${#CODE}
  echo "  ✓ Bytecode present ($CODE_LEN chars)"
  echo "BYTECODE: present ($CODE_LEN chars)" >> "$VERIFY_FILE"
fi

# Verify wgho()
echo "  Checking wgho()..."
WGHO_RESULT=$(cast call "$DEPLOYED_ADDRESS" "wgho()(address)" --rpc-url "$RPC_URL" 2>/dev/null)
echo "  wgho() = $WGHO_RESULT"
echo "wgho(): $WGHO_RESULT (expected: $WGRASS)" >> "$VERIFY_FILE"
if [ "$(echo "$WGHO_RESULT" | tr '[:upper:]' '[:lower:]')" = "$(echo "$WGRASS" | tr '[:upper:]' '[:lower:]')" ]; then
  echo "  ✓ wgho matches"
else
  echo "  ✗ wgho MISMATCH!"
fi

# Verify actionHub()
echo "  Checking actionHub()..."
HUB_RESULT=$(cast call "$DEPLOYED_ADDRESS" "actionHub()(address)" --rpc-url "$RPC_URL" 2>/dev/null)
echo "  actionHub() = $HUB_RESULT"
echo "actionHub(): $HUB_RESULT (expected: $ACTION_HUB)" >> "$VERIFY_FILE"
if [ "$(echo "$HUB_RESULT" | tr '[:upper:]' '[:lower:]')" = "$(echo "$ACTION_HUB" | tr '[:upper:]' '[:lower:]')" ]; then
  echo "  ✓ actionHub matches"
else
  echo "  ✗ actionHub MISMATCH!"
fi

# Verify owner()
echo "  Checking owner()..."
OWNER_RESULT=$(cast call "$DEPLOYED_ADDRESS" "owner()(address)" --rpc-url "$RPC_URL" 2>/dev/null)
echo "  owner() = $OWNER_RESULT"
echo "owner(): $OWNER_RESULT (expected: $DEPLOYER_ADDRESS)" >> "$VERIFY_FILE"
if [ "$(echo "$OWNER_RESULT" | tr '[:upper:]' '[:lower:]')" = "$(echo "$DEPLOYER_ADDRESS" | tr '[:upper:]' '[:lower:]')" ]; then
  echo "  ✓ owner matches"
else
  echo "  ✗ owner MISMATCH!"
fi

echo "" >> "$VERIFY_FILE"
echo "VERIFICATION: COMPLETE" >> "$VERIFY_FILE"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Deployment Complete!"
echo "═══════════════════════════════════════════════════════════════"
echo "  Contract:   $DEPLOYED_ADDRESS"
echo "  Explorer:   https://explorer.testnet.lens.xyz/address/$DEPLOYED_ADDRESS"
echo "  Evidence:   $EVIDENCE_DIR/task-5-deployed-address.txt"
echo "  Verify:     $EVIDENCE_DIR/task-5-deployment-verify.txt"
echo "═══════════════════════════════════════════════════════════════"

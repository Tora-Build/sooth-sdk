#!/bin/bash

# Sync deployment files from contracts-core to frontend
# Run this after deploying contracts via forge script
#
# Source of truth: packages/contracts-core/deployments/*.json
# Target: apps/web/src/config/deployments.json

set -e

# Get repo root (this script is in apps/web/scripts/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CONTRACTS_DIR="$REPO_ROOT/packages/contracts-core/deployments"
FRONTEND_CONFIG="$REPO_ROOT/apps/web/src/config/deployments.json"

echo "📦 Syncing deployments from contracts-core to frontend..."
echo "Source: $CONTRACTS_DIR/*.json"
echo "Target: $FRONTEND_CONFIG"

# Check if source files exist
if [ ! -d "$CONTRACTS_DIR" ]; then
  echo "❌ Error: $CONTRACTS_DIR not found"
  exit 1
fi

# Build the frontend deployments.json from individual network files
# Start with empty structure
cat > "$FRONTEND_CONFIG" << 'EOF'
{
  "version": "",
  "networks": {}
}
EOF

# Read each *.json and merge into frontend config
FIRST_VERSION=""
for network_file in "$CONTRACTS_DIR"/*.json; do
  if [ ! -f "$network_file" ]; then
    echo "⚠️  No json deployment files found in $CONTRACTS_DIR"
    exit 1
  fi
  
  # Extract network name from filename (e.g., baseSepolia.json -> baseSepolia)
  filename=$(basename "$network_file")
  # Skip non-deployment files if any (simple heuristic: must have contracts key)
  if ! jq -e '.contracts' "$network_file" > /dev/null 2>&1; then
    continue
  fi

  network_name="${filename%.json}"
  
  echo "  Processing: $filename -> $network_name"
  
  # Extract version from first file
  if [ -z "$FIRST_VERSION" ]; then
    FIRST_VERSION=$(jq -r '.version' "$network_file")
  fi
  
  # Extract chainId and contracts
  chain_id=$(jq -r '.chainId' "$network_file")
  contracts=$(jq '.contracts' "$network_file")
  
  # Update frontend config with this network
  jq --arg network "$network_name" \
     --argjson chainId "$chain_id" \
     --argjson contracts "$contracts" \
     '.networks[$network] = {"chainId": $chainId, "contracts": $contracts}' \
     "$FRONTEND_CONFIG" > "$FRONTEND_CONFIG.tmp" && mv "$FRONTEND_CONFIG.tmp" "$FRONTEND_CONFIG"
done

# Set the version
jq --arg version "$FIRST_VERSION" '.version = $version' "$FRONTEND_CONFIG" > "$FRONTEND_CONFIG.tmp" \
  && mv "$FRONTEND_CONFIG.tmp" "$FRONTEND_CONFIG"

echo ""
echo "✅ Synced to: apps/web/src/config/deployments.json"
echo "   Version: $FIRST_VERSION"
echo ""
echo "Networks:"
jq -r '.networks | keys[]' "$FRONTEND_CONFIG" | while read network; do
  chain_id=$(jq -r ".networks[\"$network\"].chainId" "$FRONTEND_CONFIG")
  echo "  - $network (chainId: $chain_id)"
done

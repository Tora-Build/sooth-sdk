#!/bin/bash

# Sync deployment files between locations (Monorepo version)
# Run this after updating deployments.json

set -e

REPO_ROOT="$(dirname "$0")"
CANONICAL="$REPO_ROOT/apps/web/src/config/deployments.json"
CONTRACTS="$REPO_ROOT/packages/contracts-evm/deployments.json"
SOOTH_DAPP="$REPO_ROOT/packages/sooth-dapp/src/config/deployments.json"

echo "📦 Syncing deployment files..."
echo "Source: $CANONICAL"

# Ensure destination dirs exist
mkdir -p "$(dirname "$CONTRACTS")"
mkdir -p "$(dirname "$SOOTH_DAPP")"

# Copy from canonical source to all locations
cp "$CANONICAL" "$CONTRACTS"
cp "$CANONICAL" "$SOOTH_DAPP"

echo "✅ Synced to:"
echo "  - Contracts: packages/contracts-evm/deployments.json"
echo "  - Sooth dapp: packages/sooth-dapp/src/config/deployments.json"

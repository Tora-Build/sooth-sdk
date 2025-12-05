#!/bin/bash

# Sync deployment files between locations (Monorepo version)
# Run this after updating deployments.json

set -e

REPO_ROOT="$(dirname "$0")"
CANONICAL="$REPO_ROOT/packages/contracts-evm/docs/technical/frontend-integration/deployments.json"
CONTRACTS="$REPO_ROOT/packages/contracts-evm/deployments.json"
WEB="$REPO_ROOT/apps/web/docs/contract-integration/deployments.json"

echo "📦 Syncing deployment files..."

# Ensure destination dirs exist
mkdir -p "$(dirname "$WEB")"

# Copy from canonical source to all locations
cp "$CANONICAL" "$CONTRACTS"
cp "$CANONICAL" "$WEB"

echo "✅ Synced to:"
echo "  - Contracts: packages/contracts-evm/deployments.json"
echo "  - Web: apps/web/docs/contract-integration/deployments.json"

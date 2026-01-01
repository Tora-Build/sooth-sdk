#!/bin/bash

# Sync deployment files between locations (Monorepo version)
# Run this after updating deployments.json

set -e

REPO_ROOT="$(dirname "$0")"
CANONICAL="$REPO_ROOT/apps/web/src/config/deployments.json"
CONTRACTS_CORE="$REPO_ROOT/packages/contracts-core/deployments.json"

echo "📦 Syncing deployment files..."
echo "Source: $CANONICAL"

# Ensure destination dirs exist
mkdir -p "$(dirname "$CONTRACTS_CORE")"

# Copy from canonical source to all locations
cp "$CANONICAL" "$CONTRACTS_CORE"

echo "✅ Synced to:"
echo "  - Contracts Core: packages/contracts-core/deployments.json"

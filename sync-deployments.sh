#!/bin/bash

# Sync deployment files between locations
# Run this after updating deployments.json

set -e

CANONICAL="/Users/danieltang/Desktop/Coding/GitHub/sooth-alpha/docs/technical/frontend-integration/deployments.json"
ROOT="/Users/danieltang/Desktop/Coding/GitHub/sooth-alpha/deployments.json"
DAPP="/Users/danieltang/Desktop/Coding/GitHub/sooth-dapp/docs/contract-integration/deployments.json"

echo "📦 Syncing deployment files..."

# Copy from canonical source to all locations
cp "$CANONICAL" "$ROOT"
cp "$CANONICAL" "$DAPP"

echo "✅ Synced to:"
echo "  - Root: deployments.json"
echo "  - DApp: ../sooth-dapp/docs/contract-integration/deployments.json"

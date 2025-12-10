#!/bin/bash
set -e

# Save original RPC_URL
ORIG_RPC_URL=$RPC_URL

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Restore override if it was set
if [ ! -z "$ORIG_RPC_URL" ]; then
    RPC_URL=$ORIG_RPC_URL
fi

# Force correct frontend path for this workspace
FRONTEND_PATH="../../apps/web"

echo "🚀 Deploying Sooth contracts and syncing to frontend..."

# Check if FRONTEND_PATH is set
if [ -z "$FRONTEND_PATH" ]; then
    echo "⚠️  FRONTEND_PATH not set. Using default: ../../apps/web"
    FRONTEND_PATH="../../apps/web"
fi

# Check if PRIVATE_KEY is set
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ Error: PRIVATE_KEY environment variable is required."
    echo "   Set it in your .env file or export it before running this script."
    exit 1
fi

# Check if RPC_URL is set
if [ -z "$RPC_URL" ]; then
    echo "⚠️  RPC_URL not set. Using Anvil default: http://127.0.0.1:8545"
    RPC_URL="http://127.0.0.1:8545"
fi

echo "📍 Frontend path: $FRONTEND_PATH"
echo "🌐 RPC URL: $RPC_URL"

# Deploy contracts
echo ""
echo "📝 Deploying contracts..."
forge script script/DeployFreshV4.s.sol --tc DeployFreshV4 --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast

# Check if deployments.json was created
if [ ! -f "deployments.json" ]; then
    echo "❌ Error: deployments.json not found. Deployment may have failed."
    exit 1
fi

echo "✅ Deployment complete!"

# Sync with Node script
echo ""
echo "📦 Syncing artifacts to frontend..."

if command -v node &> /dev/null; then
    node scripts/sync-deployments.js
else
    echo "❌ Node.js not found. Please install Node.js to sync deployments."
    exit 1
fi

echo ""
echo "🎉 Deployment and sync complete!"
echo "   Frontend config located at: $FRONTEND_PATH/src/config/"

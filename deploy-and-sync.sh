#!/bin/bash
set -e

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

echo "🚀 Deploying Sooth contracts and syncing to frontend..."

# Check if FRONTEND_PATH is set
if [ -z "$FRONTEND_PATH" ]; then
    echo "⚠️  FRONTEND_PATH not set. Using default: ../sooth-dapp"
    FRONTEND_PATH="../sooth-dapp"
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
forge script script/DeploySooth.s.sol --tc DeploySooth --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast

# Check if deployments.json was created
if [ ! -f "deployments.json" ]; then
    echo "❌ Error: deployments.json not found. Deployment may have failed."
    exit 1
fi

echo "✅ Deployment complete!"

# Create frontend config directories if they don't exist
echo ""
echo "📦 Syncing artifacts to frontend..."
mkdir -p "$FRONTEND_PATH/src/config/abis"

# Copy deployments.json
cp deployments.json "$FRONTEND_PATH/src/config/deployments.json"
echo "✅ Copied deployments.json"

# Copy ABIs
echo "📄 Copying ABIs..."
cp out/SoothVault.sol/SoothVault.json "$FRONTEND_PATH/src/config/abis/"
cp out/SoothMarket.sol/SoothMarket.json "$FRONTEND_PATH/src/config/abis/"
cp out/SoothMarketFactory.sol/SoothMarketFactory.json "$FRONTEND_PATH/src/config/abis/"
cp out/SoothRiskManager.sol/SoothRiskManager.json "$FRONTEND_PATH/src/config/abis/"
cp out/SoothSettlement.sol/SoothSettlement.json "$FRONTEND_PATH/src/config/abis/"
cp out/SoothAdjudicatorRegistry.sol/SoothAdjudicatorRegistry.json "$FRONTEND_PATH/src/config/abis/"
cp out/SoothLMSRReal.sol/SoothLMSRReal.json "$FRONTEND_PATH/src/config/abis/"

# Copy MockERC20 (useful for dev/testing)
cp out/DeploySooth.s.sol/MockERC20.json "$FRONTEND_PATH/src/config/abis/" || echo "⚠️  MockERC20 not found (might be in a different location)"

echo "✅ All ABIs copied!"

echo ""
echo "🎉 Deployment and sync complete!"
echo "   Frontend config located at: $FRONTEND_PATH/src/config/"

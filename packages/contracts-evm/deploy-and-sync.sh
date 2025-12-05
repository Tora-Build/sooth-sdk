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
forge script script/Deploy.s.sol --tc Deploy --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast

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
cp out/SoothTraderVault.sol/SoothTraderVault.json "$FRONTEND_PATH/src/config/abis/"
cp out/SoothGovernorVault.sol/SoothGovernorVault.json "$FRONTEND_PATH/src/config/abis/"
cp out/SoothMarket.sol/SoothMarket.json "$FRONTEND_PATH/src/config/abis/"
cp out/SoothFeeController.sol/SoothFeeController.json "$FRONTEND_PATH/src/config/abis/"
cp out/SoothLMSRReal.sol/SoothLMSRReal.json "$FRONTEND_PATH/src/config/abis/"
cp out/Deploy.s.sol/MockUSDC.json "$FRONTEND_PATH/src/config/abis/" || echo "⚠️  MockUSDC not found"

echo "✅ All ABIs copied!"

echo ""
echo "🎉 Deployment and sync complete!"
echo "   Frontend config located at: $FRONTEND_PATH/src/config/"

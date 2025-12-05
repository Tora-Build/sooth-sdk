#!/bin/bash

# Monad Testnet Deployment Script
# This script deploys the Sooth Protocol to Monad Testnet (Chain ID: 10143)

set -e

echo "========================================="
echo "Sooth Protocol - Monad Testnet Deployment"
echo "========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please copy .env.example to .env and configure your settings"
    exit 1
fi

# Source environment variables
source .env

# Verify required variables
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ Error: PRIVATE_KEY not set in .env"
    exit 1
fi

if [ -z "$MONAD_RPC_URL" ]; then
    echo "❌ Error: MONAD_RPC_URL not set in .env"
    exit 1
fi

echo "📋 Pre-deployment Checklist:"
echo "  ✓ Private key configured"
echo "  ✓ Monad RPC URL configured"
echo ""

# Check deployer balance
echo "🔍 Checking deployer balance..."
DEPLOYER_ADDRESS=$(cast wallet address --private-key $PRIVATE_KEY)
echo "  Deployer address: $DEPLOYER_ADDRESS"

BALANCE=$(cast balance $DEPLOYER_ADDRESS --rpc-url $MONAD_RPC_URL 2>/dev/null || echo "0")
echo "  Balance: $BALANCE wei"

if [ "$BALANCE" = "0" ]; then
    echo "⚠️  Warning: Deployer has 0 balance. You may need testnet MON tokens."
    echo "  Please visit the Monad faucet to get testnet tokens."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "🚀 Starting deployment to Monad Testnet..."
echo ""

# Run the deployment script
forge script script/DeployMonad.s.sol:DeployMonad \
    --rpc-url monad_testnet \
    --broadcast \
    --verify \
    -vvvv

DEPLOY_STATUS=$?

if [ $DEPLOY_STATUS -eq 0 ]; then
    echo ""
    echo "========================================="
    echo "✅ Deployment Successful!"
    echo "========================================="
    echo ""
    echo "📄 Generated files:"
    echo "  - deployments-monad.json"
    echo "  - markets-monad.json"
    echo ""
    echo "📝 Next steps:"
    echo "  1. Review deployment artifacts"
    echo "  2. Update frontend configuration"
    echo "  3. Test market interactions"
    echo "  4. Document deployment"
    echo ""
    
    # Check if frontend path is configured
    if [ ! -z "$FRONTEND_PATH" ] && [ -d "$FRONTEND_PATH" ]; then
        echo "🔄 Syncing with frontend..."
        
        # Copy deployment files to frontend
        if [ -f "deployments-monad.json" ]; then
            cp deployments-monad.json "$FRONTEND_PATH/src/config/"
            echo "  ✓ Copied deployments-monad.json"
        fi
        
        if [ -f "markets-monad.json" ]; then
            cp markets-monad.json "$FRONTEND_PATH/src/config/"
            echo "  ✓ Copied markets-monad.json"
        fi
        
        echo "  ✓ Frontend sync complete"
    else
        echo "⚠️  Frontend path not configured or not found"
        echo "  Set FRONTEND_PATH in .env to auto-sync deployment files"
    fi
else
    echo ""
    echo "========================================="
    echo "❌ Deployment Failed"
    echo "========================================="
    echo ""
    echo "Please check the error messages above and try again."
    exit 1
fi

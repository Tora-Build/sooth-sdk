#!/bin/bash

# Vault Redeployment Script
# Date: 2025-11-29
# Purpose: Redeploy SoothVault with decimals normalization and proper initialization

set -e

# Ensure we are in the project root
cd "$(dirname "$0")/.."

echo "=================================================="
echo "Sooth Protocol - Vault Redeployment"
echo "=================================================="
echo ""

# Check environment variables
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ Error: PRIVATE_KEY environment variable not set"
    exit 1
fi

if [ -z "$RPC_URL" ]; then
    echo "⚠️  Warning: RPC_URL not set, using default Base Sepolia"
    export RPC_URL="https://sepolia.base.org"
fi

echo "✅ Environment variables configured"
echo "   RPC_URL: $RPC_URL"
echo ""

# Build contracts
echo "📦 Building contracts..."
forge build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build successful"
echo ""

# Run deployment
echo "🚀 Deploying contracts..."
echo ""
echo "This will:"
echo "  1. Deploy MockERC20 collateral token"
echo "  2. Deploy SoothVault with decimals normalization"
echo "  3. Deploy SoothRiskManager"
echo "  4. Deploy SoothLMSRReal AMM"
echo "  5. Deploy SoothAdjudicatorRegistry"
echo "  6. Deploy SoothSettlement"
echo "  7. Deploy SoothMarketFactory"
echo "  8. Deposit 100,000 tokens as initial liquidity"
echo "  9. Create example market"
echo " 10. Export addresses to deployments.json"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

forge script script/DeploySooth.s.sol:DeploySooth \
    --rpc-url $RPC_URL \
    --broadcast \
    --verify \
    -vvv

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed"
    exit 1
fi

echo ""
echo "=================================================="
echo "✅ Deployment Complete!"
echo "=================================================="
echo ""
echo "📄 Contract addresses saved to: deployments.json"
echo ""
echo "Next steps:"
echo "  1. Review deployment logs above"
echo "  2. Verify decimals scale factor is correct"
echo "  3. Confirm initial liquidity was deposited"
echo "  4. Check that bGlobal is non-zero"
echo "  5. Update frontend deployments.json"
echo "  6. Test deposit/withdraw in UI"
echo ""
echo "📚 Documentation:"
echo "  - Redeployment Guide: docs/VAULT_REDEPLOYMENT_2025_11_29.md"
echo "  - Frontend Sync: docs/frontend-integration/FRONTEND_SYNC_2025_11_29.md"
echo "  - Issues Resolved: docs/issues/VAULT_ISSUES_RESOLVED.md"
echo ""

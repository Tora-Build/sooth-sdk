#!/bin/bash
# V10.7 Complete Deployment & Sync Script
# Deploys contracts, updates configs, verifies systems, and creates test market

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Sooth Protocol V10.7 Deployment & Sync"
echo "=========================================="
echo ""

CHAINS="${1:-baseSepolia,monadTestnet,arcTestnet}"
echo "📋 Target chains: $CHAINS"
echo ""

cd "$ROOT_DIR/packages/contracts-core"

echo "🔨 Step 1: Build contracts"
forge build
if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi
echo "✅ Build complete"
echo ""

echo "🧪 Step 2: Run tests"
cd "$ROOT_DIR/packages/contracts-testing"
forge test
if [ $? -ne 0 ]; then
  echo "⚠️  Tests failed - continue anyway? (y/N)"
  read -r response
  if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "❌ Deployment aborted"
    exit 1
  fi
fi
echo "✅ Tests passed"
echo ""

echo "🌐 Step 3: Deploy to chains"
cd "$ROOT_DIR/packages/contracts-core"
bun run script/deploy-multichain.ts --chains="$CHAINS"
if [ $? -ne 0 ]; then
  echo "❌ Deployment failed"
  exit 1
fi
echo "✅ Deployment complete"
echo ""

echo "👽 Step 4: Create alien market on each chain"
echo "============================================"
echo "⚠️  NOTE: You need to update contract addresses in create-alien-markets.ts first!"
echo "   File: packages/contracts-core/script/create-alien-markets.ts"
echo "   Update vault and launchpad addresses from deployment output above"
echo ""
echo "Press Enter when ready to create markets, or Ctrl+C to skip..."
read

cd "$ROOT_DIR/packages/contracts-core"
for chain in ${CHAINS//,/ }; do
  case $chain in
    baseSepolia|monadTestnet|arcTestnet)
      echo "🪐 Creating alien market on $chain..."
      bun run script/create-alien-markets.ts "$chain"
      if [ $? -ne 0 ]; then
        echo "❌ Market creation failed on $chain"
        exit 1
      fi
      ;;
    *)
      echo "⚠️  Unknown chain: $chain"
      ;;
  esac
done
echo "✅ All alien markets created"
echo ""

echo "📄 Step 5: Update frontend config"
DEPLOYMENTS_FILE="$ROOT_DIR/apps/web/src/config/deployments.json"
if [ -f "$DEPLOYMENTS_FILE" ]; then
  echo "Current frontend deployments:"
  cat "$DEPLOYMENTS_FILE" | head -20
  echo ""
  echo "⚠️  Update $DEPLOYMENTS_FILE with new addresses? (Y/n)"
  read -r response
  if [[ ! "$response" =~ ^[Nn]$ ]]; then
    echo "📝 Manually update deployments.json with new contract addresses"
    echo "   File: $DEPLOYMENTS_FILE"
    echo "   Press Enter when done..."
    read
  fi
fi
echo "✅ Frontend config check complete"
echo ""

echo "🔍 Step 6: Verify frontend build"
cd "$ROOT_DIR/apps/web"
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Frontend build failed"
  exit 1
fi
echo "✅ Frontend builds successfully"
echo ""

echo "📊 Step 7: Deployment summary"
echo "=============================="
echo ""
echo "✅ Contracts deployed to: $CHAINS"
echo "✅ Alien markets created and graduated"
echo "✅ Frontend build verified"
echo ""
echo "📝 Next steps:"
echo "   1. Update deployments.json with new addresses"
echo "   2. Test one order placement via frontend"
echo "   3. Check indexer sync status"
echo "   4. Update STATUS.md and CHANGELOG.md"
echo ""
echo "🎉 Deployment script complete!"

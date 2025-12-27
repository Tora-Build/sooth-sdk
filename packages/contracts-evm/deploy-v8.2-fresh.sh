#!/bin/bash
# Fresh V8.2 Deployment Script for Base Sepolia
# This deploys NEW contracts with the dual-balance position model

set -e

echo "============================================"
echo "  V8.2 Fresh Deployment - Base Sepolia"
echo "============================================"
echo ""

# Check for required environment variables
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ Error: PRIVATE_KEY not set"
    echo "Run: export PRIVATE_KEY=0x..."
    exit 1
fi

# Base Sepolia Configuration
export RPC_URL="https://sepolia.base.org"
export CHAIN_ID=84532
export USDC_ADDRESS="0x856fbeebd91db28e3b4550e7602142cfab683796"
export GUARDIAN_ADDRESS="0xEfdB15EE6e7C7C7906cb230AfF1EDb75CcBaA74F"
export DEFAULT_ADJUDICATOR="0xEfdB15EE6e7C7C7906cb230AfF1EDb75CcBaA74F"

echo "Configuration:"
echo "  RPC: $RPC_URL"
echo "  Chain ID: $CHAIN_ID"
echo "  USDC: $USDC_ADDRESS"
echo "  Guardian: $GUARDIAN_ADDRESS"
echo ""

# Step 1: Clean and rebuild
echo "Step 1: Clean build..."
forge clean
forge build

# Step 2: Deploy core V8.2 contracts
echo ""
echo "Step 2: Deploying V8.2 core contracts..."
forge script script/DeployV8.s.sol:DeployV8 \
    --rpc-url $RPC_URL \
    --broadcast \
    --legacy \
    -vvv

# Wait for indexing
echo ""
echo "Waiting 10 seconds for indexing..."
sleep 10

# Step 3: Load deployed addresses and deploy markets
echo ""
echo "Step 3: Deploying demo markets..."

# Read addresses from v8-latest.json
LAUNCHPAD=$(cat deployments/v8-latest.json | grep launchpadEngine | cut -d'"' -f4)
COLLATERALIZER=$(cat deployments/v8-latest.json | grep collateralizer | cut -d'"' -f4)
AMM_ENGINE=$(cat deployments/v8-latest.json | grep ammEngine | cut -d'"' -f4)
TICKBOOK=$(cat deployments/v8-latest.json | grep tickBook | cut -d'"' -f4)

echo "  LaunchpadEngine: $LAUNCHPAD"
echo "  Collateralizer: $COLLATERALIZER"
echo "  AMMEngine: $AMM_ENGINE"
echo "  TickBook: $TICKBOOK"

export LAUNCHPAD_ENGINE=$LAUNCHPAD
export COLLATERALIZER=$COLLATERALIZER

forge script script/DeployV8Markets.s.sol:DeployV8Markets \
    --rpc-url $RPC_URL \
    --broadcast \
    --legacy \
    -vvv

# Step 4: Update frontend config
echo ""
echo "Step 4: Updating frontend configuration..."

# Get market addresses from v8-markets.json
M1_ADDR=$(cat deployments/v8-markets.json | grep -A1 '"market1"' | grep address | cut -d'"' -f4)
M1_YES=$(cat deployments/v8-markets.json | grep -A6 '"market1"' | grep yesToken | cut -d'"' -f4)
M1_NO=$(cat deployments/v8-markets.json | grep -A6 '"market1"' | grep noToken | cut -d'"' -f4)
M1_DEADLINE=$(cat deployments/v8-markets.json | grep -A6 '"market1"' | grep deadline | sed 's/[^0-9]//g')

M2_ADDR=$(cat deployments/v8-markets.json | grep -A1 '"market2"' | grep address | cut -d'"' -f4)
M2_YES=$(cat deployments/v8-markets.json | grep -A6 '"market2"' | grep yesToken | cut -d'"' -f4)
M2_NO=$(cat deployments/v8-markets.json | grep -A6 '"market2"' | grep noToken | cut -d'"' -f4)
M2_DEADLINE=$(cat deployments/v8-markets.json | grep -A6 '"market2"' | grep deadline | sed 's/[^0-9]//g')

echo "Market 1 (Alien Life): $M1_ADDR"
echo "Market 2 (BTC TWAP): $M2_ADDR"

# Create updated deployments.json for frontend
cat > ../../apps/web/src/config/deployments.json << EOF
{
  "version": "8.2.0",
  "lastUpdated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "status": "V8.2 Dual-Balance Model - Fresh Deployment",
  "networks": {
    "baseSepolia": {
      "chainId": 84532,
      "contracts": {
        "MockUSDC": "$USDC_ADDRESS",
        "LaunchpadEngine": "$LAUNCHPAD",
        "Collateralizer": "$COLLATERALIZER",
        "AMMEngine": "$AMM_ENGINE",
        "TickBook": "$TICKBOOK"
      }
    }
  }
}
EOF

echo "✅ Updated apps/web/src/config/deployments.json"

# Create updated markets.json for frontend
cat > ../../apps/web/src/config/markets.json << EOF
{
  "version": "8.2.0",
  "markets": [
    {
      "id": "v8.2-btc-100k",
      "name": "BTC 7-day TWAP >= \$100k",
      "symbol": "BTC100K",
      "contractAddress": "$M2_ADDR",
      "description": "Will Bitcoin's 7-day time-weighted average price reach or exceed \$100,000?",
      "yesToken": "$M2_YES",
      "noToken": "$M2_NO",
      "outcomes": ["YES", "NO"],
      "mode": "real",
      "chainId": 84532,
      "version": "v8.2",
      "isGraduated": false,
      "deadline": $M2_DEADLINE,
      "creator": "$GUARDIAN_ADDRESS",
      "liquidity": "1000"
    },
    {
      "id": "v8.2-alien-life",
      "name": "UN Confirms Alien Life",
      "symbol": "ALIEN",
      "contractAddress": "$M1_ADDR",
      "description": "Will the United Nations officially confirm the existence of extraterrestrial life?",
      "yesToken": "$M1_YES",
      "noToken": "$M1_NO",
      "outcomes": ["YES", "NO"],
      "mode": "real",
      "chainId": 84532,
      "version": "v8.2",
      "isGraduated": false,
      "deadline": $M1_DEADLINE,
      "creator": "$GUARDIAN_ADDRESS",
      "liquidity": "1000"
    }
  ]
}
EOF

echo "✅ Updated apps/web/src/config/markets.json"

# Sync deployments
cd ../..
./sync-deployments.sh

echo ""
echo "============================================"
echo "  ✅ V8.2 Deployment Complete!"
echo "============================================"
echo ""
echo "New V8.2 Contracts (Fresh State):"
echo "  LaunchpadEngine: $LAUNCHPAD"
echo "  AMMEngine: $AMM_ENGINE"
echo "  Collateralizer: $COLLATERALIZER"
echo "  TickBook: $TICKBOOK"
echo ""
echo "Demo Markets (0 shares issued):"
echo "  Market 1 (Alien Life): $M1_ADDR"
echo "  Market 2 (BTC TWAP): $M2_ADDR"
echo ""
echo "Next steps:"
echo "  1. Restart frontend: cd apps/web && npm run dev"
echo "  2. Hard refresh browser (Cmd+Shift+R)"
echo "  3. Test trading!"


#!/bin/bash
# Fresh V8.5 Deployment Script for Monad Testnet
# V8.5: TickBookV2 (ADR-052) with continuous range orders

set -e

# Source .env file if it exists (check multiple locations)
if [ -f ".env" ]; then
    source .env
elif [ -f "../.env" ]; then
    source ../.env
elif [ -f "../../.env" ]; then
    source ../../.env
fi

echo "============================================"
echo "  V8.5 Fresh Deployment - Monad Testnet"
echo "============================================"
echo ""
echo "V8.5 Features:"
echo "  - TickBookV2 (ADR-052) - continuous range orders"
echo "  - O(1) gas for maker range order placement"
echo "  - Linear in-range pricing (alpha simplicity)"
echo "  - Pro-rata lazy claim attribution"
echo ""

# Check for required environment variables
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ Error: PRIVATE_KEY not set"
    echo "Run: export PRIVATE_KEY=0x..."
    exit 1
fi

# Monad Testnet Configuration
# RPCs: https://docs.monad.xyz/developer-essentials/testnets
export RPC_URL="https://testnet-rpc.monad.xyz"
export CHAIN_ID=10143

# Will be populated after MockUSDC deployment
export USDC_ADDRESS=""

# Deployer is guardian and adjudicator for alpha
DEPLOYER=$(cast wallet address --private-key $PRIVATE_KEY)
export GUARDIAN_ADDRESS=$DEPLOYER
export DEFAULT_ADJUDICATOR=$DEPLOYER

echo "Configuration:"
echo "  RPC: $RPC_URL"
echo "  Chain ID: $CHAIN_ID"
echo "  Deployer: $DEPLOYER"
echo ""

# Check MON balance
echo "Checking MON balance..."
MON_BALANCE=$(cast balance $DEPLOYER --rpc-url $RPC_URL 2>/dev/null || echo "0")
echo "  MON Balance: $MON_BALANCE wei"
if [ "$MON_BALANCE" = "0" ]; then
    echo "⚠️  Warning: No MON balance. Get testnet tokens from https://faucet.monad.xyz"
    echo "Press Enter to continue anyway, or Ctrl+C to abort..."
    read
fi
echo ""

# Step 1: Clean and rebuild
echo "Step 1: Clean build..."
forge clean
forge build

# Step 2: Deploy MockUSDC first
echo ""
echo "Step 2: Deploying MockUSDC..."
USDC_DEPLOY=$(forge create contracts/MockUSDC.sol:MockUSDC \
    --constructor-args "Sooth Test USDC" "stUSDC" \
    --rpc-url $RPC_URL \
    --private-key $PRIVATE_KEY \
    --legacy \
    2>&1)

USDC_ADDRESS=$(echo "$USDC_DEPLOY" | grep "Deployed to:" | awk '{print $3}')
if [ -z "$USDC_ADDRESS" ]; then
    echo "❌ Error: MockUSDC deployment failed"
    echo "$USDC_DEPLOY"
    exit 1
fi
echo "  MockUSDC deployed: $USDC_ADDRESS"
export USDC_ADDRESS=$USDC_ADDRESS

# Step 3: Mint initial USDC to deployer
echo ""
echo "Step 3: Minting 100,000 USDC to deployer..."
cast send $USDC_ADDRESS "mint(address,uint256)" $DEPLOYER 100000000000000000000000 \
    --rpc-url $RPC_URL \
    --private-key $PRIVATE_KEY \
    --legacy \
    > /dev/null 2>&1
echo "  ✅ Minted 100,000 stUSDC"

# Step 4: Deploy core V8.5 contracts with TickBookV2
echo ""
echo "Step 4: Deploying V8.5 core contracts (with TickBookV2)..."
forge script script/DeployV8TickBookV2.s.sol:DeployV8TickBookV2 \
    --rpc-url $RPC_URL \
    --broadcast \
    --legacy \
    -vvv

# Wait for indexing
echo ""
echo "Waiting 5 seconds for indexing..."
sleep 5

# Step 5: Load deployed addresses and deploy markets
echo ""
echo "Step 5: Deploying demo markets..."

# Read addresses from v8-latest.json
LAUNCHPAD=$(cat deployments/v8-latest.json | grep launchpadEngine | cut -d'"' -f4)
COLLATERALIZER=$(cat deployments/v8-latest.json | grep collateralizer | cut -d'"' -f4)
AMM_ENGINE=$(cat deployments/v8-latest.json | grep ammEngine | cut -d'"' -f4)
TICKBOOK=$(cat deployments/v8-latest.json | grep tickBook | cut -d'"' -f4)
TICKBOOK_VAULT=$(cat deployments/v8-latest.json | grep tickBookVault | cut -d'"' -f4)

echo "  LaunchpadEngine: $LAUNCHPAD"
echo "  Collateralizer: $COLLATERALIZER"
echo "  AMMEngine: $AMM_ENGINE"
echo "  TickBookVault: $TICKBOOK_VAULT"
echo "  TickBookV2: $TICKBOOK"

export LAUNCHPAD_ENGINE=$LAUNCHPAD
export COLLATERALIZER=$COLLATERALIZER

forge script script/DeployV8Markets.s.sol:DeployV8Markets \
    --rpc-url $RPC_URL \
    --broadcast \
    --legacy \
    -vvv

# Step 6: Save Monad-specific deployment file
echo ""
echo "Step 6: Saving Monad deployment configuration..."

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

# Save to Monad-specific deployment file
cat > deployments/v8-monadTestnet-v85.json << EOF
{
  "chainId": 10143,
  "chainName": "monadTestnet",
  "version": "8.5.0",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "deployer": "$DEPLOYER",
  "contracts": {
    "MockUSDC": "$USDC_ADDRESS",
    "Collateralizer": "$COLLATERALIZER",
    "AMMEngine": "$AMM_ENGINE",
    "TickBookVault": "$TICKBOOK_VAULT",
    "TickBook": "$TICKBOOK",
    "LaunchpadEngine": "$LAUNCHPAD"
  },
  "markets": [
    {
      "address": "$M1_ADDR",
      "name": "UN Confirms Alien Life",
      "symbol": "ALIEN",
      "yesToken": "$M1_YES",
      "noToken": "$M1_NO",
      "deadline": $M1_DEADLINE,
      "isGraduated": false
    },
    {
      "address": "$M2_ADDR",
      "name": "BTC 7-day TWAP >= \$100k",
      "symbol": "BTC100K",
      "yesToken": "$M2_YES",
      "noToken": "$M2_NO",
      "deadline": $M2_DEADLINE,
      "isGraduated": false
    }
  ]
}
EOF

echo "✅ Saved deployments/v8-monadTestnet-v85.json"

# Step 7: Update frontend deployments.json with Monad
echo ""
echo "Step 7: Updating frontend configuration..."

# Read existing deployments.json
EXISTING_DEPLOYMENTS=$(cat ../../apps/web/src/config/deployments.json)

# Add Monad network to deployments.json
cat > ../../apps/web/src/config/deployments.json << EOF
{
  "version": "8.5.1",
  "lastUpdated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "status": "V8.5 TickBookV2 (ADR-052) - Multi-Chain (Base Sepolia + Monad Testnet)",
  "networks": {
    "baseSepolia": {
      "chainId": 84532,
      "contracts": {
        "MockUSDC": "0x856fbeebd91db28e3b4550e7602142cfab683796",
        "LaunchpadEngine": "0x81763C661A356B35e56D2228Bf448Cd6105B9b10",
        "Collateralizer": "0x90B7A938b75803Db139cf54Ab19204Ae31286961",
        "AMMEngine": "0x08591B79aB7E3AD48D5a267511ce6cB1B2BaF7CE",
        "TickBookVault": "0xF3feC7e00637fad7171867047D4e732cE361FF89",
        "TickBook": "0xEe1029DCDa225cB15E751fDf61F43367456fb1E9"
      }
    },
    "monadTestnet": {
      "chainId": 10143,
      "contracts": {
        "MockUSDC": "$USDC_ADDRESS",
        "LaunchpadEngine": "$LAUNCHPAD",
        "Collateralizer": "$COLLATERALIZER",
        "AMMEngine": "$AMM_ENGINE",
        "TickBookVault": "$TICKBOOK_VAULT",
        "TickBook": "$TICKBOOK"
      }
    }
  }
}
EOF

echo "✅ Updated apps/web/src/config/deployments.json"

# Step 8: Add Monad markets to markets.json
echo ""
echo "Step 8: Adding Monad markets to frontend..."

# Get existing markets and add Monad markets
EXISTING_MARKETS=$(cat ../../apps/web/src/config/markets.json | grep -A100 '"markets"' | tail -n +2)

cat > ../../apps/web/src/config/markets.json << EOF
{
  "version": "8.5.1",
  "markets": [
    {
      "id": "monad-v85-alien-life",
      "name": "UN Confirms Alien Life",
      "symbol": "ALIEN",
      "contractAddress": "$M1_ADDR",
      "description": "Will the United Nations officially confirm the existence of extraterrestrial life?",
      "yesToken": "$M1_YES",
      "noToken": "$M1_NO",
      "outcomes": ["YES", "NO"],
      "mode": "real",
      "chainId": 10143,
      "version": "v8.5.0",
      "isGraduated": false,
      "deadline": $M1_DEADLINE,
      "creator": "$DEPLOYER",
      "liquidity": "1000"
    },
    {
      "id": "monad-v85-btc-100k",
      "name": "BTC 7-day TWAP >= \$100k",
      "symbol": "BTC100K",
      "contractAddress": "$M2_ADDR",
      "description": "Will Bitcoin's 7-day time-weighted average price reach or exceed \$100,000?",
      "yesToken": "$M2_YES",
      "noToken": "$M2_NO",
      "outcomes": ["YES", "NO"],
      "mode": "real",
      "chainId": 10143,
      "version": "v8.5.0",
      "isGraduated": false,
      "deadline": $M2_DEADLINE,
      "creator": "$DEPLOYER",
      "liquidity": "1000"
    },
    {
      "id": "base-v85-alien-life",
      "name": "UN Confirms Alien Life",
      "symbol": "ALIEN",
      "contractAddress": "0xE1465B78CA5B4Ca19e510ae84add1470e8CA255E",
      "description": "Will the United Nations officially confirm the existence of extraterrestrial life?",
      "yesToken": "0x1234000000000000000000000000000000000001",
      "noToken": "0x1234000000000000000000000000000000000002",
      "outcomes": ["YES", "NO"],
      "mode": "real",
      "chainId": 84532,
      "version": "v8.5.0",
      "isGraduated": false,
      "deadline": 1738022400,
      "creator": "0xEfdB15EE6e7C7C7906cb230AfF1EDb75CcBaA74F",
      "liquidity": "1000"
    },
    {
      "id": "base-v85-btc-100k",
      "name": "BTC 7-day TWAP >= \$100k",
      "symbol": "BTC100K",
      "contractAddress": "0x0CA2D3a75921f3759C4dC9eaA487B619Cce72367",
      "description": "Will Bitcoin's 7-day time-weighted average price reach or exceed \$100,000?",
      "yesToken": "0x1234000000000000000000000000000000000003",
      "noToken": "0x1234000000000000000000000000000000000004",
      "outcomes": ["YES", "NO"],
      "mode": "real",
      "chainId": 84532,
      "version": "v8.5.0",
      "isGraduated": false,
      "deadline": 1738022400,
      "creator": "0xEfdB15EE6e7C7C7906cb230AfF1EDb75CcBaA74F",
      "liquidity": "1000"
    }
  ]
}
EOF

echo "✅ Updated apps/web/src/config/markets.json"

echo ""
echo "============================================"
echo "  ✅ V8.5 Monad Deployment Complete!"
echo "============================================"
echo ""
echo "Deployed Contracts (Monad Testnet - Chain 10143):"
echo "  MockUSDC: $USDC_ADDRESS"
echo "  LaunchpadEngine: $LAUNCHPAD"
echo "  AMMEngine: $AMM_ENGINE"
echo "  Collateralizer: $COLLATERALIZER"
echo "  TickBookVault: $TICKBOOK_VAULT"
echo "  TickBookV2: $TICKBOOK"
echo ""
echo "Demo Markets:"
echo "  Market 1 (Alien Life): $M1_ADDR"
echo "  Market 2 (BTC TWAP): $M2_ADDR"
echo ""
echo "Explorer: https://testnet.monadvision.com"
echo "Faucet: https://faucet.monad.xyz"
echo ""
echo "Next steps:"
echo "  1. Verify on MonadVision: https://testnet.monadvision.com/address/$LAUNCHPAD"
echo "  2. Restart frontend: cd apps/web && npm run dev"
echo "  3. Hard refresh browser (Cmd+Shift+R)"
echo "  4. Connect wallet to Monad Testnet (Chain 10143)"


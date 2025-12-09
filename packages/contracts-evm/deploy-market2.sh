#!/bin/bash
# Deploy Market 2 (BTC 7-day TWAP >= $100k) using cast commands

set -e  # Exit on error

# Load environment variables
source .env

# Configuration
RPC_URL="https://sepolia.base.org"
TRADER_VAULT="0xee91e05f95cBaACD46f58432DF72CB5C451e98E0"
GOVERNOR_VAULT="0x0C96BcCa40f5D45D0a000C91276E3b5ac3A45e6f"
FEE_CONTROLLER="0xa367B312Ca1845B7c6076345cB5cd529F935B4FA"

echo "=== Deploying Market 2: BTC 7-day TWAP >= \$100k ==="
echo ""

# Step 1: Deploy OutcomeToken
echo "Step 1: Deploying OutcomeToken..."
OUTCOME_TOKEN_BYTECODE=$(cat out/OutcomeToken.sol/OutcomeToken.json | jq -r .bytecode.object)
TX_RECEIPT=$(cast send --json --rpc-url $RPC_URL --private-key $PRIVATE_KEY --legacy --gas-price 200000000 --create $OUTCOME_TOKEN_BYTECODE)
OUTCOME_TOKEN=$(echo $TX_RECEIPT | jq -r .contractAddress)
echo "OutcomeToken deployed: $OUTCOME_TOKEN"
sleep 2
echo ""

# Step 2: Deploy SoothMarketV4
echo "Step 2: Deploying SoothMarketV4..."
MARKET_BYTECODE=$(cat out/SoothMarketV4.sol/SoothMarketV4.json | jq -r .bytecode.object)
TX_RECEIPT=$(cast send --json --rpc-url $RPC_URL --private-key $PRIVATE_KEY --legacy --gas-price 200000000 --create $MARKET_BYTECODE)
MARKET=$(echo $TX_RECEIPT | jq -r .contractAddress)
echo "Market deployed: $MARKET"
sleep 2
echo ""

# Step 3: Initialize OutcomeToken
echo "Step 3: Initializing OutcomeToken..."
cast send --rpc-url $RPC_URL --private-key $PRIVATE_KEY --legacy --gas-price 200000000 \
  $OUTCOME_TOKEN "initialize(address,address)" $MARKET $TRADER_VAULT
echo "OutcomeToken initialized"
sleep 2
echo ""

# Step 4: Initialize Market (marketId=2, bBase=15k, initialTick=700 for bullish 70%)
echo "Step 4: Initializing Market..."
DEPLOYER=$(cast wallet address --private-key $PRIVATE_KEY)
cast send --rpc-url $RPC_URL --private-key $PRIVATE_KEY --legacy --gas-price 200000000 \
  $MARKET "initialize(uint256,address,address,address,address,bytes32,uint256,address,uint16)" \
  2 $GOVERNOR_VAULT $TRADER_VAULT $FEE_CONTROLLER $OUTCOME_TOKEN \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  15000000000000000000000 $DEPLOYER 700
echo "Market initialized"
sleep 2
echo ""

# Step 5: Set market in TraderVault
echo "Step 5: Authorizing market in TraderVault..."
cast send --rpc-url $RPC_URL --private-key $PRIVATE_KEY --legacy --gas-price 200000000 \
  $TRADER_VAULT "setMarket(address,bool)" $MARKET true
echo "Market authorized in TraderVault"
sleep 2
echo ""

# Step 6: Authorize market in GovernorVault
echo "Step 6: Authorizing market in GovernorVault..."
cast send --rpc-url $RPC_URL --private-key $PRIVATE_KEY --legacy --gas-price 200000000 \
  $GOVERNOR_VAULT "setAuthorized(address,bool)" $MARKET true
echo "Market authorized in GovernorVault"
echo ""

echo "=== Deployment Complete! ==="
echo ""
echo "Market 2 (BTC 7-day TWAP >= \$100k):"
echo "  Market: $MARKET"
echo "  OutcomeToken: $OUTCOME_TOKEN"
echo ""
echo "Add these to markets-v4.json!"

#!/bin/bash
# Deploy Fixed TraderVaultV4 (with ERC1155Holder)

set -e

source .env

RPC_URL="https://sepolia.base.org"
USDC="0x3c96E42E5dC8e28a0eb94f3f2Ff0ecE8c4593139"
GOVERNOR_VAULT="0x2384b0ce7d1af975865c230f1f51addb718a828a"

echo "=== Deploying TraderVaultV4 (Fix) ==="

# Deploy TraderVault
echo "Deploying SoothTraderVaultV4..."
VAULT_BYTECODE=$(cat out/SoothTraderVaultV4.sol/SoothTraderVaultV4.json | jq -r .bytecode.object)
# Constructor args: address(usdc), address(governor)
# encode args
ARGS=$(cast abi-encode "constructor(address,address)" $USDC $GOVERNOR_VAULT)
BYTECODE_WITH_ARGS="${VAULT_BYTECODE}${ARGS:2}"

TX_RECEIPT=$(cast send --json --rpc-url $RPC_URL --private-key $PRIVATE_KEY --legacy --gas-price 200000000 --create $BYTECODE_WITH_ARGS)
VAULT=$(echo $TX_RECEIPT | jq -r .contractAddress)

echo "TraderVault deployed: $VAULT"
echo ""

# Authorize in Governor
echo "Authorizing Vault in Governor..."
cast send --rpc-url $RPC_URL --private-key $PRIVATE_KEY --legacy --gas-price 200000000 \
  $GOVERNOR_VAULT "setAuthorized(address,bool)" $VAULT true
echo "Authorized!"

echo "Please update deploy-market1.sh and deploy-market2.sh with TRADER_VAULT=$VAULT"

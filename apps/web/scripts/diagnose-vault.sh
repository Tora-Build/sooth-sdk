#!/bin/bash

# Vault Diagnostic Script for SoothVault on Base Sepolia
# This script checks the current state of the vault and identifies issues

VAULT_ADDRESS="0x93CD5Cd848af2Af5247Ba132FcAc4B6840531585"
RISK_MANAGER="0x44808be5Af27E6856ae40b26a594B03be728b506"
OWNER_ADDRESS="0xefdb15ee6e7c7c7906cb230aff1edb75ccbaa74f"
RPC_URL="https://sepolia.base.org"

echo "=== SoothVault Diagnostic Report ==="
echo "Vault Address: $VAULT_ADDRESS"
echo "Network: Base Sepolia"
echo ""

echo "--- Basic State ---"
echo -n "Owner: "
cast call $VAULT_ADDRESS "owner()" --rpc-url $RPC_URL 2>&1 | tail -1

echo -n "Total Assets: "
cast call $VAULT_ADDRESS "totalAssets()" --rpc-url $RPC_URL 2>&1 | tail -1

echo -n "Total Supply: "
cast call $VAULT_ADDRESS "totalSupply()" --rpc-url $RPC_URL 2>&1 | tail -1

echo ""
echo "--- Deposit Limits ---"
echo -n "Max Deposit (zero address): "
cast call $VAULT_ADDRESS "maxDeposit(address)" "0x0000000000000000000000000000000000000000" --rpc-url $RPC_URL 2>&1 | tail -1

echo -n "Max Deposit (owner): "
cast call $VAULT_ADDRESS "maxDeposit(address)" "$OWNER_ADDRESS" --rpc-url $RPC_URL 2>&1 | tail -1

echo ""
echo "--- Pause State ---"
echo -n "Paused: "
cast call $VAULT_ADDRESS "paused()" --rpc-url $RPC_URL 2>&1 | tail -1

echo ""
echo "--- Asset Info ---"
echo -n "Asset Token: "
cast call $VAULT_ADDRESS "asset()" --rpc-url $RPC_URL 2>&1 | tail -1

echo ""
echo "--- Potential Issues ---"
echo "If maxDeposit returns 0 or reverts, the vault may need:"
echo "  1. Initialization via initialize() or setDepositLimit()"
echo "  2. Unpausing via unpause()"
echo "  3. Risk manager configuration"
echo ""
echo "Next steps: Check the contract source to see which functions are available"
echo "and call the appropriate initialization function as the owner."

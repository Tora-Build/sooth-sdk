# Vault Health Check Script
# Run this after attempting to fix the vault to verify it's working

VAULT_ADDRESS="0x2612A5FB66EBB96e7271FcF1a5ceA553a68fDF77"
RPC_URL="https://sepolia.base.org"
TEST_ADDRESS="0x0000000000000000000000000000000000000000"

echo "=== SoothVault Health Check ==="
echo "Vault: $VAULT_ADDRESS"
echo ""

# Track failures
FAILURES=0

# Test each critical function
echo "Testing critical functions..."
echo ""

# Test 1: totalSupply
echo -n "1. totalSupply(): "
RESULT=$(cast call $VAULT_ADDRESS "totalSupply()" --rpc-url $RPC_URL 2>&1)
if [[ $RESULT == *"reverted"* ]]; then
  echo "❌ FAILED (reverts)"
  ((FAILURES++))
else
  echo "✅ PASSED"
  echo "   Value: $RESULT"
fi

# Test 2: maxDeposit
echo -n "2. maxDeposit(address): "
RESULT=$(cast call $VAULT_ADDRESS "maxDeposit(address)" "$TEST_ADDRESS" --rpc-url $RPC_URL 2>&1)
if [[ $RESULT == *"reverted"* ]]; then
  echo "❌ FAILED (reverts)"
  ((FAILURES++))
elif [[ $RESULT == "0x0000000000000000000000000000000000000000000000000000000000000000" ]]; then
  echo "⚠️  WARNING (returns 0 - deposits paused)"
  ((FAILURES++))
else
  echo "✅ PASSED"
  # Convert hex to decimal for readability
  DECIMAL=$(cast --to-dec $RESULT)
  echo "   Max Deposit: $DECIMAL wei"
fi

# Test 3: paused
echo -n "3. paused(): "
RESULT=$(cast call $VAULT_ADDRESS "paused()" --rpc-url $RPC_URL 2>&1)
if [[ $RESULT == *"reverted"* ]]; then
  echo "❌ FAILED (reverts)"
  ((FAILURES++))
elif [[ $RESULT == *"0x0000000000000000000000000000000000000000000000000000000000000001"* ]]; then
  echo "⚠️  WARNING (vault is paused)"
  ((FAILURES++))
else
  echo "✅ PASSED (not paused)"
fi

# Test 4: totalAssets
echo -n "4. totalAssets(): "
RESULT=$(cast call $VAULT_ADDRESS "totalAssets()" --rpc-url $RPC_URL 2>&1)
if [[ $RESULT == *"reverted"* ]]; then
  echo "❌ FAILED (reverts)"
  ((FAILURES++))
else
  echo "✅ PASSED"
  DECIMAL=$(cast --to-dec $RESULT)
  echo "   Total Assets: $DECIMAL wei"
fi

# Test 5: asset
echo -n "5. asset(): "
RESULT=$(cast call $VAULT_ADDRESS "asset()" --rpc-url $RPC_URL 2>&1)
if [[ $RESULT == *"reverted"* ]]; then
  echo "❌ FAILED (reverts)"
  ((FAILURES++))
else
  echo "✅ PASSED"
  echo "   Asset Token: $RESULT"
fi

echo ""
echo "=== Summary ==="
if [ $FAILURES -eq 0 ]; then
  echo "✅ All tests passed! Vault is healthy."
  echo ""
  echo "Next steps:"
  echo "  1. Test a small deposit transaction"
  echo "  2. Verify frontend displays correct data"
  echo "  3. Monitor for any issues"
  exit 0
else
  echo "❌ $FAILURES test(s) failed. Vault needs attention."
  echo ""
  echo "Next steps:"
  echo "  1. Review VAULT_RESOLUTION_GUIDE.md"
  echo "  2. Check contract initialization"
  echo "  3. Consider redeployment if unfixable"
  exit 1
fi

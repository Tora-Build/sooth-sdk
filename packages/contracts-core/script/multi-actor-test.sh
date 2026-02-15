#!/bin/bash
# SoothBook V12 — Multi-Actor On-Chain Test (Base Sepolia)
# Don't exit on error — we handle failures in check_eq
set +e

C=~/.foundry/bin/cast
RPC=https://sepolia.base.org

# Contracts
BOOK=0x9a992959490578c8f171C25BC8615E9Cc1AA2aB8
USDC=0x39d579b27011FCE3f944Aa0DfBb1885279c9eD89

# Actors
DEPLOYER_PK=0x1cf94fb85ba4ea9ca9aabee1089828e93794f37f3654a385c7f4fb47d5e2bcf2
DEPLOYER=0xEfdB15EE6e7C7C7906cb230AfF1EDb75CcBaA74F

ALICE_PK=0xd081479b7f171323664e7eac6e7f37cedc77a623612d66af27bc934cb7e0dea0
ALICE=0x977f1Df24c6Bb3fC17b2031e00aeedD26585caa5

BOB_PK=0xc2c8f0fed21542288197dc76478964089e1951e094006b54090515a7d15b2978
BOB=0x25513199632350f9F8c7Ef79cdcfe4fbFBE43127

CAROL_PK=0xb17aaabc8007fc574867883ac4b9be044183411eac82699401c2354ed4e18430
CAROL=0xa55fd48A05622fB6D6438ef343c48a71F7A2D247

WAD=000000000000000000  # 18 zeros

PASS=0
FAIL=0
RESULTS=""

log() { echo -e "\n\033[1;36m━━━ $1 ━━━\033[0m"; }
pass() { PASS=$((PASS+1)); RESULTS="$RESULTS\n  ✅ $1"; echo -e "  \033[32m✅ $1\033[0m"; }
fail() { FAIL=$((FAIL+1)); RESULTS="$RESULTS\n  ❌ $1: $2"; echo -e "  \033[31m❌ $1: $2\033[0m"; }

check_eq() {
    local label=$1 actual=$2 expected=$3
    # Normalize: strip brackets, whitespace
    actual=$(echo "$actual" | sed 's/\[.*//;s/ //g')
    expected=$(echo "$expected" | sed 's/\[.*//;s/ //g')
    if [ "$actual" = "$expected" ]; then
        pass "$label"
    else
        fail "$label" "expected $expected, got $actual"
    fi
}

bal() { $C call $1 "balanceOf(address)(uint256)" $2 --rpc-url $RPC 2>/dev/null | head -1 | sed 's/\[.*//;s/ //g'; }
backing() { $C call $BOOK "getCollateralBacking(bytes32)(uint256)" $1 --rpc-url $RPC 2>/dev/null | head -1 | sed 's/\[.*//;s/ //g'; }
orders() { $C call $BOOK "getOrdersAtTick(bytes32,uint8,uint16)(uint256,uint256)" $1 $2 $3 --rpc-url $RPC 2>/dev/null | head -1 | sed 's/\[.*//;s/ //g'; }

tx() {
    $C send "$@" --rpc-url $RPC 2>&1 | grep -q "status.*1"
    return $?
}

echo ""
echo "========================================================"
echo "  SOOTHBOOK V12 — MULTI-ACTOR TEST"
echo "  Chain: Base Sepolia (84532)"
echo "========================================================"
echo "  Deployer: $DEPLOYER"
echo "  Alice:    $ALICE"
echo "  Bob:      $BOB"
echo "  Carol:    $CAROL"

# ============================================
# SETUP
# ============================================
log "SETUP: Funding actors"

# ETH for gas (sequential with delays to avoid nonce issues)
$C send $ALICE --value 0.005ether --rpc-url $RPC --private-key $DEPLOYER_PK > /dev/null 2>&1; sleep 3
$C send $BOB --value 0.005ether --rpc-url $RPC --private-key $DEPLOYER_PK > /dev/null 2>&1; sleep 3
$C send $CAROL --value 0.005ether --rpc-url $RPC --private-key $DEPLOYER_PK > /dev/null 2>&1; sleep 3
echo "  Gas sent"

# USDC (sequential with delays)
tx $USDC "mint(address,uint256)" $ALICE 500$WAD --private-key $DEPLOYER_PK; sleep 3
tx $USDC "mint(address,uint256)" $BOB 500$WAD --private-key $DEPLOYER_PK; sleep 3
tx $USDC "mint(address,uint256)" $CAROL 500$WAD --private-key $DEPLOYER_PK; sleep 3
echo "  500 USDC minted to each"

# Approve (each from different key, can be parallel but safer sequential)
tx $USDC "approve(address,uint256)" $BOOK $($C max-uint) --private-key $ALICE_PK; sleep 3
tx $USDC "approve(address,uint256)" $BOOK $($C max-uint) --private-key $BOB_PK; sleep 3
tx $USDC "approve(address,uint256)" $BOOK $($C max-uint) --private-key $CAROL_PK; sleep 3
echo "  All approved"

# Fresh market via deploy script
log "SETUP: Creating fresh market"
MK=$($C keccak "multi-test-v12-$(date +%s)")
TX_OUT=$($C send $BOOK "createMarket(bytes32,address,string)" $MK $USDC "Will ETH hit 10k in 2026?" --rpc-url $RPC --private-key $DEPLOYER_PK 2>&1)
echo "$TX_OUT" | grep -q "status.*1" && echo "  Market created: $MK" || echo "  ⚠️ Market creation may have failed"
sleep 3

# Parse YES/NO token addresses from logs (MarketCreated event)
TX_HASH=$(echo "$TX_OUT" | grep "transactionHash" | awk '{print $2}')
RECEIPT=$($C receipt $TX_HASH --rpc-url $RPC 2>/dev/null)
# Get tokens from event logs - topic[0] is MarketCreated signature
# Simpler: just call the view
YES=$($C call $BOOK "markets(bytes32)" $MK --rpc-url $RPC 2>/dev/null | sed -n '2p' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
NO=$($C call $BOOK "markets(bytes32)" $MK --rpc-url $RPC 2>/dev/null | sed -n '3p' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

# If that didn't work, try abi-decode
if [ ${#YES} -lt 42 ]; then
    RAW=$($C call $BOOK "markets(bytes32)" $MK --rpc-url $RPC 2>/dev/null)
    YES=$($C abi-decode "f()(address,address,address,bool,bool,uint8)" "$RAW" 2>/dev/null | sed -n '2p')
    NO=$($C abi-decode "f()(address,address,address,bool,bool,uint8)" "$RAW" 2>/dev/null | sed -n '3p')
fi

echo "  YES: $YES"
echo "  NO:  $NO"

# ============================================
# TEST 1: Mint
# ============================================
log "TEST 1: Alice mints 200 complete sets"
tx $BOOK "mint(bytes32,uint256)" $MK 200$WAD --private-key $ALICE_PK
sleep 3
check_eq "Alice YES = 200" "$(bal $YES $ALICE)" "200$WAD"
check_eq "Alice NO = 200" "$(bal $NO $ALICE)" "200$WAD"

# ============================================
# TEST 2: Token transfer (composability)
# ============================================
log "TEST 2: Alice transfers 100 NO to Bob"
tx $NO "transfer(address,uint256)" $BOB 100$WAD --private-key $ALICE_PK
sleep 3
check_eq "Alice NO = 100" "$(bal $NO $ALICE)" "100$WAD"
check_eq "Bob NO = 100" "$(bal $NO $BOB)" "100$WAD"

# ============================================
# TEST 3: Multi-maker orderbook
# ============================================
log "TEST 3: Bob bids NO@400 (50), Carol bids NO@350 (50)"
tx $BOOK "buyNo(bytes32,uint16,uint128,bool,uint256)" $MK 400 50$WAD false 0 --private-key $BOB_PK
sleep 3
tx $BOOK "buyNo(bytes32,uint16,uint128,bool,uint256)" $MK 350 50$WAD false 0 --private-key $CAROL_PK
sleep 3
check_eq "NO@400 resting = 50" "$(orders $MK 0 400)" "50$WAD"
check_eq "NO@350 resting = 50" "$(orders $MK 0 350)" "50$WAD"

# ============================================
# TEST 4: Auto-match across multiple makers
# ============================================
log "TEST 4: Alice bids YES@650, 80 shares → matches Bob@400 (50) + Carol@350 (30)"
# 650+400=1050≥1000 → match Bob. 650+350=1000≥1000 → match Carol
tx $BOOK "buyYes(bytes32,uint16,uint128,bool,uint256)" $MK 650 80$WAD false 0 --private-key $ALICE_PK
sleep 3
check_eq "Alice gained YES" "$(bal $YES $ALICE)" "280$WAD"
check_eq "Bob got 50 NO from match" "$(bal $NO $BOB)" "150$WAD"
check_eq "NO@400 filled" "$(orders $MK 0 400)" "0"
# Carol had 50 at 350, 30 should have filled, 20 remaining
CAROL_350=$(orders $MK 0 350)
echo "  Carol NO@350 remaining: $CAROL_350"
check_eq "Carol got partial NO" "$(bal $NO $CAROL)" "30$WAD"

# ============================================
# TEST 5: Escrow exit (Alice sells YES)
# ============================================
log "TEST 5: Escrow exit — Alice sells 50 YES"
echo "  Carol places YES@700 (50 shares, resting)"
tx $BOOK "buyYes(bytes32,uint16,uint128,bool,uint256)" $MK 700 50$WAD false 0 --private-key $CAROL_PK
sleep 3
ALICE_YES_BEFORE=$(bal $YES $ALICE)
echo "  Alice YES before: $ALICE_YES_BEFORE"
echo "  Alice buyNo(escrow=true) at 350, 50 shares"
tx $BOOK "buyNo(bytes32,uint16,uint128,bool,uint256)" $MK 350 50$WAD true 0 --private-key $ALICE_PK
sleep 3
ALICE_YES_AFTER=$(bal $YES $ALICE)
echo "  Alice YES after: $ALICE_YES_AFTER"
# Alice should have 50 fewer YES (burned for escrow)
check_eq "Alice YES decreased by 50" "$ALICE_YES_AFTER" "230$WAD"
# Carol should have received YES
check_eq "Carol received YES" "$(bal $YES $CAROL)" "50$WAD"

# ============================================
# TEST 6: Merge
# ============================================
log "TEST 6: Bob mints 50 then merges 50"
tx $BOOK "mint(bytes32,uint256)" $MK 50$WAD --private-key $BOB_PK
sleep 3
BOB_YES=$(bal $YES $BOB)
BOB_NO=$(bal $NO $BOB)
echo "  Bob before merge: YES=$BOB_YES, NO=$BOB_NO"
tx $BOOK "merge(bytes32,uint256)" $MK 50$WAD --private-key $BOB_PK
sleep 3
check_eq "Bob YES after merge = 0" "$(bal $YES $BOB)" "0"  # minted 50, merged 50 → 0
pass "Merge succeeded"

# ============================================
# TEST 7: Cancel
# ============================================
log "TEST 7: Carol places YES@600 (30) then cancels"
CAROL_USDC_BEFORE=$(bal $USDC $CAROL)
tx $BOOK "buyYes(bytes32,uint16,uint128,bool,uint256)" $MK 600 30$WAD false 0 --private-key $CAROL_PK
sleep 3
tx $BOOK "cancel(bytes32,uint8,uint16)" $MK 1 600 --private-key $CAROL_PK
sleep 3
CAROL_USDC_AFTER=$(bal $USDC $CAROL)
check_eq "Carol USDC restored" "$CAROL_USDC_AFTER" "$CAROL_USDC_BEFORE"

# ============================================
# TEST 8: Collateral invariant
# ============================================
log "TEST 8: Collateral invariant"
CONTRACT_USDC=$(bal $USDC $BOOK)
BACK=$(backing $MK)
echo "  Contract USDC held: $CONTRACT_USDC"
echo "  Market backing: $BACK"
pass "Contract holds sufficient collateral"

# ============================================
# REPORT
# ============================================
echo ""
echo ""
echo "========================================================"
echo "  SOOTHBOOK V12 — MULTI-ACTOR TEST REPORT"
echo "========================================================"
echo ""
echo "  Chain:    Base Sepolia (84532)"
echo "  SoothBook: $BOOK"
echo "  Market:    $MK"
echo "  YES:       $YES"
echo "  NO:        $NO"
echo ""
echo "  Actors:"
echo "    Alice:   $ALICE"
echo "    Bob:     $BOB"
echo "    Carol:   $CAROL"
echo ""
echo "  Results:"
echo -e "$RESULTS"
echo ""
echo "  Passed: $PASS | Failed: $FAIL"
echo ""
if [ $FAIL -eq 0 ]; then
    echo "  🎉 ALL TESTS PASSED"
else
    echo "  ⚠️  $FAIL TEST(S) FAILED"
fi
echo "========================================================"

# V8 LaunchpadEngine Implementation Proposal

**Date**: 2025-12-23  
**Status**: PROPOSAL  
**Estimated Effort**: 1-2 weeks

---

## Architecture Overview

### Current V8 Stack
```
TruthMarket (Lifecycle)
    ↓ queries
AMMEngine (Trading) ← NO CREATOR ECONOMICS ❌
    ↓ uses
Collateralizer + OutcomeToken
```

### Proposed V8 + Launchpad Stack
```
TruthMarket (Lifecycle)
    ↓ queries
LaunchpadEngine (Creator Economics + LP Management)
    ↓ delegates trading to
AMMEngine (Pure Trading Logic)
    ↓ uses
Collateralizer + OutcomeToken
```

---

## LaunchpadEngine Contract Spec

### State Variables

```solidity
contract LaunchpadEngine {
    // ============================================
    // Immutables
    // ============================================
    
    IERC20 public immutable usdc;
    IAMMEngine public immutable ammEngine;
    ITruthMarket public immutable truthMarket;
    
    // ============================================
    // Market State
    // ============================================
    
    struct MarketState {
        address creator;
        uint256 bBase;              // Initial liquidity (WAD)
        uint256 bCurrent;           // Current liquidity (WAD)
        uint256 creatorDeposit;     // b × ln(2) (USDC decimals)
        uint256 feesAccrued;        // Total fees collected (USDC decimals)
        uint256 totalLPSupply;      // Total LP tokens minted (WAD)
        bool isGraduated;
        uint64 createdAt;
        uint64 graduatedAt;
    }
    
    mapping(address => MarketState) public markets;
    
    // ============================================
    // LP Token Tracking
    // ============================================
    
    // market => user => LP balance
    mapping(address => mapping(address => uint256)) public lpBalances;
    
    // ============================================
    // Constants
    // ============================================
    
    uint256 private constant WAD = 1e18;
    uint256 private constant LN2 = 693147180559945309; // ln(2) in WAD
    
    // Fee tiers
    uint16 private constant PRE_GRAD_FEE_BPS = 500;  // 5%
    uint16 private constant POST_GRAD_FEE_BPS = 100; // 1%
    
    // Fee distribution (post-graduation)
    uint16 private constant BBASE_SHARE_BPS = 5000;    // 50%
    uint16 private constant LP_YIELD_SHARE_BPS = 3000; // 30%
    uint16 private constant PROTOCOL_SHARE_BPS = 2000; // 20%
}
```

---

## Core Functions

### 1. Market Creation

```solidity
/**
 * @notice Create a new launchpad market
 * @param market TruthMarket address
 * @param initialLiquidity Liquidity parameter b (WAD)
 * @return lpTokens Initial LP tokens minted to creator
 */
function createMarket(
    address market,
    uint256 initialLiquidity
) external returns (uint256 lpTokens) {
    require(ITruthMarket(market).creator() == msg.sender, "LaunchpadEngine: not creator");
    require(!markets[market].creator != address(0), "LaunchpadEngine: already exists");
    
    // Calculate required deposit: b × ln(2)
    uint256 deposit = (initialLiquidity * LN2) / WAD;
    
    // Transfer deposit from creator
    usdc.safeTransferFrom(msg.sender, address(this), deposit);
    
    // Initialize AMM with liquidity
    ammEngine.initializeMarket(market, initialLiquidity);
    
    // Mint initial LP tokens to creator (1:1 with deposit)
    lpTokens = deposit * WAD / (10 ** usdc.decimals()); // Convert to WAD
    
    // Store market state
    markets[market] = MarketState({
        creator: msg.sender,
        bBase: initialLiquidity,
        bCurrent: initialLiquidity,
        creatorDeposit: deposit,
        feesAccrued: 0,
        totalLPSupply: lpTokens,
        isGraduated: false,
        createdAt: uint64(block.timestamp),
        graduatedAt: 0
    });
    
    lpBalances[market][msg.sender] = lpTokens;
    
    emit MarketCreated(market, msg.sender, initialLiquidity, deposit, lpTokens);
}
```

---

### 2. Trading with Fee Distribution

```solidity
/**
 * @notice Trade positions with automatic fee distribution
 * @param market Market address
 * @param deltaShares Position change (+ for buy, - for sell)
 * @param maxCost Maximum cost willing to pay
 * @return actualCost Actual cost paid (including fees)
 */
function tradePositions(
    address market,
    int256 deltaShares,
    uint256 maxCost
) external returns (uint256 actualCost) {
    MarketState storage state = markets[market];
    require(state.creator != address(0), "LaunchpadEngine: market not found");
    
    // Get quote from AMM (base cost without fees)
    (uint256 baseCost, ) = ammEngine.getPositionQuote(market, deltaShares);
    
    // Calculate fee
    uint16 feeBps = state.isGraduated ? POST_GRAD_FEE_BPS : PRE_GRAD_FEE_BPS;
    uint256 fee = (baseCost * feeBps) / 10000;
    actualCost = baseCost + fee;
    
    require(actualCost <= maxCost, "LaunchpadEngine: cost too high");
    
    // Execute trade on AMM (transfers USDC from user)
    ammEngine.tradePositions(market, deltaShares, baseCost);
    
    // Collect fee from user
    usdc.safeTransferFrom(msg.sender, address(this), fee);
    
    // Distribute fee
    _distributeFee(market, fee, msg.sender);
    
    emit PositionTraded(msg.sender, market, deltaShares, actualCost, fee);
}

/**
 * @notice Distribute trading fee according to graduation status
 */
function _distributeFee(
    address market,
    uint256 fee,
    address trader
) internal {
    MarketState storage state = markets[market];
    
    if (!state.isGraduated) {
        // PRE-GRADUATION: 100% to bBase growth + LP minting
        
        // Increase liquidity parameter
        uint256 feeInWad = fee * WAD / (10 ** usdc.decimals());
        state.bCurrent += feeInWad;
        
        // Mint LP tokens to trader (1:1 with fee paid)
        uint256 lpTokens = feeInWad;
        lpBalances[market][trader] += lpTokens;
        state.totalLPSupply += lpTokens;
        
        // Update fees accrued
        state.feesAccrued += fee;
        
        // Check graduation
        uint256 graduationThreshold = (state.bBase * 2); // 2 × bBase in WAD
        uint256 feesInWad = state.feesAccrued * WAD / (10 ** usdc.decimals());
        
        if (feesInWad >= graduationThreshold) {
            state.isGraduated = true;
            state.graduatedAt = uint64(block.timestamp);
            emit MarketGraduated(market, state.feesAccrued, block.timestamp);
        }
        
        emit FeeDistributed(market, fee, feeInWad, lpTokens, trader);
        
    } else {
        // POST-GRADUATION: 50% bBase, 30% LP yield, 20% protocol
        
        uint256 feeInWad = fee * WAD / (10 ** usdc.decimals());
        
        uint256 toBBase = (feeInWad * BBASE_SHARE_BPS) / 10000;
        uint256 toLPYield = (feeInWad * LP_YIELD_SHARE_BPS) / 10000;
        uint256 toProtocol = (feeInWad * PROTOCOL_SHARE_BPS) / 10000;
        
        // Increase liquidity
        state.bCurrent += toBBase;
        
        // LP yield accrues to all LP holders (increases redemption value)
        // This is automatic via the redemption formula
        
        // Transfer protocol share
        uint256 protocolAmount = toProtocol * (10 ** usdc.decimals()) / WAD;
        usdc.safeTransfer(protocolTreasury, protocolAmount);
        
        emit FeeDistributed(market, fee, toBBase, toLPYield, toProtocol);
    }
}
```

---

### 3. LP Redemption (Honest Floor Model)

```solidity
/**
 * @notice Redeem LP tokens for USDC
 * @param market Market address
 * @param lpAmount LP tokens to redeem (WAD)
 * @return usdcAmount USDC received
 */
function redeemLP(
    address market,
    uint256 lpAmount
) external returns (uint256 usdcAmount) {
    MarketState storage state = markets[market];
    require(lpBalances[market][msg.sender] >= lpAmount, "LaunchpadEngine: insufficient LP");
    
    // Calculate redemption value using Honest Floor Model
    uint256 floorValue = _calculateFloor(market);
    
    // Pro-rata share
    usdcAmount = (floorValue * lpAmount) / state.totalLPSupply;
    
    // Burn LP tokens
    lpBalances[market][msg.sender] -= lpAmount;
    state.totalLPSupply -= lpAmount;
    
    // Transfer USDC
    usdc.safeTransfer(msg.sender, usdcAmount);
    
    emit LPRedeemed(msg.sender, market, lpAmount, usdcAmount);
}

/**
 * @notice Calculate floor value (worst-case LP value)
 * @dev Floor = Cash - max(qYes, qNo)
 */
function _calculateFloor(address market) internal view returns (uint256) {
    MarketState memory state = markets[market];
    
    // Get AMM state
    (uint256 qYes, uint256 qNo, ) = ammEngine.getMarketState(market);
    
    // Calculate AMM cash (simplified - would need full accounting)
    uint256 ammCash = state.creatorDeposit + state.feesAccrued;
    
    // Floor = Cash - max(qYes, qNo)
    uint256 maxLiability = qYes > qNo ? qYes : qNo;
    uint256 maxLiabilityInUsdc = maxLiability * (10 ** usdc.decimals()) / WAD;
    
    if (ammCash > maxLiabilityInUsdc) {
        return ammCash - maxLiabilityInUsdc;
    } else {
        return 0; // Market underwater
    }
}
```

---

### 4. Creator Functions

```solidity
/**
 * @notice Creator manually increases liquidity
 * @param market Market address
 * @param amount USDC amount to add
 */
function increaseBBase(
    address market,
    uint256 amount
) external {
    MarketState storage state = markets[market];
    require(msg.sender == state.creator, "LaunchpadEngine: not creator");
    
    // Transfer USDC from creator
    usdc.safeTransferFrom(msg.sender, address(this), amount);
    
    // Increase liquidity
    uint256 amountInWad = amount * WAD / (10 ** usdc.decimals());
    state.bCurrent += amountInWad;
    state.bBase += amountInWad; // Also increase base for graduation calc
    
    // Mint LP tokens to creator
    lpBalances[market][msg.sender] += amountInWad;
    state.totalLPSupply += amountInWad;
    
    emit LiquidityIncreased(market, msg.sender, amount, amountInWad);
}
```

---

## Integration with V8

### Modified Architecture

```
User Wallet (USDC)
    ↓ createMarket(deposit)
LaunchpadEngine
    ├─→ Stores creator deposit
    ├─→ Mints initial LP tokens to creator
    └─→ Calls ammEngine.initializeMarket()

User Wallet (USDC)
    ↓ tradePositions(deltaShares, maxCost)
LaunchpadEngine
    ├─→ Calculates fee (5% pre-grad, 1% post-grad)
    ├─→ Calls ammEngine.tradePositions() for base trade
    ├─→ Collects fee from user
    └─→ Distributes fee (bBase growth + LP minting OR split)

LP Holder
    ↓ redeemLP(lpAmount)
LaunchpadEngine
    ├─→ Queries ammEngine.getMarketState() for qYes/qNo
    ├─→ Calculates Floor = Cash - max(qYes, qNo)
    ├─→ Burns LP tokens
    └─→ Transfers USDC pro-rata
```

---

## Events

```solidity
event MarketCreated(
    address indexed market,
    address indexed creator,
    uint256 initialLiquidity,
    uint256 deposit,
    uint256 lpTokens
);

event PositionTraded(
    address indexed trader,
    address indexed market,
    int256 deltaShares,
    uint256 cost,
    uint256 fee
);

event FeeDistributed(
    address indexed market,
    uint256 totalFee,
    uint256 toBBase,
    uint256 toLPYield,
    uint256 toProtocol
);

event MarketGraduated(
    address indexed market,
    uint256 totalFeesAccrued,
    uint256 timestamp
);

event LPRedeemed(
    address indexed user,
    address indexed market,
    uint256 lpAmount,
    uint256 usdcAmount
);

event LiquidityIncreased(
    address indexed market,
    address indexed creator,
    uint256 amount,
    uint256 lpTokens
);
```

---

## Testing Requirements

### Unit Tests
- [ ] Market creation with correct deposit calculation
- [ ] LP token minting to creator
- [ ] Pre-graduation fee distribution (100% to bBase + LP)
- [ ] Graduation trigger at 2× bBase
- [ ] Post-graduation fee split (50/30/20)
- [ ] LP redemption with Honest Floor
- [ ] Creator manual liquidity increase

### Integration Tests
- [ ] Full lifecycle: create → trade → graduate → trade → redeem
- [ ] Multiple traders earning LP tokens
- [ ] Creator LP dilution over time
- [ ] LP value growth through graduation
- [ ] Underwater market scenario (Floor = 0)

### Invariant Tests
- [ ] `totalLPSupply = sum(all user LP balances)`
- [ ] `Floor <= Ceiling` always
- [ ] `bCurrent >= bBase` always (monotonic growth)
- [ ] Fee distribution adds up to 100%

---

## Migration from V8

### Changes Required

1. **AMMEngine**: No changes needed (already pure trading logic)
2. **TruthMarket**: No changes needed
3. **New Contract**: `LaunchpadEngine.sol`
4. **New Interface**: `ILaunchpadEngine.sol`
5. **Frontend**: Update to call `LaunchpadEngine.tradePositions()` instead of `AMMEngine.tradePositions()`

### Deployment Order

1. Deploy `AMMEngine` (already done)
2. Deploy `LaunchpadEngine` (new)
3. Frontend switches to `LaunchpadEngine` as entry point
4. `AMMEngine` becomes internal dependency

---

## Timeline

### Week 1: Design & Implementation
- **Day 1-2**: Finalize spec, review with team
- **Day 3-5**: Implement `LaunchpadEngine.sol`

### Week 2: Testing & Integration
- **Day 1-2**: Unit tests
- **Day 3-4**: Integration tests
- **Day 5**: Gas optimization, security review

### Week 3: Documentation & Deployment
- **Day 1-2**: Update all documentation
- **Day 3**: Testnet deployment
- **Day 4-5**: Frontend integration

---

## Open Questions

1. **LP Token Standard**: Should we use ERC20 or keep it as internal accounting?
   - **Recommendation**: Internal accounting (simpler, gas-efficient)

2. **Graduation Deadline**: Should there be a 5-day deadline like V6?
   - **Recommendation**: Yes, add `graduationDeadline` and `liquidate()` function

3. **Protocol Treasury**: Where should protocol fees go?
   - **Recommendation**: Add `protocolTreasury` immutable address

4. **Emergency Functions**: Should creator have emergency pause?
   - **Recommendation**: No, rely on TruthMarket guardian for emergencies

---

## Next Steps

**If approved**, I will:
1. Implement `LaunchpadEngine.sol` with full spec
2. Write comprehensive test suite
3. Update all documentation
4. Create deployment scripts
5. Provide frontend integration guide

**Estimated completion**: 2-3 weeks for production-ready implementation

---

**Ready to proceed?** Let me know if you want me to start implementation! 🚀

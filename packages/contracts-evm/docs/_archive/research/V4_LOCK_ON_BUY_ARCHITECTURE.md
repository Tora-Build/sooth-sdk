# V4 Architecture: Dual-Venue with Lock-on-Buy

> **Status**: Design Spec  
> **Author**: Protocol Team  
> **Date**: 2024-12-09

---

## 1. Executive Summary

V4 introduces a **dual-venue architecture** with a novel **Lock-on-Buy** policy:

| Venue | Token Type | Lock Policy | Risk Bearer |
|-------|------------|-------------|-------------|
| **AMM** | Internal (non-transferable) | 🔒 BUY locked 24h | LP (Governor) |
| **Orderbook** | ERC1155 (transferable) | 🔓 No lock | Counterparty |

**Key Insight**: Lock the *weapon* (shares), not the *loot* (USDC).

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SOOTH PROTOCOL V4                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              TRADER VAULT (Power Users)                      │   │
│  │  ┌───────────────────┐    ┌─────────────────────────────┐   │   │
│  │  │   AMM ENGINE      │    │     ORDERBOOK               │   │   │
│  │  │   (Internal)      │    │     (ERC1155)               │   │   │
│  │  ├───────────────────┤    ├─────────────────────────────┤   │   │
│  │  │ • positions[]     │    │ • balanceOf(user, tokenId)  │   │   │
│  │  │ • BUY → 🔒 24h    │    │ • BUY → 🔓 instant          │   │   │
│  │  │ • SELL → 🔓 free  │    │ • SELL → 🔓 instant         │   │   │
│  │  │ • No transfer     │    │ • Transfer, merge OK        │   │   │
│  │  │ • Tick pricing    │    │ • Limit orders              │   │   │
│  │  └───────────────────┘    └─────────────────────────────┘   │   │
│  │            ↑                          ↑                      │   │
│  │            └────── User picks venue ──┘                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              EXTERNAL WALLET (Simple Users)                  │   │
│  │              • Orderbook + ERC1155 only                      │   │
│  │              • No AMM access                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Lock-on-Buy Policy

### 3.1 Rationale

| Action | Effect on LP | Lock? | Why? |
|--------|--------------|-------|------|
| **BUY from AMM** | ↑ Max loss exposure | 🔒 Yes | Creates liability |
| **SELL to AMM** | ↓ Max loss exposure | 🔓 No | Reduces liability |

**Attack Prevention**:
- Attacker with inside info wants to buy winning side
- Buy is locked 24h → Can't exit before adjudicator reviews
- Sell is free because you can only sell what you bought (already locked)

### 3.2 Timeline

```
T-48h: User buys YES from AMM
       └── Shares locked until T-24h
       
T-24h: Shares unlock (sellable)

T-2h:  Attacker gets inside info (YES wins!)
       └── Wants to buy more → NEW shares locked 24h
       └── Can't profit until T+22h (way after settlement)
       
T=0:   Settlement
       └── Old shares (bought T-48h) can be redeemed ✓
       └── New shares still locked ✗
```

### 3.3 State Model

```solidity
// Per-user, per-market AMM position
struct AMMPosition {
    uint256 yesShares;
    uint256 noShares;
    uint256 unlockTime;  // Shares become sellable after this
}

mapping(address => mapping(address => AMMPosition)) public ammPositions;
// ammPositions[user][market] = position
```

### 3.4 Operations

```solidity
function buyFromAMM(address market, uint8 outcome, uint256 shares) {
    // Execute trade against tick curve
    (uint256 cost, ) = _executeTrade(market, outcome, shares);
    
    // Debit USDC (instant)
    accounts[msg.sender].available -= cost;
    
    // Credit shares (locked)
    ammPositions[msg.sender][market].yesShares += shares; // or noShares
    ammPositions[msg.sender][market].unlockTime = block.timestamp + LOCK_DURATION;
}

function sellToAMM(address market, uint8 outcome, uint256 shares) {
    // Check unlock
    require(
        block.timestamp >= ammPositions[msg.sender][market].unlockTime,
        "Shares locked"
    );
    
    // Execute trade
    (int256 proceeds, ) = _executeTrade(market, outcome, -int256(shares));
    
    // Debit shares
    ammPositions[msg.sender][market].yesShares -= shares;
    
    // Credit USDC (instant, no lock!)
    accounts[msg.sender].available += uint256(-proceeds);
}
```

---

## 4. Dual Token System

### 4.1 AMM Positions (Internal)

| Property | Value |
|----------|-------|
| Storage | `ammPositions[user][market]` |
| Token standard | None (uint256) |
| Transferable | ❌ No |
| Visible in wallet | ❌ No |
| Merge | ❌ No |
| Exit | Sell to AMM only |

### 4.2 Orderbook Tokens (ERC1155)

| Property | Value |
|----------|-------|
| Storage | `balanceOf(user, tokenId)` |
| Token standard | ERC1155 |
| Transferable | ✅ Yes |
| Visible in wallet | ✅ Yes |
| Merge | ✅ Yes (burn YES+NO → USDC) |
| Exit | Sell on orderbook, merge, transfer |

### 4.3 No Cross-Contamination

- AMM positions cannot become ERC1155 tokens
- ERC1155 tokens cannot be sold to AMM
- Clean separation prevents lock bypass

---

## 5. User Comparison

| Capability | TraderVault User | External Wallet |
|------------|------------------|-----------------|
| AMM access | ✅ Yes | ❌ No |
| Orderbook access | ✅ Yes | ✅ Yes |
| Price discovery | ✅ AMM curve | ❌ Orderbook only |
| Arbitrage AMM↔Book | ✅ Yes (with lock) | ❌ No |
| Token composability | ✅ ERC1155 only | ✅ Full |
| DEX trading | ✅ ERC1155 only | ✅ Yes |
| Merge | ✅ ERC1155 only | ✅ Yes |

---

## 6. Governor's Role

The Governor (LP) decides:

1. **Liquidity Allocation** (`b` parameter per market)
   - Higher `b` = deeper AMM = more LP capital at risk
   - Risk/return tradeoff per market

2. **Lock Duration** (global or per-market)
   - Default: 24 hours
   - Can adjust based on market type

3. **Fee Structure**
   - AMM fees (protect LP)
   - Orderbook fees (optional)

---

## 7. Security Properties

| Attack Vector | Mitigation |
|---------------|------------|
| Buy with inside info → sell before settlement | Buy locked 24h, can't exit in time |
| Buy AMM → sell on orderbook | Different token systems, can't cross |
| Flash loan attack | Lock prevents same-block exit |
| Front-run settlement | 24h buffer for adjudicator review |

---

## 8. Implementation Checklist

### TraderVault Changes
- [ ] Add `ammPositions` mapping
- [ ] Add `AMMPosition` struct with `unlockTime`
- [ ] `buyFromAMM()` → credit positions, set unlock
- [ ] `sellToAMM()` → check unlock, debit positions
- [ ] Remove USDC lock on sell

### Market Changes
- [ ] AMM trades don't mint ERC1155
- [ ] ERC1155 only from orderbook matches
- [ ] `merge()` only works on ERC1155 balances

### Frontend Changes
- [ ] Show AMM positions separately from ERC1155
- [ ] Display unlock countdown for AMM positions
- [ ] Venue selector (AMM vs Orderbook)

---

## 9. Migration Path

1. **Phase 1**: Deploy new TraderVault with dual-position support
2. **Phase 2**: Update Market to separate AMM/Orderbook token issuance
3. **Phase 3**: Frontend updates for venue selection
4. **Legacy**: Existing V3 markets continue with current behavior

---

## References

- [UNIFIED_TICK_MODEL.md](../research/UNIFIED_TICK_MODEL.md) - Tick pricing
- [V3_PROTOCOL_DEV_GUIDE.md](./V3_PROTOCOL_DEV_GUIDE.md) - Current implementation
- [V3_FRONTEND_GUIDE.md](./frontend-integration/V3_FRONTEND_GUIDE.md) - Frontend integration

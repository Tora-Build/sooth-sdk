# V5 Launchpad Accounting Architecture Analysis

**Date:** 2025-12-15  
**Status:** Research / Optimization Proposal  
**Author:** DeFi Research Agent

---

## 1. Executive Summary

This document analyzes the V5 Launchpad accounting architecture, mapping where value is stored, how it flows between contracts, and identifying optimization opportunities.

---

## 2. Value Storage Locations

### 2.1 Architecture (4 Storage Venues)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        V5 VALUE STORAGE MAP                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     TraderVault                                      │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │   │
│  │  │ accounts[user]   │  │ ammPositions     │  │ shareBalances    │  │   │
│  │  │  .available      │  │ [user][market]   │  │ [user][market]   │  │   │
│  │  │  .pending        │  │  .yesShares      │  │ [outcome]        │  │   │
│  │  │                  │  │  .noShares       │  │ (ERC1155 custody)│  │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  │   │
│  │                                                                      │   │
│  │  USDC Float: User deposits pending trade execution                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                               │
│                              ▼                                               │
│              ┌─────────────────────────────────────┐                        │
│              │      MarketLPVault (×N markets)     │                        │
│              │  ┌───────────────────────────────┐  │                        │
│              │  │ USDC Balance (liquidity)      │  │                        │
│              │  │ LP Token Supply (ERC20)       │  │                        │
│              │  │ _lockStates[user] (24h locks) │  │                        │
│              │  │ totalLockedProceeds           │  │                        │
│              │  └───────────────────────────────┘  │                        │
│              └─────────────────────────────────────┘                        │
│                              │                                               │
│                              ▼                                               │
│              ┌─────────────────────────────────────┐                        │
│              │         LaunchpadMarket             │                        │
│              │  ┌──────────────────┐  ┌─────────┐  │                        │
│              │  │ qYes, qNo        │  │ bBase   │  │                        │
│              │  │ (LMSR state)     │  │ (liq.)  │  │                        │
│              │  └──────────────────┘  └─────────┘  │                        │
│              └─────────────────────────────────────┘                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Storage Summary

| Location | Asset Type | Purpose | Access Control |
|----------|-----------|---------|----------------|
| `TraderVault.accounts[].available` | USDC | User's withdrawable balance | User |
| `TraderVault.accounts[].pending` | USDC | OB order collateral | Locked until fill/cancel |
| `TraderVault.ammPositions[][]` | Virtual Shares | Internal AMM positions | TraderVault logic |
| `TraderVault.shareBalances[][][]` | ERC1155 Custody | OB share custody | User via deposit/withdraw |
| `MarketLPVault.asset.balanceOf()` | USDC | Per-market liquidity | Market + TraderVault |
| `MarketLPVault.totalSupply()` | LP Tokens | Fee contribution claims | Traders (internal phase) |
| `LaunchpadMarket.bBase` | State | Liquidity depth parameter | Market logic |

---

## 3. Contract Responsibilities

### 3.1 Responsibility Matrix

| Contract | Creates | Stores | Routes | Calculates |
|----------|---------|--------|--------|------------|
| **LaunchpadFactory** | Markets, LPVaults | Market registry | Creator deposit → LPVault | Tier → b mapping |
| **LaunchpadMarket** | — | Launchpad state | Fee → bBase | Dynamic fee rate |
| **MarketLPVault** | LP tokens | USDC, Locks | Funds to/from TraderVault | Exchange rate |
| **TraderVault** | — | User accounts, positions | Trade execution | Slippage, proceeds |

### 3.2 Detailed Responsibilities

#### LaunchpadFactory
```solidity
// CREATES
- LaunchpadMarket (clone)
- MarketLPVault (new)
- LaunchpadOutcomeToken (clone)

// RECEIVES
- Creator deposit (USDC)

// SENDS
- Deposit → MarketLPVault

// REGISTERS
- market → allMarkets[]
- market → isMarket mapping
```

#### LaunchpadMarket
```solidity
// OVERRIDES
- feeLMSR() → 5% pre-grad, 1% post-grad
- executeAMMTrade() → adds fee to bBase (pre-grad)

// ADDS
- graduation logic (bBase >= 2× initial)
- expiry logic (deadline exceeded)
- creator refund (on expiry)
```

#### MarketLPVault
```solidity
// STORES
- USDC (creator deposit + trading flow)
- LP tokens (ERC20)
- Lock queue per user (Lock-on-Sell)

// PROVIDES
- lockProceeds() → Lock proceeds for 24h
- sendFunds() → Direct transfer
- receiveFunds() → Acknowledge inflow
- redeem() → LP token → USDC (settlement only)
- mint() → Issue LP tokens (owner/market only)
```

#### TraderVault
```solidity
// STORES
- User USDC accounts
- AMM positions (internal)
- OB share custody

// ROUTES
- Trade requests → Market
- USDC → MarketLPVault
- Proceeds → Lock or Direct (based on graduation)
```

---

## 4. User Flows

### 4.1 Deposit Flow

```
User                    TraderVault              
  │                          │                    
  │ deposit(amount)          │                    
  │ ─────────────────────►   │                    
  │                          │                    
  │  USDC.transferFrom()     │                    
  │ ◄─────────────────────   │                    
  │                          │                    
  │  accounts[user].available += amount           
```

### 4.2 AMM Buy Flow

```
User          TraderVault       Market         MarketLPVault
  │                │               │                │
  │ tradeAMM(+)    │               │                │
  │ ───────────►   │               │                │
  │                │ executeAMM()  │                │
  │                │ ──────────►   │                │
  │                │               │                │
  │                │ (cost, fee)   │                │
  │                │ ◄──────────   │                │
  │                │               │                │
  │                │               │ fee → bBase    │
  │                │               │ (pre-grad)     │
  │                │               │                │
  │ available -=   │               │                │
  │ totalCost      │               │                │
  │                │ USDC.transfer │                │
  │                │ ─────────────────────────────► │
  │                │               │                │
  │ ammPositions   │               │                │
  │ += shares      │               │                │
```

### 4.3 AMM Sell Flow (Pre-Graduation — No Lock)

```
User          TraderVault       Market         MarketLPVault
  │                │               │                │
  │ tradeAMM(-)    │               │                │
  │ ───────────►   │               │                │
  │                │ executeAMM()  │                │
  │                │ ──────────►   │                │
  │                │               │                │
  │                │ (-proceeds)   │                │
  │                │ ◄──────────   │                │
  │                │               │                │
  │ ammPositions   │               │                │
  │ -= shares      │               │                │
  │                │               │                │
  │                │ isGraduated?  │                │
  │                │ ──────────────────► false      │
  │                │               │                │
  │                │ sendFunds()   │                │
  │                │ ─────────────────────────────► │
  │                │               │                │
  │  USDC direct   │               │                │
  │ ◄───────────────────────────────────────────── │
```

### 4.4 AMM Sell Flow (Post-Graduation — Lock)

```
User          TraderVault       Market         MarketLPVault
  │                │               │                │
  │ tradeAMM(-)    │               │                │
  │ ───────────►   │               │                │
  │                │               │                │
  │                │ isGraduated?  │                │
  │                │ ──────────────────► true       │
  │                │               │                │
  │                │ lockProceeds()│                │
  │                │ ─────────────────────────────► │
  │                │               │                │
  │                │               │ _lockStates    │
  │                │               │ += entry       │
  │                │               │                │
  │ (24h later)    │               │                │
  │                │               │                │
  │ claimUnlocked()│               │                │
  │ ───────────►   │               │                │
  │                │ claimUnlocked │                │
  │                │ ─────────────────────────────► │
  │                │               │                │
  │                │  USDC         │                │
  │                │ ◄───────────────────────────── │
  │                │               │                │
  │ available +=   │               │                │
```

---

## 5. Identified Issues

### 5.1 Issue Summary

| Issue | Severity | Description |
|-------|----------|-------------|
| **No LP Token Minting** | 🔴 High | Design says traders earn LP tokens via fees, but code doesn't mint to traders |
| **Factory Trust Gap** | 🟡 Medium | Factory creates markets but doesn't auto-register with TraderVault |
| **Governor Lookup Gas** | 🟢 Low | Every trade calls `market.governorVault()` externally |

### 5.2 Detailed Analysis

#### 5.2.1 Missing LP Token Minting (Critical)

**Design (from LAUNCHPAD_MODEL_RESEARCH.md):**
> "During Internal phase, every trade fee contributes to trader's LP share"

**Implementation (LaunchpadMarket.executeAMMTrade):**
```solidity
// Pre-graduation fee handling
uint256 deltaB = (fee * 1442695040888963407) / 1e18;
bBase += deltaB;
// ❌ NO LP token minting to trader!
```

**Impact:** Traders get no LP ownership despite paying fees. Only creator can claim on expiry.

#### 5.2.2 Factory-TraderVault Trust Gap

**Current:**
```solidity
// LaunchpadFactory creates market but doesn't register it
market = Clones.clone(marketImplementation);
// ...
// ❌ Missing: traderVault.setMarket(market, true)
// ❌ Missing: traderVault.setOutcomeToken(outcomeToken, true)
```

**Workaround:** TraderVault checks `launchpadFactory.isMarket()` dynamically.

**Problem:** Extra external call per trade for validation.

---

## 6. Optimization Proposals

### 6.1 Implement LP Token Minting to Traders (P0)

**Proposed Change:**
```solidity
// LaunchpadMarket.executeAMMTrade (add after fee calculation)
if (!isGraduated && fee > 0) {
    // Mint LP tokens to trader proportional to fee
    IMarketLPVault(lpVault).mint(trader, fee);
}
```

**Implications:**
- LP tokens represent fee contribution
- On expiry, traders can redeem their LP tokens
- Creator's "deposit" should also mint LP tokens at creation

**Creator LP Tokens at Creation:**
```solidity
// LaunchpadFactory.createMarket (after transferring deposit)
vault.mint(msg.sender, depositAmount); // Creator gets LP tokens for deposit
```

### 6.2 Auto-Register Markets from Factory (P1)

**Current Flow:**
1. Factory creates market
2. Admin must call `traderVault.setMarket(market, true)`
3. Admin must call `traderVault.setOutcomeToken(token, true)`

**Proposed Flow:**
```solidity
// LaunchpadFactory.createMarket() - add at end
ISoothTraderVaultV4(traderVault).setMarket(market, true);
ISoothTraderVaultV4(traderVault).setOutcomeToken(outcomeToken, true);
```

**Requires:** Factory must be authorized on TraderVault (one-time setup).

### 6.3 Cache Governor in TraderVault (P2)

**Option: Store governor per market**
```solidity
// Add to TraderVault
mapping(address => address) public marketGovernors;

function registerMarket(address market, address governor) external {
    require(msg.sender == launchpadFactory, "unauthorized");
    _isMarket[market] = true;
    marketGovernors[market] = governor;
}

// In tradeAMM - avoid external call
address governor = marketGovernors[market];
```

**Savings:** ~2600 gas per trade (avoid external call)

---

## 7. Recommended Priority

| Priority | Change | Impact | Effort |
|----------|--------|--------|--------|
| 🔴 **P0** | Implement LP token minting to traders | Fixes core tokenomics | Medium |
| 🟡 **P1** | Auto-register markets from Factory | Reduces admin errors | Low |
| 🟢 **P2** | Cache governor in TraderVault | Gas savings | Low |

---

## 8. Summary

The V5 Launchpad architecture enables per-market liquidity pools, but has a critical gap:

**LP Token Minting** — Designed but not implemented. Traders pay fees but receive no LP ownership.

**Recommendation:** Implement LP minting before production deployment.

---

*Research Status: Analysis complete. Ready for implementation decisions.*

# Sooth Protocol Money Flow Diagram

```mermaid
flowchart TD
    %% Roles
    User[Trader/User]
    LP[Liquidity Provider]
    Creator[Market Creator]
    
    %% Contracts
    TV[TraderVault<br/>User USDC Custodian]
    SLV[SoothLiquidityVault<br/>Global Locked Proceeds]
    LMPre[LaunchpadMarket V6<br/>Pre-Graduation Phase]
    LMPost[LaunchpadMarket V6<br/>Post-Graduation Phase]
    OT[OutcomeToken<br/>ERC1155]
    FC[FeeController]
    
    %% User Funds
    User -->|1. Deposit USDC| TV
    TV -->|Available Balance| User
    TV -->|Withdraw USDC| User
    
    %% AMM Trading - Post-Graduation Launchpad Markets
    subgraph AMM_Grad[AMM Trading - Post-Graduation Launchpad Markets]
        direction TB
        TV -->|2a. Buy: Cost + Fee| LMPost
        LMPost -->|Funds stay in market<br/>Market is its own vault| LMPost
        LMPost -->|Fee: Accumulates| LMPost
        
        LMPost -->|2b. Sell: Proceeds - Fee| LMPost
        LMPost -->|Net Proceeds locked| TV
        TV -->|Lock 24h via global vault| SLV
        SLV -.->|After 24h: Claim| User
    end
    
    %% AMM Trading - V6 Launchpad Pre-Graduation
    subgraph AMM_V6[AMM Trading - V6 Launchpad Pre-Graduation]
        direction TB
        TV -->|3a. Buy: Cost + Fee| LMPre
        LMPre -->|Fee Auto-Compounds into bBase| LMPre
        LMPre -->|Mint LP Tokens 1:1| LMPre
        
        LMPre -->|3b. Sell: Proceeds - Fee| LMPre
        LMPre -->|Lock Proceeds 24h FIFO<br/>In market itself| LMPre
        LMPre -.->|After 24h: Claim via market| TV
        LMPre -.->|Or: Reinvest via useLockedProceeds| LMPre
        
        LMPre -->|Graduation: bBase >= 2x threshold<br/>Activates Orderbook| LMPost
    end
    
    %% Orderbook Trading
    subgraph OB[Orderbook Trading - Post-Graduation Only]
        direction TB
        TV -->|4a. Place Order Lock Collateral| TV
        TV -->|Execute Trade| LMPost
        LMPost -->|Mint/Burn| OT
        LMPost -->|Match Orders P2P| TV
        TV -->|Unlock Collateral| TV
    end
    
    %% V6 Locked Proceeds Flow
    subgraph Locked[V6 Locked Proceeds]
        direction LR
        LockedQueue[Lock Queue<br/>24h per entry]
        LMPre -->|Lock on Sell<br/>Pre-Graduation| LockedQueue
        LockedQueue -->|useLockedProceeds Reinvestment| LMPre
        LockedQueue -.->|claimUnlocked After 24h| TV
    end
    
    %% Fees
    subgraph Fees[Fee Distribution]
        direction TB
        LMPost -->|AMM Fee: feeLMSR Default 0.5%<br/>Post-Graduation| LMPost
        LMPre -->|AMM Fee: Auto-compounds<br/>Pre-Graduation| LMPre
        FC -.->|Orderbook Fee Not yet implemented| FC
    end
    
    %% Creator Flow
    Creator -->|Initial Deposit| LMPre
    LMPre -->|On Graduation: bBase >= 2x threshold| LMPost
    LMPre -->|On Expiry: Refund| Creator
    
    %% LP Flow Note (V6: No Global LP Pool for Market Liquidity)
    %% SoothLiquidityVault is only for global locked proceeds tracking
    %% Each Launchpad market is its own vault
    
    %% Styling
    classDef userClass fill:#3b82f6,stroke:#1e40af,color:#fff
    classDef contractClass fill:#8b5cf6,stroke:#6d28d9,color:#fff
    classDef vaultClass fill:#10b981,stroke:#059669,color:#fff
    classDef marketClass fill:#f59e0b,stroke:#d97706,color:#fff
    classDef lockClass fill:#ef4444,stroke:#dc2626,color:#fff
    
    class User,LP,Creator userClass
    class TV,SLV,FC contractClass
    class LMPre,LMPost marketClass
    class LockedQueue,LMPre lockClass
```

## Key Money Flows

### 1. Deposit/Withdrawal
- **User → TraderVault**: Deposit USDC (available balance)
- **TraderVault → User**: Withdraw USDC

### 2. AMM Buy (Post-Graduation Launchpad Market)
- **TraderVault → LaunchpadMarket**: Cost + Fee
- **LaunchpadMarket**: Funds stay in market (market is its own vault)
- **LaunchpadMarket**: Fee accumulates in market reserve

### 3. AMM Sell (Post-Graduation Launchpad Market)
- **LaunchpadMarket**: Pays net proceeds (after fee) to TraderVault
- **TraderVault**: Locks proceeds for 24 hours via global SoothLiquidityVault
- **SoothLiquidityVault → User**: Unlocks after 24h (claimable)

### 4. AMM Buy (V6 Launchpad Pre-Graduation)
- **TraderVault → LaunchpadMarket**: Cost + Fee
- **LaunchpadMarket**: Fee auto-compounds into `bBase` (liquidity growth)
- **LaunchpadMarket**: Mints LP tokens 1:1 to trader (pre-graduation)
- **Locked Proceeds**: Can be used via `useLockedProceeds()` instead of available balance

### 5. AMM Sell (V6 Launchpad Pre-Graduation)
- **LaunchpadMarket**: Proceeds - Fee locked in market (FIFO queue, 24h per entry)
- **Locked Proceeds**: Can be reinvested immediately or claimed after 24h
- **LaunchpadMarket**: Fee auto-compounds into `bBase`

### 6. Orderbook Trading
- **TraderVault**: Locks collateral for orders
- **Market**: Matches orders peer-to-peer, mints/burns OutcomeTokens
- **TraderVault**: Unlocks collateral after match

### 7. Graduation (V6 Launchpad)
- When `bBase >= 2x threshold`: Launchpad market graduates to post-graduation phase
- Post-graduation: Orderbook activates, both AMM and Orderbook available
- Still a Launchpad market (not a separate market type)

### 8. Fees
- **AMM Fee Pre-Graduation**: Auto-compounds into `bBase` (liquidity growth), mints LP tokens 1:1
- **AMM Fee Post-Graduation**: `feeLMSR` (default 0.5%) - accumulates in market reserve
- **Orderbook Fee**: Not yet implemented (planned 0.1% with LP/treasury split)

### 9. Important V6 Architecture Notes
- **All markets are Launchpad markets** (no separate "standard market" type)
- **Pre-Graduation**: Locked proceeds stay in the market itself (FIFO queue)
- **Post-Graduation**: Locked proceeds managed via global `SoothLiquidityVault`
- **Market is its own vault**: Each Launchpad market implements `ISoothLiquidityVault` directly
- **SoothLiquidityVault**: Only used for global locked proceeds tracking, not market liquidity

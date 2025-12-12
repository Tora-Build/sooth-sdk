# Staking Design Research

**Date:** 2025-12-02  
**Status:** Proposal  
**Impact:** Security & Incentive Alignment

---

## Executive Summary

The Sooth Protocol relies on **Guardians** to ensure market integrity, detect manipulation, and resolve disputes. To align incentives and prevent malicious behavior, a robust **Staking System** is required.

**Recommendation:** Implement a **Dual-Token Staking Model**:

1.  **Guardian Staking (SOOTH/ETH/USDC):** Required to register as a Guardian. Staked assets are slashed for malicious marking or incorrect dispute resolution.
2.  **LP Staking (svToken):** Optional staking of Vault Shares (svToken) to earn bonus rewards and governance weight.

---

## 1. Guardian Staking (Security Layer)

Guardians are the "human firewall" of the protocol. They need "skin in the game" to be trusted.

### A. Mechanics

- **Requirement:** To register, a Guardian must deposit a minimum amount of collateral (e.g., 10,000 USDC or equivalent SOOTH).
- **Lock-up Period:** Staked assets are subject to an **unbonding period** (e.g., 7 days) to prevent "slash-and-run" attacks.
- **Utilization:**
  - **Marking:** When a Guardian "marks" a market (flags it for review/dispute), a portion of their stake is effectively "bonded" to that specific action.
  - **Disputing:** Initiating a dispute requires an additional bond.

### B. Slashing Conditions

1.  **Malicious Marking:** Flagging a legitimate market as "invalid" or "manipulated" without cause.
    - _Penalty:_ Minor slash (e.g., 1-5% of stake) to discourage spam.
2.  **Incorrect Dispute:** Challenging a correct settlement result and losing the dispute.
    - _Penalty:_ Major slash (e.g., 10-50% of bond) paid to the winning party.
3.  **Collusion/Attack:** If a Guardian is proven to be part of a sybil attack (via governance vote or ZK proof).
    - _Penalty:_ 100% slash (burned or sent to insurance fund).

### C. Rewards (Incentives)

- **Base Yield:** Guardians earn a share of the **Trading Fees** (proposed 20% split).
- **Marking Bounty:** If a Guardian correctly flags a bad market, they receive a bounty from the market creator's bond or the protocol treasury.
- **Dispute Reward:** If a Guardian wins a dispute, they receive the slashed bond of the losing party.

---

## 2. LP Staking (Liquidity Layer)

Liquidity Providers (LPs) hold `svToken` (Sooth Vault Shares). To encourage long-term liquidity provision, we can implement staking for these shares.

### A. Mechanics

- **Deposit:** LPs stake their `svToken` into a `StakedSoothVault` contract.
- **Reward:** Stakers earn **SOOTH** governance tokens (liquidity mining) + a share of protocol revenue.
- **Time-Lock Boost:** LPs can choose to lock their stake for 1, 3, 6, or 12 months. Longer locks = higher reward multiplier (e.g., 1x, 1.25x, 1.5x, 2x).

### B. Benefits

- **Sticky Liquidity:** Prevents mercenary capital from fleeing during short-term volatility.
- **Governance:** Staked `svToken` can carry voting power, giving LPs a voice in risk parameter changes (`bGlobal`, `K`).

---

## 3. Technical Implementation Strategy

### Phase 1: Simple Guardian Staking (MVP)

Implement `SoothGuardianStaking.sol`:

- ERC20 deposit/withdraw with unbonding period.
- `isGuardian(address)` view function.
- `slash(address, amount)` function callable by `SoothSettlement` or Governance.

```solidity
contract SoothGuardianStaking is Ownable {
    IERC20 public stakingToken;
    uint256 public minStake = 10_000 * 1e6; // 10k USDC
    uint256 public unbondingPeriod = 7 days;

    struct Stake {
        uint256 amount;
        uint256 unbondingStart;
    }
    mapping(address => Stake) public stakes;

    function stake(uint256 amount) external {
        stakingToken.transferFrom(msg.sender, address(this), amount);
        stakes[msg.sender].amount += amount;
        stakes[msg.sender].unbondingStart = 0; // Reset unbonding
    }

    function initiateUnstake() external {
        stakes[msg.sender].unbondingStart = block.timestamp;
    }

    function withdraw() external {
        require(block.timestamp >= stakes[msg.sender].unbondingStart + unbondingPeriod, "Locked");
        uint256 amount = stakes[msg.sender].amount;
        stakes[msg.sender].amount = 0;
        stakingToken.transfer(msg.sender, amount);
    }

    function isGuardian(address who) external view returns (bool) {
        return stakes[who].amount >= minStake && stakes[who].unbondingStart == 0;
    }
}
```

### Phase 2: Integrated Marking & Slashing

- Connect `SoothGuardianStaking` to `SoothAdjudicatorRegistry`.
- Guardians call `markMarket(marketId)` on the Registry, which checks `Staking.isGuardian(msg.sender)`.

### Phase 3: LP Staking & Governance

- Deploy `StakedSoothVault` (ERC4626 wrapper or Synthetix `StakingRewards` fork).
- Launch SOOTH token for rewards.

---

## 4. Recommendations

1.  **Start with USDC:** For the MVP, use USDC as the staking token for Guardians. This avoids the complexity of a native token launch and ensures the "value at risk" is stable and real.
2.  **High Minimum Stake:** Set the barrier to entry relatively high (e.g., $5k-$10k) initially to ensure only serious, professional Guardians participate.
3.  **Manual Slashing (Initially):** For the first version, allow the **Protocol Multi-sig** to execute slashes based on community reports. Automate this later via ZK proofs or DAO votes.

---

# ProtocolConfig: Guardian Roles & Global Pause

> Protocol-level guardian management and emergency pause mechanism

**Status**: Implemented
**Last Updated**: 2026-01-25

---

## Overview

`ProtocolConfig` provides:
- Protocol-level guardian role list (owner-managed, not creator-chosen)
- Global pause flag for emergency stops
- Guardian or owner can pause/unpause

## Contract: ProtocolConfig.sol

```solidity
contract ProtocolConfig is Ownable, IProtocolConfig {
    mapping(address => bool) private _guardians;
    bool private _paused;

    function isPaused() external view returns (bool);
    function isGuardian(address account) external view returns (bool);
    function setGuardians(address[] calldata add, address[] calldata remove) external onlyOwner;
    function pause() external onlyGuardianOrOwner;
    function unpause() external onlyGuardianOrOwner;
}
```

## Integration Points

### TruthMarket

```solidity
// Constructor accepts protocolConfig
constructor(..., address _protocolConfig, ...) {
    protocolConfig = IProtocolConfig(_protocolConfig);
}

// Veto requires guardian role from ProtocolConfig
function veto() external {
    require(protocolConfig.isGuardian(msg.sender), "TruthMarket: not guardian");
    // ...
}
```

### Pause Gates

When `protocolConfig.isPaused()` returns `true`:

| Contract | Blocked | Allowed |
|----------|---------|---------|
| LaunchpadEngine | `createMarket`, `tradePositions` | `claimRefund`, `redeemLP` |
| TickBookPoolManager | `placeOrder`, `placeSpotSell` | `cancelOrder`, `claimFills` |
| TickBookVault | `depositUsdc` | `withdrawUsdc`, `redeemResolved` |
| AMMEngine | `tradePositions` | - |

**Design principle**: Pause blocks new risk-taking actions, but allows users to exit positions and claim funds.

## Guardian Responsibilities

1. Monitor settlements during veto window
2. Veto incorrect/malicious settlements via `TruthMarket.veto()`
3. Emergency pause if critical issues detected
4. Coordinate with protocol owner for resolution

## Owner Responsibilities

1. Manage guardian list via `setGuardians(add[], remove[])`
2. Can pause/unpause (override guardian if needed)
3. Configure protocol parameters

---

## Events

```solidity
event GuardianAdded(address indexed guardian);
event GuardianRemoved(address indexed guardian);
event ProtocolPaused(address indexed caller);
event ProtocolUnpaused(address indexed caller);
```

---

*Last Updated: 2026-01-25*

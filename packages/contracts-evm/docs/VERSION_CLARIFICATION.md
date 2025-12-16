# Launchpad Version Clarification

**Date**: 2025-12-15  
**Status**: Version Naming Standardization

---

## Version Definitions

### V5 Launchpad
**Definition**: Initial Launchpad implementation with 3-contract architecture

**Features**:
- Separate `MarketLPVault` contract
- `LaunchpadFactory` with `Ownable` (mutable state)
- No pre-graduation locking
- Creator can withdraw immediately after sell

**ADR**: ADR-014 (Sooth Launchpad Model V5 Architecture)

**Status**: ✅ Implemented (current codebase)

---

### V6 Launchpad
**Definition**: 2-contract architecture + immutable factory + pre-graduation locking

**Features**:
- Market implements `ISoothGovernorVault` (no separate LPVault)
- Market inherits `ERC20` for LP tokens
- `LaunchpadFactory` is immutable (no `Ownable`)
- `ProtocolConfig` contract for mutable parameters
- Pre-graduation sell proceeds locked (can reinvest, cannot withdraw)
- Guardian role for liquidation and `forceGraduate()`

**Plan File**: `/Users/danieltang/.cursor/plans/v5_2-contract_architecture_+_immutable_factory_7b1c02ee.plan.md`
> **Note**: Plan file is named "V5" but describes V6 architecture. This is a naming inconsistency.

**ADR**: ADR-015 (V6 Pre-Graduation Locking)

**Status**: ⏳ Design Complete, Implementation Pending (tests written, code not merged)

---

## Version Naming Confusion

### Issue
The plan file `/Users/danieltang/.cursor/plans/v5_2-contract_architecture_+_immutable_factory_7b1c02ee.plan.md` is named "V5" but describes what is now called **V6**.

### Resolution
- **V5** = 3-contract architecture (MarketLPVault separate) - **CURRENT CODEBASE**
- **V6** = 2-contract architecture (Market implements ISoothGovernorVault) - **DESIGNED, NOT MERGED**

The plan file should be considered the **V6 specification**, despite its filename.

---

## Current State

### Codebase (This Worktree)
- **Version**: V5
- **Architecture**: 3-contract (Factory, Market, MarketLPVault)
- **Factory**: `Ownable` with mutable state
- **Locking**: No pre-graduation locking

### V6 Implementation
- **Status**: Designed, tests written, implementation exists (possibly in different worktree)
- **Location**: May exist in worktree `mli` (per QA_STATUS.md)
- **Tests**: `LaunchpadV6.t.sol` (25 tests) - cannot compile until V6 merged

---

## Migration Path

### V5 → V6 Changes Required

1. **LaunchpadMarket.sol**:
   - Add `ERC20` inheritance
   - Implement `ISoothGovernorVault`
   - Merge `MarketLPVault` functionality
   - Add lock queue logic
   - Add liquidation functions

2. **LaunchpadFactory.sol**:
   - Remove `Ownable` inheritance
   - Remove mutable state (`treasury`, `adjudicator`)
   - Add `ProtocolConfig` immutable reference
   - Remove `createMarket()` lpVault return

3. **New Contracts**:
   - `ProtocolConfig.sol` (mutable config)
   - `IProtocolConfig.sol` (interface)

4. **TraderVault.sol**:
   - Update to use Market directly (no `governorVault()` call)
   - Add `useLockedProceeds()` support
   - Block withdrawals with locked proceeds

---

## Documentation References

- **V5**: ADR-014, `LAUNCHPAD_MODEL_RESEARCH.md`
- **V6**: ADR-015, `V6_ARCHITECTURE.md`, `README_V6_TESTS.md`
- **Plan**: `/Users/danieltang/.cursor/plans/v5_2-contract_architecture_+_immutable_factory_7b1c02ee.plan.md` (describes V6)

---

## Recommendation

1. ✅ Keep current naming: V5 = 3-contract, V6 = 2-contract
2. ⚠️ Note that plan file name is misleading (says V5 but describes V6)
3. 📝 Update plan file metadata to clarify it describes V6
4. 🔄 Merge V6 implementation when ready

---

**Last Updated**: 2025-12-15

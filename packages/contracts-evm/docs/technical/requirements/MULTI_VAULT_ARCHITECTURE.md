# Vault Architecture Requirements (Legacy / Superseded)

## Status: Superseded by Launchpad per-market vaults

---

## Context

The current protocol architecture (Launchpad) uses **per-market liquidity vaults**:

- Each `LaunchpadMarket` holds USDC directly and implements the vault interface.
- Market creation is via `LaunchpadFactory`.
- Settlement is **Adjudicator-only** via `finalizeResolution(outcome, tStar)`.

This document previously described a “single shared vault / multi-vault by adjudicator class” roadmap for a different architecture generation. Keep it only as historical context; do not treat it as a current requirement.

### If we revisit shared-vaults later

If Sooth re-introduces shared vaults (e.g. “vault per adjudicator class”), the routing and registries described below can be revisited, but they are **not** part of the current Launchpad architecture.

### Rationale for Current Design

- ✅ **Simplicity**: Easier to manage during development and testing
- ✅ **Unified Liquidity**: LPs provide liquidity to all markets from one pool
- ✅ **Lower Complexity**: Fewer contracts to deploy and manage
- ✅ **Faster Iteration**: Suitable for alpha/testing phase

---

## Intended Design (Future Phase)

### Design Intent

From `SoothVault.sol` line 6:

```solidity
/// @notice Singleton vault per (chain, adjudicatorClass).
```

### Architecture Goal

- **Multiple Vaults**: One vault instance per adjudicator class
- **Risk Isolation**: Separate liquidity pools for different adjudication mechanisms
- **Example Structure**:
  ```
  Chain: Base Sepolia
  ├── Vault A (UMA/Optimistic Oracle)
  │   ├── Market 1 (UMA)
  │   └── Market 2 (UMA)
  ├── Vault B (ZK Proof Adjudication)
  │   ├── Market 3 (ZK)
  │   └── Market 4 (ZK)
  └── Vault C (Attestation-based)
      └── Market 5 (Attestation)
  ```

---

## Requirements for Next Phase

### 1. Multi-Vault Deployment System

#### Contract Changes

- [ ] Update deployment scripts to support multiple vault instances
- [ ] Create vault registry contract to track vaults by adjudicator class
- [ ] Modify `SoothMarketFactory` to route markets to appropriate vault based on adjudicator class

#### Data Structure

```solidity
// Proposed VaultRegistry contract
contract SoothVaultRegistry {
    mapping(uint8 adjudicatorClassId => address vault) public vaultByClass;

    function registerVault(uint8 classId, address vault) external onlyOwner;
    function getVaultForClass(uint8 classId) external view returns (address);
}
```

### 2. Adjudicator Class → Vault Mapping

#### Automatic Routing

- [ ] When creating a market, automatically determine which vault to use based on adjudicator class
- [ ] Update `SoothMarketFactory.createMarket()` to:
  1. Look up adjudicator class from `SoothAdjudicatorRegistry`
  2. Query `VaultRegistry` for the appropriate vault
  3. Initialize market with the correct vault

#### Example Flow

```typescript
// Market creation with auto-routing
1. createMarket(adjudicator, riskClass)
2. adjudicatorClass = adjudicatorRegistry.classIdOf(adjudicator) // pseudo
3. vault = vaultRegistry.getVaultForClass(adjudicatorClass)
4. market.initialize(marketId, vault, ...)
```

### 3. Risk Isolation Benefits

#### Why Separate Vaults?

- **Risk Segregation**: failures in one adjudication mechanism don’t affect others
- **LP Choice**: LPs can choose which adjudication mechanisms to support
- **Different Risk Profiles**: Each vault can have different risk parameters
- **Regulatory Compliance**: Easier to comply with different jurisdictions

#### LP Experience

```typescript
// LPs can deposit into specific vaults
vault_UMA.depositFor(lpAddress, amount); // Support UMA markets only
vault_ZK.depositFor(lpAddress, amount); // Support ZK markets only
vault_ALL.depositFor(lpAddress, amount); // Support all market types
```

### 4. Migration Strategy

#### Phase 1 → Phase 2 Transition

- [ ] Deploy new vault instances for each adjudicator class
- [ ] Create migration contract to move liquidity from single vault to class-specific vaults
- [ ] Provide LP migration UI to choose which vaults to support
- [ ] Gradually deprecate single-vault architecture

#### Backward Compatibility

- [ ] Ensure existing markets continue to function during migration
- [ ] Provide grace period for LPs to migrate liquidity
- [ ] Update frontend to support multiple vault interactions

---

## Technical Specifications

### Vault Deployment Pattern

```solidity
// Deploy one vault per adjudicator class
SoothVault vault_UMA = new SoothVault(collateral);
SoothVault vault_ZK = new SoothVault(collateral);
SoothVault vault_Attestation = new SoothVault(collateral);

// Register in vault registry
vaultRegistry.registerVault(1, address(vault_UMA));        // classId 1 = UMA
vaultRegistry.registerVault(2, address(vault_ZK));         // classId 2 = ZK
vaultRegistry.registerVault(3, address(vault_Attestation)); // classId 3 = Attestation
```

### Market Factory Update

```solidity
function createMarket(address adjudicator, RiskClass riskClass) external {
    // Get adjudicator config (pseudo)
    uint8 classId = adjudicatorRegistry.classIdOf(adjudicator);

    // Get appropriate vault for this class
    address vaultAddress = vaultRegistry.getVaultForClass(classId);
    ISoothVault vault = ISoothVault(vaultAddress);

    // Create market with class-specific vault
    SoothMarket market = new SoothMarket();
    market.initialize(marketId, vault, riskManager, amm, adjudicator);

    // ... rest of initialization
}
```

---

## Implementation Checklist

### Contracts to Create

- [ ] `SoothVaultRegistry.sol` - Maps adjudicator classes to vaults
- [ ] `VaultMigration.sol` - Handles liquidity migration from Phase 1 to Phase 2

### Contracts to Modify

- [ ] `SoothMarketFactory.sol` - Add vault registry lookup
- [ ] `DeploySooth.s.sol` - Deploy multiple vaults
- [ ] `SoothRiskManager.sol` - Support per-vault risk parameters (optional)

### Frontend Updates

- [ ] Multi-vault UI for LP deposits/withdrawals
- [ ] Display which vault each market uses
- [ ] Migration interface for existing LPs
- [ ] Per-vault analytics and metrics

### Documentation Updates

- [ ] Update `INTEGRATION_DETAILS.md` with multi-vault architecture
- [ ] Create migration guide for LPs
- [ ] Update contract interface documentation
- [ ] Add vault selection guide for market creators

---

## Timeline Estimate

| Phase           | Duration  | Tasks                                                        |
| --------------- | --------- | ------------------------------------------------------------ |
| **Design**      | 1-2 weeks | Finalize vault registry design, review security implications |
| **Development** | 2-3 weeks | Implement contracts, write tests, update deployment scripts  |
| **Testing**     | 1-2 weeks | Testnet deployment, integration testing, security review     |
| **Migration**   | 2-4 weeks | Deploy to mainnet, LP migration period, monitoring           |

**Total**: ~6-11 weeks

---

## Open Questions

1. **Default Vault**: Should there be a default vault for new adjudicator classes?
2. **Cross-Vault Liquidity**: Should LPs be able to provide liquidity across multiple vaults with one transaction?
3. **Vault Governance**: Who decides when to create a new vault for a new adjudicator class?
4. **Risk Parameters**: Should each vault have independent global `bGlobal` calculations?
5. **Settlement**: Does `SoothSettlement` need to be vault-aware, or can it remain vault-agnostic?

---

## References

- Current implementation: `contracts/core/SoothVault.sol`
- Design comment: Line 6 - "Singleton vault per (chain, adjudicatorClass)"
- Related contracts: `SoothMarketFactory.sol`, `SoothAdjudicatorRegistry.sol`
- Deployment: `script/DeploySooth.s.sol`

---

## Notes

- This requirement emerged during Phase 1 deployment review
- Current single-vault design is intentionally simplified for testing
- Multi-vault architecture is the intended production design
- No breaking changes to existing markets during migration

# Archived V5 Launchpad Contracts

This directory contains deprecated V5 Launchpad contracts that have been replaced by V6 architecture.

## Archived Files

- `MarketLPVault.sol` - Separate LP vault contract (merged into LaunchpadMarket)
- `LaunchpadFactory.sol` - Ownable factory with mutable state (replaced by immutable LaunchpadFactory)
- `LaunchpadMarket.sol` - V5 market with separate LPVault (replaced by LaunchpadMarket with merged vault)

## V6 Changes

- **2-Contract Architecture**: Market implements ISoothGovernorVault itself (no separate LPVault)
- **Immutable Factory**: LaunchpadFactory has no Ownable, mutable config moved to ProtocolConfig
- **Pre-Graduation Locking**: All sell proceeds locked (can reinvest, cannot withdraw)
- **Creator = Governor**: Creator has governor permissions (can increase liquidity, settle market)

## Migration Notes

- Existing V5 markets continue to work (backward compatible)
- New markets use current architecture automatically
- V5 contracts remain for reference but should not be used for new deployments

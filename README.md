# Sooth Protocol - Fullstack Skeleton v5 (No OpenZeppelin Dependency)

This version removes all OpenZeppelin imports for Foundry by providing local stubs:

- `contracts/stubs/Initializable.sol`
- `contracts/stubs/OwnableUpgradeable.sol`
- `contracts/stubs/ReentrancyGuardUpgradeable.sol`
- `contracts/stubs/IERC20Upgradeable.sol`
- `contracts/stubs/MerkleProof.sol`

Core contracts:

- `SoothVault` (singleton vault)
- `SoothMarket` (binary vAMM market using simplified LMSR)
- `SoothAdjudicatorManager` + adjudicator adapters (UMA, Reality, Chainlink, Attestation)
- `SoothMarketFactory`
- `SoothSmartAccount`
- Settlement: `SoothSettlementMerkle` + `SoothZKVerifierStub`

Testing:

```bash
forge install foundry-rs/forge-std --no-commit
forge clean
forge test
```

Hardhat is configured via `hardhat.config.ts` and `scripts/deploy-sooth.ts`, but uses the same contracts.

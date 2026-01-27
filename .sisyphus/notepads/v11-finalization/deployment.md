# V11.1 Base Sepolia Deployment

## Deployment Details
- **Timestamp**: 2026-01-26T03:21:36.890Z
- **Version**: V11.1
- **Chain**: Base Sepolia (chainId: 84532)
- **Deployer**: 0xEfdB15EE6e7C7C7906cb230AfF1EDb75CcBaA74F

## StartBlock for Indexer
- **Queried Block**: 36814647
- **StartBlock (block - 10)**: 36814637

## Contract Addresses (7 unique contracts)

| Contract | Address |
|----------|---------|
| MockUSDC | 0xb4f46ed670ed6c4cf422ea61e06961d64a753e9d |
| ProtocolConfig | 0x4c76089b2ad28b2fc9c4d7a1c06eeb13d0336fc0 |
| Collateralizer | 0x4deae2f0a39b84f57a28f07762e8b47085ed38de |
| AMMEngine | 0x1399d385d2861eb046d83ededb7f4ea3aaca2ef5 |
| TickBookVault | 0x667c100f8f5667177fce0e9566ffe1403fc7c6f7 |
| TickBookPoolManager | 0x61ddf4716a181658e2fa9efd98b93c634ac49cdd |
| LaunchpadEngine | 0x3cfa2113c919c916e8334d245b157de937e76836 |

**Note**: TickBook is an alias for TickBookPoolManager (same address)

## Verification Results
- **LaunchpadEngine owner**: 0xEfdB15EE6e7C7C7906cb230AfF1EDb75CcBaA74F ✓
- **ProtocolConfig bytecode**: Deployed (non-empty) ✓

## Deployment Blocks
- MockUSDC: block 36814682
- ProtocolConfig: block 36814684
- Collateralizer: block 36814687
- AMMEngine: block 36814689
- TickBookVault: block 36814692
- TickBookPoolManager: block 36814694
- DynamicFeeHook: block 36814696 (internal, not tracked in configs)
- LaunchpadEngine: block 36814699

## Notes
- All 266 tests passed before deployment
- DynamicFeeHook deployed at 0x0f6d071493313a7c123821ebff8ef80191d221ca but NOT tracked in deployment configs (as expected)
- Auto-generated artifact saved to: packages/contracts-core/deployments/baseSepolia.json

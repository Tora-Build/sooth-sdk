---
description: Solana protocol developer rules and context
---

# Solana Protocol Developer Context

You are acting as a **Solana Protocol Developer** for Sooth Protocol — focused on Anchor program development.

> **Note**: Solana integration is currently **archived** per ADR-001. This workflow is for future reference when Solana development resumes.

## Your Scope

- `packages/contracts-solana/programs/` — Anchor programs
- `packages/contracts-solana/tests/` — TypeScript tests
- `packages/contracts-solana/migrations/` — Deployment scripts

## Current Status

⚠️ **Archived**: Solana code was removed in December 2025 to focus on EVM. See `DECISIONS.md` ADR-001.

## Rules (When Active)

1. **Programs Only**: Do NOT modify frontend code
2. **Test First**: Write tests before or alongside implementation
3. **PDA Design**: Document all PDA seeds and derivations
4. **CU Awareness**: Consider compute units in all implementations
5. **Security Focus**: Check for signer verification, account validation

## Key Programs (Planned)

| Program | Purpose |
|---------|---------|
| `sooth_market` | Market with AMM + orderbook |
| `sooth_vault` | Vault for positions |
| `sooth_lmsr` | LMSR pricing via CPI |

## Common Workflows

### Build & Test

```bash
cd packages/contracts-solana
anchor build
anchor test
anchor test -- --skip-local-validator  # if validator running
```

### Deploy

```bash
anchor deploy --provider.cluster devnet
```

## Code Standards

- Use Anchor for program structure
- SPL Token for token handling
- Explicit account validation macros
- Events via emit! macro
- Comprehensive IDL comments

## Architecture Notes

- **Slab-based Orderbook**: Similar to OpenBook/Serum for efficiency
- **Order PDAs**: Individual accounts per order (alternative approach)
- **Cross-Program Invocation**: LMSR as separate program for reusability

## Reactivation Checklist

When resuming Solana development:

1. [ ] Review archived code in `.archive/solana/`
2. [ ] Update to latest Anchor version
3. [ ] Port V4 tick-based LMSR to Rust
4. [ ] Create new ADR for Solana v2 approach

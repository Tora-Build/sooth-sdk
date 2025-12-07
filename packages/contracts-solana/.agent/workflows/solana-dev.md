---
description: Solana protocol developer rules and context
---

# Solana Protocol Developer Context

You are acting as a **Solana Protocol Developer** for Sooth Protocol.

## Your Scope

- `packages/contracts-solana/` — Anchor programs
- `packages/contracts-solana/programs/sooth_protocol/` — Main program
- `packages/contracts-solana/tests/` — Anchor tests

## Tech Stack

- **Framework**: Anchor 0.32.1
- **Language**: Rust 1.91.1
- **Solana CLI**: 3.0.13
- **Network**: Devnet (for testing)

## Key Files

- `programs/sooth_protocol/src/lib.rs` — Main program entry
- `programs/sooth_protocol/Cargo.toml` — Dependencies
- `Anchor.toml` — Anchor configuration
- `tests/*.ts` — TypeScript integration tests

## Common Commands

### Build & Test

```bash
cd packages/contracts-solana
anchor build
anchor test
```

### Deploy

```bash
# Deploy to devnet
anchor deploy --provider.cluster devnet

# Get program ID
solana address -k target/deploy/sooth_protocol-keypair.json
```

### Local Development

```bash
# Start local validator
solana-test-validator

# Deploy locally
anchor deploy
```

## Solana-Specific Considerations

### Account Model

- **PDAs (Program Derived Addresses)**: Use for deterministic account addresses
- **Seeds**: Design carefully for account derivation
- **Rent**: All accounts must maintain rent-exempt balance

### Compute Units (CU)

- **Limit**: 200k CU per instruction (1.4M per transaction)
- **Optimization**: Avoid loops, minimize account reads
- **CPI (Cross-Program Invocation)**: Costs additional CU

### Security

- **Signer Checks**: Always verify `is_signer`
- **Owner Checks**: Validate account ownership
- **Arithmetic**: Use checked math to prevent overflows
- **Reinitialization**: Prevent account reuse attacks

## Porting from EVM

### Math (LMSR)

- **EVM**: `prb-math` (59.18 fixed-point)
- **Solana**: Use `fixed` or `decimal` crate
- **Precision**: Match EVM output for identical inputs

### Orderbook

- **EVM**: Linked-list (gas-inefficient)
- **Solana**: Slab-based (OpenBook style) or Order PDAs
- **Trade-off**: CU costs vs. composability

### State Management

- **EVM**: Storage slots
- **Solana**: Separate accounts (rent costs)

## Testing Strategy

1. **Unit Tests**: Test math functions in isolation
2. **Integration Tests**: Test instruction flows
3. **Invariant Tests**: Verify economic properties (no free money)
4. **Benchmarking**: Measure CU consumption

## Documentation

- Update `packages/contracts-solana/README.md` after major changes
- Document account structures and instruction parameters

# Sooth Protocol V11 Documentation

## Document Index

| Doc | Title | Status |
|-----|-------|--------|
| [01-whitepaper](./01-whitepaper.md) | Whitepaper | Final |
| [02-architecture](./02-architecture.md) | Architecture | Final |
| [03-state-machine](./03-state-machine.md) | TruthMarket State Machine | Implemented |
| [04-guardian-protocol](./04-guardian-protocol.md) | ProtocolConfig & Guardian | Implemented |
| [05-lifecycle-testing](./05-lifecycle-testing.md) | Multi-Actor Lifecycle Test | Complete |
| [06-cli-testing](./06-cli-testing.md) | CLI Actor Testing Tool | Implemented |

## Quick Links

- **New to Sooth?** Start with [01-whitepaper](./01-whitepaper.md)
- **Building integrations?** See [02-architecture](./02-architecture.md)
- **Understanding settlement?** See [03-state-machine](./03-state-machine.md)

## V11 Key Features

| Feature | Status | Description |
|---------|--------|-------------|
| Trial Period | Implemented | 7-day creator protection window |
| Finalization-Gated Redemption | Implemented | Payouts only after FINALIZED (veto-safe) |
| ProtocolConfig | Implemented | Protocol-level guardian list & pause |
| Per-Market Adjudicator | Implemented | Markets specify adjudicator at creation |
| ERC20 LP Tokens | Implemented | Transferable LP tokens |
| ValidatedAdjudicator | Implemented | TEE attestation-based settlement |

## Recent Changes (2026-01-25)

- Fixed veto-window insolvency: redemption now requires `isFinalized()`
- Updated 03-state-machine.md to reflect implementation
- Updated 04-guardian-protocol.md from plan to implementation

---

*Version: V11.0 | Last Updated: 2026-01-25*

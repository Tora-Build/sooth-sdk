# Sooth Protocol V12 Documentation

> **Updated for V12 (SoothBook)** — TickBook has been replaced by SoothBook, a 4-atomic orderbook. See `docs/V12/SOOTHBOOK.md` for the full V12 spec.

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
- **V12 Orderbook details?** See [docs/V12/SOOTHBOOK.md](../V12/SOOTHBOOK.md)

## V12 Key Features

| Feature | Status | Description |
|---------|--------|-------------|
| SoothBook Orderbook | Implemented | 4-atomic orderbook (buyYes, buyNo, mint, merge) — replaces TickBook |
| ERC20 Outcome Tokens | Implemented | Real transferable YES/NO tokens (not internal balances) |
| FIFO Matching | Implemented | First-in-first-out matching at each tick level |
| Auto-Match Engine | Implemented | yesTick + noTick ≥ 1000 → auto-mint complete set |
| Trial Period | Implemented | 7-day creator protection window |
| Finalization-Gated Redemption | Implemented | Payouts only after FINALIZED (veto-safe) |
| ProtocolConfig | Implemented | Protocol-level guardian list & pause |
| Per-Market Adjudicator | Implemented | Markets specify adjudicator at creation |
| ERC20 LP Tokens | Implemented | Transferable LP tokens |
| ValidatedAdjudicator | Implemented | TEE attestation-based settlement |

## Recent Changes (2026-02-20)

- V12 SoothBook replaces TickBook entirely (4 atomic actions, no vault)
- Documentation updated to reflect V12 architecture
- See `docs/V12/SOOTHBOOK.md` for complete V12 specification

---

*Version: V12.0 (SoothBook) | Last Updated: 2026-02-20*

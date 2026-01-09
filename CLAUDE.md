# Sooth Protocol (EVM)

Prediction market protocol with LMSR AMM and orderbook trading.

## Project Context

@.claude/rules/knowledge.md
@.claude/rules/lessons.md

## Commands

- `/deploy` - Deploy contracts
- `/preflight` - Session startup checklist
- `/visualize` - Create mermaid diagrams

## Skills (Auto-Discovered)

Global skills in `~/.claude/skills/` are automatically applied:
- `evm-development` - Solidity/Foundry work
- `frontend-dev` - React/UI development
- `codebase-auditor` - Find inconsistencies
- `security-scan` - Slither analysis
- `gas-optimizer` - Gas optimization

## Quick Start

```bash
# Frontend
cd apps/web && pnpm dev

# Contracts
cd packages/contracts-core
forge build && forge test
```

## Architecture

See `.claude/rules/knowledge.md` for detailed protocol architecture.

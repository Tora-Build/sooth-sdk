## 2026-02-06 - Stage Badge & LP Portfolio Implementation

### Successful Patterns
- **Wave-based execution**: Split UI-only changes (Wave 1) from data layer changes (Wave 2) for cleaner commits
- **Color consistency**: Used Moltbook palette throughout (teal #00d4aa, red #e01b24, gold #ffd700)
- **Graceful degradation**: LP balance defaults to 0n, positions work even if lpToken is undefined
- **ERC20 standard**: Simple balanceOf ABI works for all LP tokens

### Technical Decisions
- **LP token color**: Gold (#ffd700) chosen to distinguish from YES (teal) and NO (red)
- **Stage badge placement**: Inside bottom-52 div as first element, before stats row
- **Fee hint conditional**: Only show for `market.stage === 'bonding'` to avoid clutter
- **Position filtering**: Include positions with `lpBalance > 0n` even if no shares

### Build Verification
- Both waves passed `npm run build` with zero errors
- Only warnings were about chunk sizes (expected for web3 dependencies)

### Commit Strategy
- Wave 1: `feat(lite): add market stage badge and fee-LP hint`
- Wave 2: `feat(lite): show LP token balance in portfolio`

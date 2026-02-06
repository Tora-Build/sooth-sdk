# Mobile UI/UX Improvement - Decisions

## [2026-02-02] Aesthetic Direction: Playful/Gamified

**Decision**: Use Playful/Gamified aesthetic (like Robinhood meets Polymarket)

**Rationale**:
- Prediction markets should feel energetic and engaging
- Target audience: crypto-native traders who appreciate bold design
- Differentiate from generic financial apps

**Characteristics**:
- Vibrant, energetic colors (electric blue primary)
- Rounded corners (12-28px)
- Bold typography (700-800 weight)
- Fun micro-interactions
- Approachable but professional

**Alternatives Considered**:
- Minimalist/Clean: Too generic, lacks personality
- Dark/Serious: Too intimidating for new users
- Gradient-heavy: Violates ui-rules (no gradients)

## [2026-02-02] Color Palette

**Primary**: Electric Blue (#3B82F6)
- Vibrant, energetic
- Good contrast on dark backgrounds
- Not purple (purple is accent2 only per ui-rules)

**Outcomes**:
- YES: Green (#10B981)
- NO: Red (#EF4444)

**Accents**:
- Amber (#F59E0B): Badges, highlights
- Purple (#8B5CF6): Special events (ONLY as accent, not primary)

## [2026-02-02] Typography System

**Headings**: Bold (700 weight), tight tracking
- Conveys confidence and energy
- Stands out on dark backgrounds

**Numbers**: Tabular-nums, extra bold (800)
- Per ui-rules: MUST use tabular-nums for all numbers
- Prevents layout shift when numbers change
- Extra bold (800) for large numbers (prices, odds)

**Labels**: Uppercase, 600 weight
- Clear hierarchy
- Playful but professional

## [2026-02-02] Spacing & Corners

**Spacing Scale**: 4, 8, 16, 24, 32, 48px
- Generous spacing for touch targets
- Consistent rhythm

**Border Radius**: 12-28px (more rounded than typical)
- Friendly, approachable
- Matches playful aesthetic
- Not too rounded (not pill-shaped)

**Shadows**: Subtle depth
- Elevates cards and buttons
- Not too heavy (maintains clean look)

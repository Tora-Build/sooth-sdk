# Sooth Protocol Design System

A living reference for maintaining visual consistency across the dApp.

---

## Color Palette

| Token         | Hex                  | Usage                          |
| ------------- | -------------------- | ------------------------------ |
| `primary`     | `#6366f1`            | CTAs, links, focus states      |
| `accent`      | `#8b5cf6`            | Highlights, premium elements   |
| `success`     | `#10b981`            | Positive actions, YES outcomes |
| `destructive` | `#f43f5e`            | Errors, NO outcomes            |
| `background`  | `#020617`            | Page background                |
| `surface`     | `rgba(15,23,42,0.6)` | Card backgrounds               |

### Glow Utilities

```css
shadow-glow-indigo   /* Hover states, interactive cards */
shadow-glow-emerald  /* Success actions, YES buttons */
shadow-glow-rose     /* Danger actions, NO buttons */
shadow-glow-violet   /* Premium/glow buttons */
```

---

## Typography

| Element        | Font        | Weight  | Size    |
| -------------- | ----------- | ------- | ------- |
| Body           | Inter       | 400     | 14-16px |
| Labels         | Inter       | 500     | 10-12px |
| Headings       | Outfit      | 600-700 | 18-32px |
| Mono (numbers) | System mono | 500     | varies  |

---

## Component Variants

### Card

```tsx
<Card variant="default" />      // Standard glass card
<Card variant="premium" />      // Enhanced glow on hover
<Card variant="interactive" />  // Indigo glow + scale on hover
```

### Button

```tsx
<Button variant="primary" />    // Gradient CTA (default)
<Button variant="secondary" />  // Outlined, subtle
<Button variant="glow" />       // Pulsing violet glow
<Button variant="success" />    // Emerald, for confirmations
<Button variant="danger" />     // Rose, for destructive actions
```

### Badge

```tsx
<Badge variant="live" />        // Pulsing green glow (trading status)
<Badge variant="success" />     // Static positive state
<Badge variant="outline" />     // Subtle, informational
```

---

## Animation Standards

| Property    | Value         | Usage              |
| ----------- | ------------- | ------------------ |
| Duration    | `200-300ms`   | Hover transitions  |
| Easing      | `ease-out`    | Natural feel       |
| Hover scale | `scale(1.02)` | Buttons, cards     |
| Pulse       | `2s infinite` | Live status badges |
| Shimmer     | `2s infinite` | Loading skeletons  |

### CSS Classes

```css
.animate-fade-in-up     /* Page entrance */
/* Page entrance */
.shimmer                /* Loading skeleton */
.pulse-glow-success     /* Live status indicator */
.stagger-1 to .stagger-5; /* Delayed animations */
```

---

## Spacing

Use **4px increments** via Tailwind:

- Gaps: `gap-2` (8px), `gap-4` (16px), `gap-6` (24px)
- Padding: `p-4` (16px), `p-6` (24px) for cards
- Margins: `mb-4` (16px), `mb-6` (24px) between sections

---

## Best Practices

1. **Use semantic colors**: Success for positive, destructive for negative
2. **Apply hover states**: Every interactive element needs feedback
3. **Be consistent**: Use component variants, not custom one-offs
4. **Prefer transforms**: Use `scale` and `opacity` for animations (GPU-accelerated)
5. **Group hover effects**: Use `group` and `group-hover:` for nested elements

---

## File Reference

| File                 | Purpose                       |
| -------------------- | ----------------------------- |
| `src/index.css`      | Custom utilities, animations  |
| `tailwind.config.js` | Theme tokens, shadows         |
| `src/components/ui/` | Reusable component primitives |

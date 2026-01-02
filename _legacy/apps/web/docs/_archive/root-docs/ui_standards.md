# Sooth Protocol: UI Design Standards

To ensure a premium, cohesive, and "wow" user experience, we will adhere to the following design system.

## 1. Design Philosophy

- **Theme**: "Cyber-Glass". Deep space backgrounds, glassmorphism containers, neon accents.
- **Vibe**: Professional, Futuristic, Trustworthy.
- **Interaction**: Smooth, responsive, tactile.

## 2. Color Palette

### Backgrounds

- **Page BG**: `bg-slate-950` (Deep Blue/Black)
- **Card BG**: `bg-slate-900/50` with `backdrop-blur-md` (Glass)
- **Overlay**: `bg-black/40`

### Accents (Neon)

- **Primary (Brand)**: `text-indigo-400` / `bg-indigo-500` (Glows)
- **Success (YES/Buy)**: `text-emerald-400` / `bg-emerald-500`
- **Danger (NO/Sell)**: `text-rose-400` / `bg-rose-500`
- **Warning (Cooldown)**: `text-amber-400`

### Typography

- **Headings**: `font-outfit` (Modern, geometric) - White `text-slate-50`
- **Body**: `font-inter` (Clean, readable) - Grey `text-slate-300`
- **Muted**: `text-slate-500`

## 3. Component Styles

### Cards (Glass Containers)

```css
.glass-card {
  @apply bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
}
```

### Buttons

- **Primary**: Gradient BG, slight glow on hover.
  - `bg-gradient-to-r from-indigo-600 to-violet-600 hover:shadow-lg hover:shadow-indigo-500/20`
- **Secondary**: Transparent with border.
  - `border border-slate-700 hover:bg-slate-800`
- **Action (Buy)**: Emerald Gradient.
- **Action (Sell)**: Rose Gradient.

### Inputs

- `bg-slate-950/50 border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl`

## 4. Layout & Spacing

- **Grid System**: 12-column grid for dashboards.
- **Spacing**: Multiples of 4px (Tailwind standard).
  - Section Gap: `gap-8` (32px)
  - Card Padding: `p-6` (24px)
- **Max Width**: `max-w-7xl` centered.

## 5. Motion & Feedback

- **Transitions**: `transition-all duration-200 ease-in-out` on all interactive elements.
- **Toast Notifications**: Top-right, styled to match the glass theme.
- **Loading**: Skeleton loaders (shimmer effect) instead of spinners where possible.

## 6. Iconography

- **Library**: Lucide React (Clean, consistent stroke width).
- **Size**: 16px (sm), 20px (md), 24px (lg).

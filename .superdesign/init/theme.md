# Theme - Sooth Lite PWA

## Tailwind Config
**Path**: `apps/lite/tailwind.config.js`

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#000000',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
```

## Global CSS
**Path**: `apps/lite/src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
  }

  html,
  body,
  #root {
    height: 100%;
    width: 100%;
    overflow: hidden;
    background-color: #000000;
    color: #ffffff;
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    overscroll-behavior: none;
  }

  ::-webkit-scrollbar {
    display: none;
  }

  input[type='number']::-webkit-inner-spin-button,
  input[type='number']::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  input[type='number'] {
    -moz-appearance: textfield;
  }
}
```

## Color Palette

### Background & Surface
- `bg-black` / `#000000` - Primary background
- `bg-zinc-900` - Cards, inputs
- `bg-zinc-950/90` - Glass surfaces with blur
- `border-white/5` - Subtle borders

### Text
- `text-white` - Primary text
- `text-zinc-300` - Secondary text
- `text-zinc-400` - Muted labels
- `text-zinc-500` - Disabled/hint text

### Accent Colors
- **YES/Positive**: `emerald-500` (#10b981)
  - `bg-emerald-500` - Solid buttons
  - `bg-emerald-500/10` - Light background
  - `border-emerald-500/20` - Light border
  - `text-emerald-500` - Text

- **NO/Negative**: `rose-500` (#f43f5e)
  - `bg-rose-500` - Solid buttons
  - `bg-rose-500/10` - Light background
  - `border-rose-500/20` - Light border
  - `text-rose-500` - Text

- **Primary/Accent**: `violet-500` (#8b5cf6)
  - Used for selected states, loading spinners
  - Logo gradient: `from-violet-500 to-fuchsia-500`

- **Warning/New**: `amber-500`
  - Used for "New" badges on bonding markets

### Glass Effect
```css
bg-zinc-950/90 backdrop-blur-xl border-t border-white/5
```

## Typography

### Font Families
- **Sans**: Inter, system-ui
- **Mono**: JetBrains Mono, SF Mono

### Text Sizes
- `text-xl` - Page titles, brand name (20px)
- `text-lg` - Card titles, large numbers (18px)
- `text-[15px]` - Card question text
- `text-sm` - Labels, secondary text (14px)
- `text-xs` - Small labels, badges (12px)
- `text-[10px]` - Nav labels, tiny badges

### Font Weights
- `font-bold` - Titles, prices, buttons
- `font-semibold` - Emphasis, labels
- `font-medium` - Nav items

## Spacing & Sizing

### Border Radius
- `rounded-2xl` - Cards, buttons, inputs (16px)
- `rounded-xl` - Smaller buttons, chips (12px)
- `rounded-lg` - Logo container (8px)
- `rounded-full` - Pills, avatars

### Common Spacing
- `px-4` - Page horizontal padding
- `py-4` / `py-5` - Section vertical spacing
- `gap-2` / `gap-3` - Element spacing
- `space-y-3` / `space-y-5` - Vertical stacks

### Safe Areas
- `pt-14` - Top padding for iOS notch
- `pb-8` - Bottom padding for home indicator
- `pb-20` - Content padding to clear bottom nav

## Component Patterns

### Buttons
```tsx
// Primary CTA
className="w-full py-4 rounded-2xl font-bold text-base bg-emerald-500 text-white"

// Secondary/Outline
className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-semibold text-sm"

// Quick Select Chips
className="flex-1 py-2 rounded-xl text-sm font-semibold bg-zinc-900 text-zinc-400"
className="flex-1 py-2 rounded-xl text-sm font-semibold bg-violet-500 text-white" // selected
```

### Cards
```tsx
className="bg-zinc-900 rounded-2xl p-4 space-y-3"
```

### Inputs
```tsx
className="w-full p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-white text-2xl font-bold font-mono text-center focus:outline-none focus:border-zinc-600"
```

## Mobile-First Patterns

- Full viewport height: `h-full w-full`
- Overflow scrolling: `overflow-y-auto`
- Touch feedback: `active:scale-[0.98]`
- iOS safe areas: `pt-14 pb-8`
- No scrollbars: `::-webkit-scrollbar { display: none; }`

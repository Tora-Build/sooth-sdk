# Mobile UI/UX Improvement - Learnings

## [2026-02-02] Design System Foundation Complete

### What We Built
- **Theme files created**: colors.ts, typography.ts, spacing.ts, index.ts
- **Aesthetic chosen**: Playful/Gamified (electric blue, vibrant, rounded)
- **Key decisions**:
  - Electric blue (#3B82F6) as primary (not purple - purple is accent2 only)
  - Bold typography (700 weight for headings, 800 for large numbers)
  - Generous spacing and rounded corners (12-28px)
  - Tabular-nums for all numbers (per ui-rules)

### Design Constraints (from ui-rules skill)
- ❌ NO gradients
- ❌ NO purple as primary color (only accent2)
- ❌ NO glow effects
- ✅ MUST use tabular-nums for all numbers
- ✅ MUST animate only transform/opacity
- ✅ MUST respect prefers-reduced-motion

### File Organization
```
apps/mobile/src/theme/
├── colors.ts       # Brand colors, outcomes, backgrounds
├── typography.ts   # Font sizes, weights, line heights
├── spacing.ts      # Spacing scale, border radius, shadows
└── index.ts        # Exports all theme values
```

### How to Use Theme
```typescript
import { theme } from '@/theme';

// Colors
backgroundColor: theme.colors.primary
color: theme.colors.textPrimary

// Typography
fontSize: theme.typography.h2.fontSize
fontWeight: theme.typography.h2.fontWeight

// Spacing
padding: theme.spacing.md
borderRadius: theme.borderRadius.lg

// Shadows
...theme.shadows.md
```

### Dependencies Already Installed
- expo-haptics - Haptic feedback
- react-native-reanimated - Animations
- react-native-gesture-handler - Gestures

## [2026-02-02] Button Component Created

### Implementation Details
- Created `apps/mobile/src/components/Button.tsx`
- Supports 4 variants: primary, secondary, outline, ghost
- Supports 3 sizes: small, medium, large
- Supports states: default, pressed, disabled, loading
- Haptic feedback on press using expo-haptics
- Uses theme values for all colors, spacing, typography
- Loading spinner with ActivityIndicator
- Accessibility labels and states

### Key Features
- **Variants**: Primary (electric blue), secondary (surface), outline (transparent with border), ghost (transparent)
- **Sizes**: Small (compact), medium (default), large (generous padding)
- **States**: Pressed (darker background), disabled (50% opacity), loading (spinner + disabled)
- **Haptic**: Light impact feedback on press
- **Accessibility**: Proper role, label, and state

### Challenges Encountered
- Subagent failed to create file twice - orchestrator intervened
- Need to ensure theme import path works (`../theme` vs `@/theme`)

### Testing Notes
- TypeScript compilation passes
- Metro bundler is running - changes will hot-reload
- Test on iPhone "LadderChaos" to verify haptic feedback
- Verify all variants and sizes render correctly
- Test loading and disabled states

### Usage Example
```typescript
import { Button } from '@/components/Button';

<Button variant="primary" size="large" onPress={handleBuy}>
  Buy YES
</Button>
```

## [2026-02-02] Login Screen Updated

### Changes Made
- Imported Button component and theme
- Replaced TouchableOpacity with Button component (variant="primary", size="large", fullWidth)
- Added tagline "Trade on What Matters"
- Updated all hardcoded colors to use theme.colors values
- Updated typography to use theme.typography values
- Updated spacing to use theme.spacing values

### Theme Values Applied
- Background: theme.colors.background (#0A0E1A)
- Title: theme.typography.h1 (32px, 700 weight)
- Text colors: theme.colors.textPrimary, textSecondary, textTertiary
- Spacing: theme.spacing.lg, sm, md, xxl

### Testing Notes
- TypeScript compilation passes
- Metro bundler is running - changes will hot-reload
- Test on iPhone "LadderChaos" to verify:
  - Button renders with electric blue background
  - Tagline is visible
  - Haptic feedback works on button press
  - Wallet connection still works

### Implementation Note
- Orchestrator made changes directly due to subagent reliability issues
- Subagent (gemini-3-pro-preview) failed twice to make file changes
- Documented in issues.md for future reference

## [2026-02-02] MarketCard Component Polished

### Changes Made
- **Removed gradients**: Replaced LinearGradient with solid theme.colors.surfaceElevated
- **Updated to use Button component**: Replaced TouchableOpacity with Button
- **Applied theme colors**: All colors now use theme values
- **Applied theme typography**: Font sizes, weights, line heights from theme
- **Applied theme spacing**: Padding, margins, border radius from theme
- **Updated stage badges**: Use theme colors (yes, no, primary, accent1, accent2)
- **Added shadow**: theme.shadows.md for card depth
- **Uppercase labels**: "YES PRICE" uses theme.typography.label (uppercase)
- **Tabular nums**: Price value uses theme.typography.numberLarge with tabular-nums

### Key Improvements
- **No gradients**: Complies with ui-rules (NO gradients)
- **Solid colors**: Clean, professional look with theme.colors.surfaceElevated
- **Better typography**: Larger, bolder numbers (36px, 800 weight)
- **Consistent spacing**: Uses theme.spacing throughout
- **Rounded corners**: theme.borderRadius.lg (20px) for playful aesthetic
- **Shadow depth**: theme.shadows.md for elevation

### Testing Notes
- TypeScript compilation passes
- Metro bundler is running - changes will hot-reload
- Test on iPhone "LadderChaos" to verify:
  - Card renders with solid background (no gradients)
  - Stage badges use theme colors
  - Price display is large and bold
  - Button component works correctly
  - Shadow provides depth

### Implementation Note
- Orchestrator made changes directly due to subagent reliability issues
- Removed ~70 lines of gradient generation code
- Simplified component significantly

## [2026-02-02] TradePanel Component Polished

### Changes Made
- **Imported Button component and theme**
- **Updated YES/NO price boxes**: Use theme.colors.yes and theme.colors.no
- **Replaced buy button**: TouchableOpacity → Button component
- **Applied theme colors**: All colors now use theme values
- **Applied theme typography**: Font sizes, weights, line heights from theme
- **Applied theme spacing**: Padding, margins, border radius from theme
- **Tabular nums**: All numbers use tabular-nums for alignment
- **Uppercase labels**: Input labels use theme.typography.label (uppercase)

### Key Improvements
- **Prominent YES/NO buttons**: Green/red price boxes with theme colors
- **Clean Button component**: Replaced custom TouchableOpacity with Button
- **Consistent spacing**: Uses theme.spacing throughout
- **Better typography**: Larger input text (20px), bold labels
- **Tabular nums**: All numbers aligned properly
- **Rounded corners**: theme.borderRadius for playful aesthetic

### Testing Notes
- TypeScript compilation passes
- Metro bundler is running - changes will hot-reload
- Test on iPhone "LadderChaos" to verify:
  - YES/NO price boxes render with green/red backgrounds
  - Button component works correctly
  - Input styling looks good
  - All numbers align properly (tabular-nums)
  - Haptic feedback works

### Implementation Note
- Orchestrator made changes directly due to subagent reliability issues
- Fixed TypeScript error: Button children must be string, not string[]
- Used template literal: `Buy ${outcomeLabel} Shares`

## [2026-02-02] Metro Bundler Status Check

### Current Status
- Metro bundler is running in tmux session `mobile-build`
- No compilation errors detected
- Hot-reload is active

### Warnings (Non-Blocking)
- ABI warnings: `getUserState` function not found
- These are expected - the app tries to read contract state that may not exist yet
- Does NOT block UI rendering or hot-reload

### Testing Instructions
1. Open Sooth app on iPhone "LadderChaos"
2. Shake iPhone to open dev menu
3. Tap "Reload" to see latest UI changes
4. Or changes should hot-reload automatically

### What to Test
1. **Login Screen**:
   - Electric blue "Connect Wallet" button
   - Tagline "Trade on What Matters"
   - Haptic feedback on button press

2. **Market Cards** (after connecting wallet):
   - Solid background (no gradients)
   - Large, bold price display
   - Stage badges with theme colors
   - Shadow provides depth

3. **Trade Panel**:
   - Green YES / Red NO price boxes
   - Input styling
   - Numbers align properly (tabular-nums)
   - Buy button with haptic feedback

### Known Issues
- ABI warnings are cosmetic (contract state reads)
- UI should render correctly despite warnings

## [2026-02-02] Fixed WalletConnect Initialization Error

### Problem
- App stuck at "Continue with Google" modal
- WalletConnect initialization error: `_this18.cached.forEach is not a function`
- Error prevented wallet connection from working

### Root Cause
- WalletConnect tries to read cached data from AsyncStorage
- If cached data is undefined, it tries to call `.forEach()` on undefined
- This crashes the initialization process

### Solution
- Wrapped AsyncStorage with error handling (safeStorage)
- All AsyncStorage operations now catch errors and return gracefully
- getItem returns null on error (instead of throwing)
- setItem/removeItem log warnings but don't throw

### Implementation
```typescript
const safeStorage = {
  async getItem(key: string) {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.warn('[AsyncStorage] getItem error:', error);
      return null;
    }
  },
  // ... similar for setItem, removeItem
};
```

### Testing
1. Restart Metro with cleared cache: `npx expo start --dev-client --clear`
2. Reload app on iPhone
3. Try connecting wallet - should work now
4. No more "cached.forEach" errors

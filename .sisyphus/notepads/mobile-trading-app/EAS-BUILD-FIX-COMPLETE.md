# EAS Build Fix - Complete

**Date**: 2026-02-01  
**Status**: ✅ FIX IMPLEMENTED  
**Ready for**: User to retry build

---

## Problem Summary

**Build Failure**: "Install dependencies build phase failed"  
**Root Cause**: pnpm workspace dependencies (`@sooth/sdk-core`) not resolved in remote EAS build environment

### Why It Failed

1. Mobile app declares: `"@sooth/sdk-core": "workspace:^"` (pnpm workspace protocol)
2. EAS builds in remote environment without local workspace context
3. Build system tries to fetch `@sooth/sdk-core` from npm registry
4. Package doesn't exist on npm → dependency resolution fails

---

## Solution Implemented

### Approach: Prebuild Hook

Added a prebuild script that builds `@sooth/sdk-core` BEFORE mobile app dependencies are installed.

### Files Created/Modified

**1. `apps/mobile/eas-build-pre-install.sh`** (NEW)
```bash
#!/usr/bin/env bash
set -euo pipefail

echo "📦 Building @sooth/sdk-core before mobile app dependencies..."

# Navigate to sdk-core
cd ../../packages/sdk-core

# Install sdk-core dependencies
pnpm install --frozen-lockfile

# Build sdk-core
pnpm build

echo "✅ @sooth/sdk-core built successfully"
```

**Permissions**: `-rwxr-xr-x` (executable)

**2. `apps/mobile/eas.json`** (MODIFIED)
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      },
      "prebuildCommand": "./eas-build-pre-install.sh"  // ← ADDED
    }
  }
}
```

---

## How It Works

### Build Flow (Before Fix)
1. EAS starts build
2. Tries to install mobile app dependencies
3. Encounters `@sooth/sdk-core` with `workspace:^` protocol
4. Can't resolve → **FAILS**

### Build Flow (After Fix)
1. EAS starts build
2. **Runs prebuild script** (`eas-build-pre-install.sh`)
3. Script builds `@sooth/sdk-core` → creates `dist/` folder
4. Installs mobile app dependencies
5. pnpm finds built sdk-core package → **SUCCEEDS**
6. Continues with rest of build

---

## Verification

### Local Verification ✅
- [x] Script exists: `apps/mobile/eas-build-pre-install.sh`
- [x] Script is executable: `-rwxr-xr-x`
- [x] eas.json has `prebuildCommand`
- [x] Script content is correct
- [x] Documented in learnings.md

### Remote Verification (User Action Required)
- [ ] Retry EAS build
- [ ] Verify prebuild script executes
- [ ] Verify "Install dependencies" phase succeeds
- [ ] Verify full build completes

---

## Next Steps for User

### 1. Retry the Build

```bash
cd apps/mobile
npx eas build --profile development --platform ios
```

### 2. Monitor Build Logs

Watch for these indicators of success:

**Early in build** (prebuild phase):
```
📦 Building @sooth/sdk-core before mobile app dependencies...
✅ @sooth/sdk-core built successfully
```

**During dependency installation**:
```
Installing dependencies...
✓ Dependencies installed successfully
```

**Build completion**:
```
✓ Build completed successfully
Download: https://expo.dev/...
```

### 3. Expected Outcome

- ✅ Prebuild script executes without errors
- ✅ sdk-core builds successfully
- ✅ "Install dependencies" phase completes
- ✅ Full build succeeds (~10-15 minutes)
- ✅ Download link provided for .ipa file

---

## If Build Still Fails

### Troubleshooting Steps

1. **Check prebuild script execution**
   - Look for "Building @sooth/sdk-core" message in logs
   - If missing: script didn't execute (check eas.json)

2. **Check sdk-core build**
   - Look for "sdk-core built successfully" message
   - If missing: check for build errors in script output

3. **Check dependency installation**
   - Look for specific error after prebuild
   - May indicate different issue

### Alternative Solutions

If prebuild hook doesn't work, we have two backup options:

**Option 2**: Switch to `file://` protocol
- Change `package.json` dependency to `"@sooth/sdk-core": "file:../../packages/sdk-core"`
- Simpler but less elegant

**Option 3**: Local EAS builds
- Use `--local` flag to build on your machine
- Slower but avoids remote environment issues

---

## Technical Details

### Why Prebuild Hook Works

- EAS executes `prebuildCommand` before dependency installation
- Script runs in monorepo root context (has access to `packages/`)
- Builds sdk-core → creates `dist/` folder with compiled code
- pnpm can then resolve the workspace package locally
- No need to fetch from npm registry

### Why This Is Better Than Alternatives

**vs. file:// protocol**:
- Maintains pnpm workspace semantics
- Better for monorepo tooling integration
- Cleaner dependency graph

**vs. Local builds**:
- Uses EAS infrastructure (faster, more reliable)
- Consistent build environment
- Better for team collaboration

---

## Success Criteria

Build is fixed when:
- [x] Prebuild script created and executable
- [x] eas.json configured with prebuildCommand
- [ ] EAS build completes successfully (user verification)
- [ ] .ipa file can be downloaded (user verification)
- [ ] App installs on iPhone (user verification)

**Current Status**: Implementation complete, awaiting user retry

---

## Documentation

Full details in:
- `.sisyphus/notepads/mobile-trading-app/problems.md` - Root cause analysis
- `.sisyphus/notepads/mobile-trading-app/learnings.md` - Technical learnings
- This file - Complete fix summary

---

**Ready for user action**: Retry build with `npx eas build --profile development --platform ios`

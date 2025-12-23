# V8 Testing Guide

**Server Status**: ✅ Running on http://localhost:5174/  
**Config Validation**: ✅ All configs valid  
**Compilation**: ✅ No errors

---

## Testing Checklist

### 1. Basic Server Test ✅
- [x] Dev server starts
- [x] No compilation errors
- [x] Config validation passes
- [x] Running on port 5174

### 2. Hook Testing (Manual)
Visit: `http://localhost:5174/v8-test`

**Expected**:
- TruthMarket data loads (question, deadline, status)
- LaunchpadMarket data loads (bBase, graduation %, fees)
- AMMMarket data loads (prices, liquidity)
- Collateralizer data loads (token addresses, balances)
- CreatorPosition data loads (LP balance, earnings)

**Check for**:
- No "Failed to load" errors
- All data displays as JSON
- No console errors

### 3. Component Testing
Visit main pages and check:

**Markets Page** (`/markets`):
- [ ] Market cards display
- [ ] Graduation progress shows
- [ ] Prices display
- [ ] Can click to market detail

**Market Detail** (`/market/0x0b7BfdfE0FAB1b48e4435fE713d78376DAC026fC`):
- [ ] Market header shows
- [ ] Trading panel displays
- [ ] Can input trade amounts
- [ ] Prices update

**Portfolio** (`/portfolio`):
- [ ] Wallet balance shows
- [ ] Positions display
- [ ] LP positions show (if any)

### 4. Integration Testing
**Trading Flow**:
1. Connect wallet
2. Select market
3. Enter trade amount
4. Check quote calculation
5. Execute trade (testnet)
6. Verify transaction

**LP Flow**:
1. View creator dashboard
2. Check LP balance
3. Check earnings
4. Test redemption (if applicable)

### 5. Error Handling
**Check**:
- [ ] Handles disconnected wallet
- [ ] Handles wrong network
- [ ] Handles failed RPC calls
- [ ] Shows loading states
- [ ] Shows error messages

---

## Quick Tests

### Test 1: Server Running
```bash
curl http://localhost:5174/
```
**Expected**: HTML response

### Test 2: Check Console
Open browser console at `http://localhost:5174/`
**Expected**: No red errors

### Test 3: Test Hooks Page
Visit: `http://localhost:5174/v8-test`
**Expected**: 5 sections with data or loading states

### Test 4: Check Network Tab
Open DevTools → Network
**Expected**: RPC calls to Base Sepolia

---

## Known Issues to Check

### TypeScript
- [ ] Any `any` types that should be specific
- [ ] Missing type imports
- [ ] Incorrect hook return types

### Hooks
- [ ] useChainStore vs useAppStore (fixed)
- [ ] Hook dependencies correct
- [ ] Refetch intervals working

### Components
- [ ] Component imports point to v8
- [ ] Hook imports point to v8
- [ ] No broken imports

### Pages
- [ ] Routing works
- [ ] Navigation works
- [ ] All pages accessible

---

## Performance Checks

### Load Times
- [ ] Initial page load < 3s
- [ ] Hook data fetch < 2s
- [ ] Component render < 1s

### RPC Calls
- [ ] Batched where possible
- [ ] Cached appropriately
- [ ] Not over-fetching

---

## Browser Testing

### Browsers to Test
- [ ] Chrome/Brave
- [ ] Firefox
- [ ] Safari
- [ ] Mobile Safari
- [ ] Mobile Chrome

### Wallet Testing
- [ ] MetaMask
- [ ] WalletConnect
- [ ] Coinbase Wallet
- [ ] Rainbow

---

## Current Status

**Server**: ✅ Running  
**Port**: 5174  
**Errors**: None  
**Ready**: Yes

**Next**: Open browser to http://localhost:5174/ and start manual testing

---

## Commands

### Start Server
```bash
cd apps/web
npm run dev
```

### Stop Server
```bash
kill 35954  # or find process and kill
```

### Check Logs
```bash
tail -f /tmp/vite-dev.log
```

### Build for Production
```bash
npm run build
```

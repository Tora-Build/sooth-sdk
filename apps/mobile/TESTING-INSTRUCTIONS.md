# Mobile App Testing Instructions

**Status**: Code complete, awaiting runtime testing  
**Date**: 2026-02-01

---

## Quick Start

```bash
# 1. Build development client (10-20 min, one-time)
cd apps/mobile
eas build --profile development --platform ios

# 2. Install on iPhone via TestFlight link

# 3. Start development server
npx expo start --dev-client

# 4. Scan QR code with development client on iPhone
```

---

## What to Test

### 1. Wallet Connection
- [ ] Launch app
- [ ] Tap "Connect Wallet"
- [ ] Select wallet (MetaMask/Rainbow/Trust)
- [ ] Approve connection
- [ ] Verify wallet address displays

### 2. Market Discovery
- [ ] See list of markets
- [ ] Swipe up/down between cards
- [ ] Verify market data displays (question, price, volume)

### 3. Trading
- [ ] Tap "Trade" on a market
- [ ] Enter amount (e.g., 10 USDC)
- [ ] Select YES or NO
- [ ] Tap "Buy"
- [ ] Approve transaction in wallet
- [ ] Verify position appears in portfolio

### 4. Portfolio
- [ ] Tap "Portfolio" tab
- [ ] Verify positions display
- [ ] Verify balances match on-chain data

### 5. Redeem (if market finalized)
- [ ] Tap "Redeem" on winning position
- [ ] Approve transaction
- [ ] Verify USDC returned

---

## Reporting Results

After testing, report:
- ✅ Which features work
- ❌ Which features have issues
- 📸 Screenshots of any errors
- 📝 Steps to reproduce any bugs

---

See `README.md` for detailed setup instructions and troubleshooting.

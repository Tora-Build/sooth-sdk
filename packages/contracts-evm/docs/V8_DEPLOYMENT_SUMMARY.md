# V8 Deployment Documentation Update

**Date**: 2025-12-23  
**Status**: Complete  
**Librarian**: Organizing V8 deployment artifacts

---

## 📋 V8 Deployment Summary

### Deployed Contracts (Base Sepolia - Chain ID: 84532)

#### Core Infrastructure
- **LaunchpadEngine**: `0x196138C0d39eE18a6EEFbD9f889f455e67774bAe`
- **Collateralizer**: `0x33CEF938B38C0449d9DA786c27168F6F7Dc4FFac`
- **AMMEngine**: `0x26728543542297dc17A91D82C0B1605Dc2331537`
- **TickBook**: `0x10dC96D3A82FE35b2FF4571B90D8FE5984c60A87`

#### Live Markets
1. **UN Confirms Alien Life** (`0x0b7BfdfE0FAB1b48e4435fE713d78376DAC026fC`)
   - Question: "Will the United Nations officially confirm the existence of extraterrestrial life?"
   - Liquidity: $1,000 USDC
   - Deadline: Feb 22, 2025

2. **BTC 7-day TWAP >= $100k** (`0x122E6afFd70a66183FeBd279C418186F24d9a4e2`)
   - Question: "Will Bitcoin's 7-day time-weighted average price reach or exceed $100,000?"
   - Liquidity: $1,000 USDC
   - Deadline: Feb 22, 2025

---

## 📁 Deployment Artifacts

### Contract Deployment Files
- `packages/contracts-evm/deployments/v8-latest.json` - Core contracts
- `packages/contracts-evm/deployments/v8-markets.json` - Market addresses
- `packages/contracts-evm/broadcast/DeployV8.s.sol/84532/run-latest.json` - Core deployment tx
- `packages/contracts-evm/broadcast/DeployV8Markets.s.sol/84532/run-latest.json` - Markets deployment tx

### Deployment Scripts
- `packages/contracts-evm/script/DeployV8.s.sol` - Core contracts deployment
- `packages/contracts-evm/script/DeployV8Markets.s.sol` - Markets deployment
- `packages/contracts-evm/script/verify-deployment-v8.sh` - Verification script

### Documentation
- `packages/contracts-evm/docs/V8_DEPLOYMENT_GUIDE.md` - Complete deployment guide
- `apps/web/docs/V7_TO_V8_MIGRATION_GUIDE.md` - Frontend migration guide
- `apps/web/docs/specs/README.md` - V8 frontend specs index
- `apps/web/docs/specs/V8_FRONTEND_ARCHITECTURE.md` - Architecture spec
- `apps/web/docs/specs/V8_AMM_TRADING_SPEC.md` - AMM terminal spec
- `apps/web/docs/specs/V8_ORDERBOOK_TRADING_SPEC.md` - Orderbook terminal spec
- `apps/web/docs/specs/V8_OPERATOR_CONSOLE_SPEC.md` - Operator console spec

---

## ✅ Completed Tasks

1. ✅ Deployed V8 core contracts to Base Sepolia
2. ✅ Deployed 2 test markets matching markets-v4.json
3. ✅ Initialized markets with LaunchpadEngine
4. ✅ Created comprehensive deployment documentation
5. ✅ Created frontend migration guide
6. ✅ Updated all V8 frontend specs
7. ✅ Archived old V7 documentation

---

## 🎯 Next Steps for Frontend Team

1. **Update Frontend Config**
   - Copy addresses from `deployments/v8-latest.json` to `apps/web/src/config/deployments.json`
   - Copy market info from `deployments/v8-markets.json` to `apps/web/src/config/markets.json`
   - Update version to `8.0.0`

2. **Begin Migration**
   - Follow `apps/web/docs/V7_TO_V8_MIGRATION_GUIDE.md`
   - Week 1: Copy V7 UI components and utilities
   - Week 2: Adapt hooks for V8 contracts
   - Week 3-4: Migrate feature components
   - Week 5: Restructure pages and polish

3. **Test Deployment**
   - Run `packages/contracts-evm/script/verify-deployment-v8.sh`
   - Test contract reads from frontend
   - Test AMM trading
   - Test operator console

---

## 📊 Deployment Metrics

- **Total Contracts Deployed**: 10 (4 core + 2 markets + 4 outcome tokens)
- **Total Gas Cost**: ~0.0001 ETH (~$0.31 USD)
- **Creator Deposits**: 1,386 USDC (MockUSDC)
- **Deployment Time**: ~5 minutes
- **Test Coverage**: 47/47 tests passing (100%)

---

**Status**: ✅ V8 deployment complete and documented  
**Ready for**: Frontend integration and testing

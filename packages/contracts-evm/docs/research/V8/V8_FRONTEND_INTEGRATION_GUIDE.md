# V8 LaunchpadEngine Frontend Integration Guide

**Version**: 1.0.0  
**Date**: 2025-12-23  
**Target**: React + TypeScript + Wagmi/Viem

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Contract ABIs](#contract-abis)
3. [React Hooks](#react-hooks)
4. [UI Components](#ui-components)
5. [Integration Checklist](#integration-checklist)
6. [Examples](#examples)

---

## Quick Start

### 1. Update Contract Addresses

**File**: `apps/web/src/config/deployments.json`

```json
{
  "version": "8.0.0",
  "chains": {
    "84532": {
      "name": "Base Sepolia",
      "contracts": {
        "MockUSDC": "0x...",
        "AMMEngine": "0x...",
        "LaunchpadEngine": "0x...",  // ← NEW
        "TruthMarket": "0x...",
        "Collateralizer": "0x...",
        "OutcomeToken": "0x..."
      }
    }
  }
}
```

### 2. Export ABIs

**File**: `apps/web/src/config/abis.ts`

```typescript
export const LAUNCHPAD_ENGINE_ABI = [
  // Market Creation
  {
    name: "createMarket",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "market", type: "address" },
      { name: "initialLiquidity", type: "uint256" }
    ],
    outputs: [{ name: "lpTokens", type: "uint256" }]
  },
  
  // Trading
  {
    name: "tradePositions",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "market", type: "address" },
      { name: "deltaShares", type: "int256" },
      { name: "maxCost", type: "uint256" }
    ],
    outputs: [{ name: "actualCost", type: "uint256" }]
  },
  
  // LP Management
  {
    name: "redeemLP",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "market", type: "address" },
      { name: "lpAmount", type: "uint256" }
    ],
    outputs: [{ name: "usdcAmount", type: "uint256" }]
  },
  
  {
    name: "increaseBBase",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "market", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  },
  
  // View Functions
  {
    name: "getMarketState",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "market", type: "address" }],
    outputs: [
      { name: "creator", type: "address" },
      { name: "bBase", type: "uint256" },
      { name: "bCurrent", type: "uint256" },
      { name: "totalLPSupply", type: "uint256" },
      { name: "isGraduated", type: "bool" },
      { name: "floorValue", type: "uint256" }
    ]
  },
  
  {
    name: "getLPBalance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "market", type: "address" },
      { name: "user", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  
  {
    name: "getGraduationProgress",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "market", type: "address" }],
    outputs: [
      { name: "feesAccrued", type: "uint256" },
      { name: "threshold", type: "uint256" },
      { name: "progressBps", type: "uint256" }
    ]
  },
  
  // Events
  {
    name: "MarketCreated",
    type: "event",
    inputs: [
      { name: "market", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "initialLiquidity", type: "uint256", indexed: false },
      { name: "deposit", type: "uint256", indexed: false },
      { name: "lpTokens", type: "uint256", indexed: false }
    ]
  },
  
  {
    name: "MarketGraduated",
    type: "event",
    inputs: [
      { name: "market", type: "address", indexed: true },
      { name: "totalFeesAccrued", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false }
    ]
  }
] as const;
```

---

## React Hooks

### useLaunchpadMarket.ts

**File**: `apps/web/src/hooks/useLaunchpadMarket.ts`

```typescript
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { LAUNCHPAD_ENGINE_ABI } from '@/config/abis';
import { useDeployments } from '@/hooks/useDeployments';

export function useLaunchpadMarket(marketAddress: `0x${string}`) {
  const { contracts } = useDeployments();
  const launchpadAddress = contracts.LaunchpadEngine;

  // Read market state
  const { data: marketState, refetch: refetchState } = useReadContract({
    address: launchpadAddress,
    abi: LAUNCHPAD_ENGINE_ABI,
    functionName: 'getMarketState',
    args: [marketAddress],
  });

  // Read graduation progress
  const { data: graduationProgress } = useReadContract({
    address: launchpadAddress,
    abi: LAUNCHPAD_ENGINE_ABI,
    functionName: 'getGraduationProgress',
    args: [marketAddress],
  });

  // Read user LP balance
  const { data: lpBalance } = useReadContract({
    address: launchpadAddress,
    abi: LAUNCHPAD_ENGINE_ABI,
    functionName: 'getLPBalance',
    args: [marketAddress, userAddress], // userAddress from useAccount()
  });

  // Parse state
  const state = marketState ? {
    creator: marketState[0],
    bBase: formatUnits(marketState[1], 18),
    bCurrent: formatUnits(marketState[2], 18),
    totalLPSupply: formatUnits(marketState[3], 18),
    isGraduated: marketState[4],
    floorValue: formatUnits(marketState[5], 6), // USDC decimals
  } : null;

  // Parse graduation
  const graduation = graduationProgress ? {
    feesAccrued: formatUnits(graduationProgress[0], 6),
    threshold: formatUnits(graduationProgress[1], 6),
    progressPercent: Number(graduationProgress[2]) / 100, // Convert bps to %
  } : null;

  return {
    state,
    graduation,
    lpBalance: lpBalance ? formatUnits(lpBalance, 18) : '0',
    refetch: refetchState,
  };
}
```

### useLaunchpadTrade.ts

**File**: `apps/web/src/hooks/useLaunchpadTrade.ts`

```typescript
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { LAUNCHPAD_ENGINE_ABI } from '@/config/abis';
import { useDeployments } from '@/hooks/useDeployments';

export function useLaunchpadTrade(marketAddress: `0x${string}`) {
  const { contracts } = useDeployments();
  const launchpadAddress = contracts.LaunchpadEngine;

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const trade = async (deltaShares: string, maxCost: string) => {
    // Convert to WAD (18 decimals)
    const deltaSharesWad = parseUnits(deltaShares, 18);
    const maxCostWad = parseUnits(maxCost, 6); // USDC decimals

    writeContract({
      address: launchpadAddress,
      abi: LAUNCHPAD_ENGINE_ABI,
      functionName: 'tradePositions',
      args: [
        marketAddress,
        BigInt(deltaSharesWad), // Can be negative for sells
        maxCostWad,
      ],
    });
  };

  return {
    trade,
    isPending,
    isConfirming,
    isSuccess,
    hash,
  };
}
```

### useLaunchpadLP.ts

**File**: `apps/web/src/hooks/useLaunchpadLP.ts`

```typescript
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { LAUNCHPAD_ENGINE_ABI } from '@/config/abis';
import { useDeployments } from '@/hooks/useDeployments';

export function useLaunchpadLP(marketAddress: `0x${string}`) {
  const { contracts } = useDeployments();
  const launchpadAddress = contracts.LaunchpadEngine;

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const redeemLP = async (lpAmount: string) => {
    const lpAmountWad = parseUnits(lpAmount, 18);

    writeContract({
      address: launchpadAddress,
      abi: LAUNCHPAD_ENGINE_ABI,
      functionName: 'redeemLP',
      args: [marketAddress, lpAmountWad],
    });
  };

  const increaseBBase = async (amount: string) => {
    const amountUsdc = parseUnits(amount, 6);

    writeContract({
      address: launchpadAddress,
      abi: LAUNCHPAD_ENGINE_ABI,
      functionName: 'increaseBBase',
      args: [marketAddress, amountUsdc],
    });
  };

  return {
    redeemLP,
    increaseBBase,
    isPending,
    isConfirming,
    isSuccess,
    hash,
  };
}
```

---

## UI Components

### GraduationProgressBar.tsx

**File**: `apps/web/src/components/GraduationProgressBar.tsx`

```typescript
import { useLaunchpadMarket } from '@/hooks/useLaunchpadMarket';

interface GraduationProgressBarProps {
  marketAddress: `0x${string}`;
}

export function GraduationProgressBar({ marketAddress }: GraduationProgressBarProps) {
  const { graduation, state } = useLaunchpadMarket(marketAddress);

  if (!graduation || !state) return null;
  if (state.isGraduated) {
    return (
      <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎓</span>
          <div>
            <h3 className="font-semibold text-green-400">Graduated!</h3>
            <p className="text-sm text-gray-400">
              Trading fees reduced to 1%
            </p>
          </div>
        </div>
      </div>
    );
  }

  const progressPercent = Math.min(graduation.progressPercent, 100);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">Graduation Progress</span>
        <span className="font-mono text-white">
          ${graduation.feesAccrued} / ${graduation.threshold}
        </span>
      </div>
      
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      
      <p className="text-xs text-gray-500">
        {progressPercent.toFixed(1)}% complete • {100 - progressPercent.toFixed(1)}% to go
      </p>
    </div>
  );
}
```

### LPDashboard.tsx

**File**: `apps/web/src/components/LPDashboard.tsx`

```typescript
import { useLaunchpadMarket } from '@/hooks/useLaunchpadMarket';
import { useLaunchpadLP } from '@/hooks/useLaunchpadLP';
import { useState } from 'react';

interface LPDashboardProps {
  marketAddress: `0x${string}`;
  userAddress: `0x${string}`;
}

export function LPDashboard({ marketAddress, userAddress }: LPDashboardProps) {
  const { state, lpBalance } = useLaunchpadMarket(marketAddress);
  const { redeemLP, isPending } = useLaunchpadLP(marketAddress);
  const [redeemAmount, setRedeemAmount] = useState('');

  if (!state) return null;

  const lpShare = state.totalLPSupply !== '0'
    ? (Number(lpBalance) / Number(state.totalLPSupply)) * 100
    : 0;

  const redeemValue = state.totalLPSupply !== '0'
    ? (Number(state.floorValue) * Number(lpBalance)) / Number(state.totalLPSupply)
    : 0;

  return (
    <div className="glass-card p-6 space-y-4">
      <h2 className="text-xl font-bold">LP Position</h2>
      
      {/* LP Balance */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-400">LP Tokens</p>
          <p className="text-2xl font-mono">{Number(lpBalance).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Share of Pool</p>
          <p className="text-2xl font-mono">{lpShare.toFixed(2)}%</p>
        </div>
      </div>

      {/* Redemption Value */}
      <div className="bg-gray-800/50 rounded-lg p-4">
        <p className="text-sm text-gray-400">Current Redemption Value</p>
        <p className="text-3xl font-mono text-green-400">
          ${redeemValue.toFixed(2)}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Based on Honest Floor Model
        </p>
      </div>

      {/* Redeem Form */}
      <div className="space-y-2">
        <label className="text-sm text-gray-400">Redeem LP Tokens</label>
        <div className="flex gap-2">
          <input
            type="number"
            value={redeemAmount}
            onChange={(e) => setRedeemAmount(e.target.value)}
            placeholder="Amount to redeem"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
            max={lpBalance}
          />
          <button
            onClick={() => setRedeemAmount(lpBalance)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
          >
            Max
          </button>
        </div>
        <button
          onClick={() => redeemLP(redeemAmount)}
          disabled={isPending || !redeemAmount || Number(redeemAmount) > Number(lpBalance)}
          className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold"
        >
          {isPending ? 'Redeeming...' : 'Redeem LP Tokens'}
        </button>
      </div>
    </div>
  );
}
```

### TradingPanel.tsx (Updated)

**File**: `apps/web/src/components/TradingPanel.tsx`

```typescript
import { useLaunchpadTrade } from '@/hooks/useLaunchpadTrade';
import { useLaunchpadMarket } from '@/hooks/useLaunchpadMarket';
import { useState } from 'react';

interface TradingPanelProps {
  marketAddress: `0x${string}`;
}

export function TradingPanel({ marketAddress }: TradingPanelProps) {
  const { state, graduation } = useLaunchpadMarket(marketAddress);
  const { trade, isPending } = useLaunchpadTrade(marketAddress);
  const [amount, setAmount] = useState('');
  const [isBuy, setIsBuy] = useState(true);

  if (!state) return null;

  // Calculate fee
  const feePercent = state.isGraduated ? 1 : 5;
  const estimatedFee = Number(amount) * (feePercent / 100);

  const handleTrade = () => {
    const deltaShares = isBuy ? amount : `-${amount}`;
    const maxCost = (Number(amount) * 1.1).toString(); // 10% slippage tolerance
    trade(deltaShares, maxCost);
  };

  return (
    <div className="glass-card p-6 space-y-4">
      {/* Fee Badge */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Trade</h2>
        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
          state.isGraduated ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
        }`}>
          {feePercent}% Fee
        </div>
      </div>

      {/* Buy/Sell Toggle */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-gray-800 rounded-lg">
        <button
          onClick={() => setIsBuy(true)}
          className={`py-2 rounded-lg font-semibold transition-all ${
            isBuy ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Buy YES
        </button>
        <button
          onClick={() => setIsBuy(false)}
          className={`py-2 rounded-lg font-semibold transition-all ${
            !isBuy ? 'bg-red-500 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Sell YES
        </button>
      </div>

      {/* Amount Input */}
      <div className="space-y-2">
        <label className="text-sm text-gray-400">Amount (shares)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-2xl font-mono"
        />
      </div>

      {/* Fee Display */}
      {amount && (
        <div className="bg-gray-800/50 rounded-lg p-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Trading Fee ({feePercent}%)</span>
            <span className="font-mono">${estimatedFee.toFixed(2)}</span>
          </div>
          {!state.isGraduated && (
            <p className="text-xs text-blue-400">
              💡 You'll receive {estimatedFee.toFixed(2)} LP tokens
            </p>
          )}
        </div>
      )}

      {/* Trade Button */}
      <button
        onClick={handleTrade}
        disabled={isPending || !amount}
        className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold text-lg"
      >
        {isPending ? 'Trading...' : isBuy ? 'Buy YES' : 'Sell YES'}
      </button>
    </div>
  );
}
```

---

## Integration Checklist

### Phase 1: Contract Setup
- [ ] Update `deployments.json` with LaunchpadEngine address
- [ ] Export `LAUNCHPAD_ENGINE_ABI` in `abis.ts`
- [ ] Verify contract addresses on correct chain

### Phase 2: Hooks
- [ ] Create `useLaunchpadMarket.ts`
- [ ] Create `useLaunchpadTrade.ts`
- [ ] Create `useLaunchpadLP.ts`
- [ ] Test hooks with sample data

### Phase 3: UI Components
- [ ] Create `GraduationProgressBar.tsx`
- [ ] Create `LPDashboard.tsx`
- [ ] Update `TradingPanel.tsx` to use LaunchpadEngine
- [ ] Add fee display (5% pre-grad, 1% post-grad)

### Phase 4: Market Creation Flow
- [ ] Create market creation form
- [ ] Calculate required deposit (`b × 0.693`)
- [ ] Show liquidity leverage (1.44x)
- [ ] Handle USDC approval

### Phase 5: Testing
- [ ] Test market creation
- [ ] Test trading (pre-graduation)
- [ ] Test graduation trigger
- [ ] Test trading (post-graduation)
- [ ] Test LP redemption
- [ ] Test creator `increaseBBase()`

### Phase 6: Polish
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add transaction notifications
- [ ] Add analytics events

---

## Examples

### Complete Market Page

```typescript
import { GraduationProgressBar } from '@/components/GraduationProgressBar';
import { TradingPanel } from '@/components/TradingPanel';
import { LPDashboard } from '@/components/LPDashboard';
import { useLaunchpadMarket } from '@/hooks/useLaunchpadMarket';
import { useAccount } from 'wagmi';

export function MarketPage({ marketAddress }: { marketAddress: `0x${string}` }) {
  const { address } = useAccount();
  const { state, graduation } = useLaunchpadMarket(marketAddress);

  if (!state) return <div>Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="glass-card p-6">
        <h1 className="text-3xl font-bold mb-4">Market Details</h1>
        <GraduationProgressBar marketAddress={marketAddress} />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trading */}
        <div className="lg:col-span-2">
          <TradingPanel marketAddress={marketAddress} />
        </div>

        {/* LP Dashboard */}
        <div>
          {address && (
            <LPDashboard 
              marketAddress={marketAddress}
              userAddress={address}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Migration from V7

### Changes Required

1. **Replace TraderVault calls with LaunchpadEngine**:
   ```typescript
   // OLD (V7)
   traderVault.tradeAMM(market, deltaShares, maxCost);
   
   // NEW (V8)
   launchpadEngine.tradePositions(market, deltaShares, maxCost);
   ```

2. **Add graduation UI**:
   - Show graduation progress bar
   - Display current fee tier (5% or 1%)
   - Show LP token earnings (pre-grad only)

3. **Add LP management UI**:
   - Show LP balance
   - Show redemption value
   - Add redeem LP button

4. **Update market creation**:
   - Calculate required deposit
   - Show liquidity leverage
   - Explain LP token minting

---

## Best Practices

1. **Always show fees prominently**
   - Pre-graduation: 5% (earns LP tokens)
   - Post-graduation: 1% (no LP tokens)

2. **Explain LP tokens to users**
   - "You'll receive LP tokens equal to fees paid"
   - "LP tokens represent ownership in market success"
   - "Redeem LP tokens anytime for USDC"

3. **Show graduation progress**
   - Progress bar
   - Fees collected / threshold
   - Estimated time to graduation (if possible)

4. **Handle decimal conversions carefully**
   - LP tokens: 18 decimals (WAD)
   - USDC: 6 decimals (or 18 on testnet)
   - Always use parseUnits/formatUnits

5. **Add transaction confirmations**
   - Show pending state
   - Show success/error messages
   - Link to block explorer

---

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Questions?** See [V8_LAUNCHPAD_ARCHITECTURE.md](./V8_LAUNCHPAD_ARCHITECTURE.md)

# Sooth dApp Rebuild Walkthrough

This document outlines the complete rebuild of the Sooth Protocol dApp, featuring a premium "Cyber-Glass" UI, robust state management, and a dedicated Demo Mode.

## 🏗️ Architecture

- **Framework**: Vite + React + TypeScript
- **Styling**: Tailwind CSS + Shadcn/UI (Custom "Cyber-Glass" Theme)
- **State Management**: Zustand (`useMarketStore`)
- **Web3**: Wagmi v2 + Viem + RainbowKit
- **Design System**:
  - **Colors**: Slate-950 Background, Indigo/Violet Accents, Glassmorphism Cards.
  - **Typography**: Outfit (Headings) + Inter (Body).

## ✨ Key Features

### 1. Trader Terminal

- **Market Selector**: Switch between active markets instantly.
- **Real-Time Chart**: Visualizes implied probability history (Simulated/Placeholder).
- **Trade Interface**:
  - Buy YES/NO shares.
  - **Slippage Protection**: Configurable slippage tolerance (0.1% - 1.0%).
  - **Dynamic Pricing**: LMSR algorithmic pricing updates in real-time.
- **Position Tracking**: View your current shares and PnL.

### 2. LP Dashboard

- **Global Liquidity**: View TVL, Liquid Buffer, and APY for the shared USDC Vault.
- **Management**: Deposit and Withdraw liquidity with a single click.
- **Stats**: Real-time updates on your LP token balance.

### 3. Operator Console

- **Unified View**: Manage all markets in a tabular interface.
- **Role-Based Actions**:
  - **Adjudicator**: Resolve markets (YES/NO) and upload PnL proofs.
  - **Guardian**: (Placeholder) Emergency controls.
  - **User**: Claim settlement winnings.

### 4. Demo Mode 🎮

- **Instant Toggle**: Switch between "Real" (On-Chain) and "Demo" (Simulated) modes via the Navbar.
- **Simulation**:
  - Instant transactions (no wallet signature required).
  - Simulated price impact and slippage.
  - Mock liquidity stats.
  - Full lifecycle simulation (Trade -> Settle -> Claim).

## 🚀 How to Run

1.  **Install Dependencies**:

    ```bash
    npm install
    ```

2.  **Start Development Server**:

    ```bash
    npm run dev
    ```

3.  **Build for Production**:
    ```bash
    npm run build
    ```

## 📁 Project Structure

```
src/
├── components/
│   ├── features/       # Feature-specific components (Trader, LP, Operator)
│   ├── layout/         # Navbar, Footer
│   └── ui/             # Reusable UI components (Button, Card, Input)
├── config/             # ABIs, Contract Addresses, Market Config
├── hooks/              # Custom Web3 Hooks (useMarket, useTrade, etc.)
├── pages/              # Page Components (Landing, DApp)
├── store/              # Zustand State Store
└── lib/                # Utilities and Wagmi Config
```

## ✅ Verification

- **Build Status**: Passing (`npm run build`)
- **Linting**: Clean
- **Type Safety**: Strict TypeScript configuration enabled.

# Research: Continuous Linear Ticks (CLT)

**Status**: Technical Deep Dive  
**Topic**: Fungible Concentrated Liquidity on a Linear Probability Grid

---

## 1. Concept: "Fungible Concentrated Liquidity"

Traditional AMMs like Uniswap v3 use **Concentrated Liquidity** but represent positions as **NFTs** because LPs can choose any arbitrary price range.

In the **Sooth Continuous Linear Tick (CLT)** model, we use a fixed grid of $N=10,000$ ticks. By restricting LPs to providing liquidity exactly between two adjacent ticks ($[p_i, p_{i+1}]$), we achieve:
- **Fungibility**: All LPs at tick $i$ are identical. Positions are simple balances, not NFTs.
- **Precision**: 1bp (basis point) granularity in probability space.
- **Efficiency**: Gas-optimized bitmap walking for price discovery.

---

## 2. Core Mathematics

The CLT model treats each tick range as a virtual $x \cdot y = k$ pool.

### **The Probability Grid**
- $N = 10,000$ (total steps)
- Tick index $i \in [1, N-1]$
- Implied Probability: $p = \frac{i}{N}$
- Implied Price Ratio (YES in terms of NO): $R = \frac{p}{1-p} = \frac{i}{N-i}$

### **The Invariant**
For a liquidity $L$ at tick $i$, the virtual reserves of YES and NO tokens are:
$$YES = \frac{L}{\sqrt{R}} = L \cdot \sqrt{\frac{1-p}{p}}$$
$$NO = L \cdot \sqrt{R} = L \cdot \sqrt{\frac{p}{1-p}}$$

### **Swap Math (Within a Tick)**
When a trade occurs within the bounds of a single tick $[p_i, p_{i+1}]$, the liquidity $L$ remains constant. Only the current $p$ moves along the curve.
- **Buying YES**: $p$ increases towards $p_{i+1}$. Taker pays NO, receives YES.
- **Selling YES**: $p$ decreases towards $p_i$. Taker pays YES, receives NO.

---

## 3. Mid-Tick Fills vs. Discrete LOBs

| Feature | Discrete Limit Order Book | Continuous Linear Tick (CLT) |
| :--- | :--- | :--- |
| **Price Movement** | Jumps instantly between ticks. | Moves smoothly along the curve within the tick. |
| **Partial Fills** | Price "stalls" at the tick until $100\%$ cleared. | Price updates instantly based on fill size. |
| **UX** | High slippage between points. | Minimal slippage within points; continuous discovery. |

---

## 4. Execution Flow & Gas Optimization

### **The Tick-Walk**
1. **Load Current State**: Fetch $p_{current}$ and the current active tick $i$.
2. **Calculate Distance to Boundary**: Compute the amount of tokens needed to reach $p_{i+1}$ (buying) or $p_i$ (selling).
3. **If Trade < Boundary**: Update $p_{current}$ and balances. Exit.
4. **If Trade > Boundary**: 
   - Consume all liquidity at current tick.
   - Use the **Tick Bitmap** to find the next active tick.
   - Update global $L$ (liquidityNet).
   - Repeat.

### **Pro-Rata Fee Distribution**
Because all LPs at a specific tick are fungible, fees are distributed proportionally to their share of $L$. This eliminates the "latency race" for priority within a tick.

---

## 5. Protocol Safety & Rounding

To ensure the pool's solvency and prevent "drain" attacks:
- **Taker Pays**: Always round **up** (`ceil`).
- **Taker Receives**: Always round **down** (`floor`).
- **Ratio $R$**: Pre-calculating square roots or using high-precision fixed-point math (WAD/RAY) is required to prevent precision loss near the edges ($p \to 0$ or $p \to 1$).

---

## 6. Comparison with Uniswap v3

| Feature | Uniswap v3 | Sooth CLT |
| :--- | :--- | :--- |
| **Price Space** | Logarithmic ($\sqrt{price}$) | **Linear Probability ($p$)** |
| **Position Type** | Non-Fungible (NFT) | **Fungible (ERC20-like)** |
| **Grid** | Arbitrary ranges | **Fixed 10,000 tick grid** |
| **Target Use** | General Assets | **YES/NO Prediction Assets** |

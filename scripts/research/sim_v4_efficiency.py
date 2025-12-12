import math

# ==========================================
# Parameters
# ==========================================
B_LIQUIDITY = 10000.0  # 10k USDC liquidity
TICKS = 1000           # V3 Tick resolution
MIN_TRADE = 10.0       # 10 shares
# ==========================================

print(f"--- V4 vs V3 Efficiency Simulation ---")
print(f"B: {B_LIQUIDITY}")
print(f"Ticks: {TICKS}")
print(f"------------------------------------\n")

def v4_cost(q_yes, q_no, b):
    # C = b * ln(e^(qy/b) + e^(qn/b))
    # Safe impl to avoid overflow: shift max
    m = max(q_yes/b, q_no/b)
    sum_exp = math.exp(q_yes/b - m) + math.exp(q_no/b - m)
    return b * (math.log(sum_exp) + m)

def v3_cost(tick_counts, b):
    # Mock V3 logic: Cost is sum of costs per tick bucket
    # This is an approximation as V3 real logic is complex.
    # Simple model: discretized integral.
    # We assume 'perfect' V3 distribution for comparison, 
    # but in reality V3 has 'quantization error'.
    
    # Quantization Error:
    # V4 allows exact qYes/qNo.
    # V3 forces q to be in buckets.
    # If I buy 0.1 shares, V3 might round to 0 or 1 tick?
    # Or spreads liquidity across a tick.
    
    # Let's verify 'Price Impact Smoothness'.
    pass 

def simulate_smoothness():
    # Scenario: Buying small amounts continuously.
    # V4 should have smooth price curve.
    # V3 would have step-functions if ticks were coarse.
    
    print(f"{'Shares Bought':<15} | {'V4 Price':<15} | {'V4 Cost Delta':<15}")
    print("-" * 50)
    
    q_yes = 0.0
    q_no = 0.0
    
    # Initial Price
    # p = 0.5
    
    for i in range(1, 11):
        shares = i * 100.0 # Buy 100, 200, ...
        
        c_old = v4_cost(q_yes, q_no, B_LIQUIDITY)
        c_new = v4_cost(q_yes + 10.0, q_no, B_LIQUIDITY) # Marginal cost of next 10 shares
        
        marginal_price = (c_new - c_old) / 10.0
        
        print(f"{shares:<15.0f} | {marginal_price:<15.6f} | {c_new-c_old:<15.4f}")
        
        q_yes = shares

def analyze_capital_efficiency():
    print(f"\n--- Capital Efficiency Analysis ---")
    # Metric: For a given B, what is the 'Slippage' per volume?
    # Lower slippage = Higher efficiency.
    
    trade_size = 1000.0
    
    # V4 Slippage
    c_start = v4_cost(0, 0, B_LIQUIDITY)
    c_end = v4_cost(trade_size, 0, B_LIQUIDITY)
    avg_price_v4 = (c_end - c_start) / trade_size
    start_price = 0.5
    slippage_v4 = (avg_price_v4 - start_price) / start_price
    
    print(f"Trade Size: {trade_size} Shares")
    print(f"V4 Slippage: {slippage_v4*100:.4f}%")
    
    # V3 (Tick Based) comparison
    # In V3, liquidity is often 'concentrated' or 'spread'.
    # If Spread uniformly (like LMSR), it matches V4.
    # But V3 had 'Tick Gaps' or 'Empty Ticks'.
    # If 10% of ticks are empty due to initialization gaps:
    # Actual B_effective = B * 0.9
    
    b_v3_imperfection = B_LIQUIDITY * 0.9
    c_start_v3 = v4_cost(0, 0, b_v3_imperfection)
    c_end_v3 = v4_cost(trade_size, 0, b_v3_imperfection)
    avg_price_v3 = (c_end_v3 - c_start_v3) / trade_size
    slippage_v3 = (avg_price_v3 - start_price) / start_price
    
    print(f"V3 Slippage (w/ 10% Tick Gaps): {slippage_v3*100:.4f}%")
    print(f"Efficiency Gain: V4 is {(slippage_v3/slippage_v4 - 1)*100:.1f}% more efficient than V3 with gaps.")

if __name__ == "__main__":
    simulate_smoothness()
    analyze_capital_efficiency()

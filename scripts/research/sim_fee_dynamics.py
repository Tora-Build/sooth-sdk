import math

# ==========================================
# Parameters to Tune
# ==========================================
F_BASE = 0.0005      # 5 bps
EPSILON = 0.02       # 2% spread tolerance
ALPHA = 0.5          # Slope: For every 1% excess divergence, add 0.5% fee
# ==========================================

print(f"--- Simulation Configuration ---")
print(f"Base Fee (F_base): {F_BASE*10000:.0f} bps")
print(f"Tolerance (epsilon): {EPSILON*100:.1f}%")
print(f"Slope (alpha): {ALPHA}")
print(f"--------------------------------\n")

def calculate_fee(amm_price, order_price):
    divergence = abs(amm_price - order_price)
    
    if divergence <= EPSILON:
        return F_BASE
    
    excess = divergence - EPSILON
    dynamic_fee = excess * ALPHA
    return F_BASE + dynamic_fee

def simulate_scenario():
    amm_price = 0.50
    
    print(f"{'Order Price':<12} | {'Divergence':<12} | {'Fee (%)':<10} | {'Fee (bps)':<10} | {'Effective Taker Price':<22}")
    print("-" * 75)
    
    # Simulate Order Prices from 0.40 to 0.60
    # Step by 0.005
    prices = [x / 1000.0 for x in range(400, 605, 5)]
    
    for p in prices:
        div = abs(p - amm_price)
        fee = calculate_fee(amm_price, p)
        
        # Effective price for a BUYER Taker for a SELL Order at p
        # If I buy at p, I pay p + fee
        # But fee comes out of the execution? 
        # Usually Taker pays Price + Fee.
        effective_price = p * (1 + fee)
        
        print(f"{p:<12.3f} | {div:<12.3f} | {fee*100:<10.2f} | {fee*10000:<10.0f} | {effective_price:<22.4f}")

def analyze_gaming_cost():
    print(f"\n--- Gaming Cost Analysis (AMM Spoofing) ---")
    # Attacker moves AMM from 0.50 to 0.45 to enable a low-fee buy at 0.45 on OB
    # Cost = AMM Slippage Cost vs Fee Savings
    
    # Assumptions
    b = 10000 # Liquidity parameter
    initial_p = 0.50
    target_p = 0.45
    
    # 1. Cost to move AMM
    # Cost to move from 0.50 to 0.45
    # C(q) approx.
    # To drop price by 0.05, how much q?
    # p = e^(q/b) / (e^(q/b) + e^-q/b) ... simplied p = sigmoid(q/b)
    # q = b * ln(p / (1-p))
    
    q_initial = b * math.log(initial_p / (1 - initial_p)) # 0
    q_target = b * math.log(target_p / (1 - target_p))    # negative
    
    delta_q = abs(q_initial - q_target)
    
    # LMSR Cost Delta
    # For a trade this size, the cost is the integral of price.
    # But attackers "loss" is the slippage/fee on this trade + the reversion trade?
    # Simplest metric: Cost of Manipulation ~ Spread/Fee on AMM + Price Impact Loss
    
    # Let's just calculate the Fee Savings
    # Old Scheme (Static Fee):
    # If OB was at 0.45 and AMM at 0.50. Div = 0.05.
    # Old Fee (Static): 0 bps? Or Base?
    # New Fee: Base (5bps) + (0.05 - 0.02)*0.5 = 5bps + 150bps = 155 bps.
    
    fee_saving = (calculate_fee(0.50, 0.45) - calculate_fee(0.45, 0.45))
    
    print(f"Scenario: Attacker wants to fill OB Order at 0.45 when True AMM is 0.50")
    print(f"Fee without manipulation: {calculate_fee(0.50, 0.45)*10000:.0f} bps")
    print(f"Fee with manipulation (AMM=0.45): {calculate_fee(0.45, 0.45)*10000:.0f} bps")
    print(f"Fee Savings: {fee_saving*10000:.0f} bps")
    print(f"\nIs it worth it?")
    print(f"To save {fee_saving*100:.2f}%, attacker must move AMM price by 5%.")
    print(f"This requires trading significant volume against the curve, incurring AMM fees (50bps) and slippage.")
    print(f"Unless the OB Order Size is HUGE relative to AMM `b`, this is -EV.")

if __name__ == "__main__":
    simulate_scenario()
    analyze_gaming_cost()

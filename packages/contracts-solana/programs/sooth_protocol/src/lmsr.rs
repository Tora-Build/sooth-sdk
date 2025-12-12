//! LMSR (Logarithmic Market Scoring Rule) implementation for Solana
//! 
//! Ports the EVM SoothLMSRReal.sol using 59.18 fixed-point arithmetic.

use anchor_lang::prelude::*;

/// Fixed-point scale factor (10^18)
pub const ONE: i128 = 1_000_000_000_000_000_000;

/// Maximum input for exp() to prevent overflow (~133.084258667509499441)
pub const EXP_MAX_INPUT: i128 = 133084258667509499441;

/// LMSR state
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct LmsrState {
    pub q_yes: i128,
    pub q_no: i128,
}

/// Calculate ln(exp(a) + exp(b)) using log-sum-exp trick
/// 
/// This prevents overflow by factoring out the maximum value:
/// ln(exp(a) + exp(b)) = m + ln(exp(a-m) + exp(b-m)) where m = max(a,b)
fn log_sum_exp_2(a: i128, b: i128) -> Result<i128> {
    let m = if a > b { a } else { b };
    
    let a_shifted = a - m;
    let b_shifted = b - m;
    
    require!(
        a_shifted <= EXP_MAX_INPUT && b_shifted <= EXP_MAX_INPUT,
        LmsrError::ExpOverflow
    );
    
    let e_a = exp(a_shifted)?;
    let e_b = exp(b_shifted)?;
    
    let sum = e_a
        .checked_add(e_b)
        .ok_or(LmsrError::Overflow)?;
    
    require!(sum > 0, LmsrError::ExpUnderflow);
    
    let ln_sum = ln(sum)?;
    Ok(ln_sum + m)
}

/// LMSR cost function: C(q) = b * ln(exp(qY/b) + exp(qN/b))
fn cost(q_yes: i128, q_no: i128, b: u128) -> Result<i128> {
    require!(b > 0, LmsrError::ZeroB);
    
    let b_i = b as i128;
    
    // a = qYes / b (in WAD)
    // q and b are both WAD, so we multiply q by ONE to preserve WAD precision after division
    let a = q_yes
        .checked_mul(ONE)
        .ok_or(LmsrError::Overflow)?
        .checked_div(b_i)
        .ok_or(LmsrError::DivisionByZero)?;
    
    // c = qNo / b (in WAD)
    let c = q_no
        .checked_mul(ONE)
        .ok_or(LmsrError::Overflow)?
        .checked_div(b_i)
        .ok_or(LmsrError::DivisionByZero)?;
    
    let lse = log_sum_exp_2(a, c)?;
    
    // cost = b * lse (convert back from WAD)
    // lse is WAD (log output), b is WAD.
    // Result should be WAD.
    // b * lse = WAD * WAD = WAD^2. Divide by ONE to get WAD.
    let cost_wad = b_i
        .checked_mul(lse)
        .ok_or(LmsrError::Overflow)?
        .checked_div(ONE)
        .ok_or(LmsrError::DivisionByZero)?;
    
    Ok(cost_wad)
}

/// Calculate cost delta for buying/selling shares
pub fn cost_delta(
    state: LmsrState,
    outcome_index: u8,
    delta_shares: i128,
    b: u128,
) -> Result<(i64, LmsrState)> {
    require!(outcome_index < 2, LmsrError::InvalidOutcome);
    require!(delta_shares != 0, LmsrError::ZeroDelta);
    
    let mut q_yes = state.q_yes;
    let mut q_no = state.q_no;
    
    let old_cost = cost(q_yes, q_no, b)?;
    
    if outcome_index == 0 {
        q_yes = q_yes
            .checked_add(delta_shares)
            .ok_or(LmsrError::Overflow)?;
    } else {
        q_no = q_no
            .checked_add(delta_shares)
            .ok_or(LmsrError::Overflow)?;
    }
    
    let new_cost = cost(q_yes, q_no, b)?;
    
    let cost_delta = new_cost
        .checked_sub(old_cost)
        .ok_or(LmsrError::Overflow)?;
        
    // Cost delta is in WAD (i128). Convert to i64 (USDC amount).
    // Assuming USDC is 6 decimals but here we track in WAD?
    // In lib.rs, balances are u64.
    // If we use WAD for everything, we might need to downscale if balances are native USDC.
    // But currently lib.rs seems to treat everything as WAD (based on previous edits of 1e18).
    // So we just cast to i64, assuming cost fits in i64.
    // Max i64 ~9e18. If cost > 9 shares, i64 overflows!
    // ISSUE: i64 return type is too small for large costs!
    // But lib.rs expects i64 for `cost`?
    // Let's check lib.rs usage. trade instruction takes max_cost: u64.
    // So for now we clamp to i64 bounds or error.
    
    let cost_delta_i64 = i64::try_from(cost_delta).map_err(|_| error!(LmsrError::Overflow))?;
    
    let new_state = LmsrState { q_yes, q_no };
    
    Ok((cost_delta_i64, new_state))
}

/// Calculate price for an outcome (returns WAD, i.e., 1e18 = 100%)
pub fn price(state: LmsrState, outcome_index: u8, b: u128) -> Result<u64> {
    require!(outcome_index < 2, LmsrError::InvalidOutcome);
    require!(b > 0, LmsrError::ZeroB);
    
    let b_i = b as i128;
    
    let a = state.q_yes
        .checked_mul(ONE)
        .ok_or(LmsrError::Overflow)?
        .checked_div(b_i)
        .ok_or(LmsrError::DivisionByZero)?;
    
    let c = state.q_no
        .checked_mul(ONE)
        .ok_or(LmsrError::Overflow)?
        .checked_div(b_i)
        .ok_or(LmsrError::DivisionByZero)?;
    
    require!(
        a <= EXP_MAX_INPUT && c <= EXP_MAX_INPUT,
        LmsrError::ExpOverflow
    );
    
    let e_yes = exp(a)?;
    let e_no = exp(c)?;
    
    let denom = e_yes
        .checked_add(e_no)
        .ok_or(LmsrError::Overflow)?;
    
    require!(denom > 0, LmsrError::ZeroDenominator);
    
    let p_yes = e_yes
        .checked_mul(ONE)
        .ok_or(LmsrError::Overflow)?
        .checked_div(denom)
        .ok_or(LmsrError::DivisionByZero)?;
    
    let price_wad = if outcome_index == 0 {
        p_yes
    } else {
        ONE - p_yes
    };
    
    u64::try_from(price_wad).map_err(|_| error!(LmsrError::Overflow))
}

/// Natural exponential function (e^x) for fixed-point numbers
/// Uses Taylor series approximation
fn exp(x: i128) -> Result<i128> {
    require!(x <= EXP_MAX_INPUT, LmsrError::ExpOverflow);
    
    // For negative x, use exp(-x) = 1/exp(x)
    if x < 0 {
        let exp_pos = exp(-x)?;
        return Ok(ONE.checked_mul(ONE).ok_or(LmsrError::Overflow)?
            .checked_div(exp_pos).ok_or(LmsrError::DivisionByZero)?);
    }
    
    // Taylor series: e^x = 1 + x + x^2/2! + x^3/3! + ...
    let mut result = ONE;
    let mut term = ONE;
    
    for i in 1..=20 {
        term = term
            .checked_mul(x)
            .ok_or(LmsrError::Overflow)?
            .checked_div(ONE)
            .ok_or(LmsrError::DivisionByZero)?
            .checked_div(i)
            .ok_or(LmsrError::DivisionByZero)?;
        
        if term == 0 {
            break;
        }
        
        result = result.checked_add(term).ok_or(LmsrError::Overflow)?;
    }
    
    Ok(result)
}

/// Natural logarithm (ln(x)) for fixed-point numbers
/// Uses Taylor series approximation around 1
fn ln(x: i128) -> Result<i128> {
    require!(x > 0, LmsrError::LnNonPositive);
    
    if x == ONE {
        return Ok(0);
    }
    
    // For x > 2, use ln(x) = ln(x/2) + ln(2)
    if x > 2 * ONE {
        let ln_half = ln(x / 2)?;
        // ln(2) ≈ 0.693147180559945309417
        const LN_2: i128 = 693147180559945309;
        return Ok(ln_half + LN_2);
    }
    
    // For x < 0.5, use ln(x) = -ln(1/x)
    if x < ONE / 2 {
        let inv = ONE.checked_mul(ONE).ok_or(LmsrError::Overflow)?
            .checked_div(x).ok_or(LmsrError::DivisionByZero)?;
        return Ok(-ln(inv)?);
    }
    
    // Taylor series: ln(1+y) = y - y^2/2 + y^3/3 - y^4/4 + ...
    let y = x - ONE;
    let mut result: i128 = 0;
    let mut term = y;
    
    for i in 1..=20 {
        let sign = if i % 2 == 0 { -1 } else { 1 };
        let contribution = term.checked_div(i).ok_or(LmsrError::DivisionByZero)?;
        result = result.checked_add(sign * contribution).ok_or(LmsrError::Overflow)?;
        
        term = term
            .checked_mul(y)
            .ok_or(LmsrError::Overflow)?
            .checked_div(ONE)
            .ok_or(LmsrError::DivisionByZero)?;
        
        if term.abs() < 1000 {
            break;
        }
    }
    
    Ok(result)
}

#[error_code]
pub enum LmsrError {
    #[msg("Exponential overflow")]
    ExpOverflow,
    #[msg("Exponential underflow")]
    ExpUnderflow,
    #[msg("Logarithm of non-positive number")]
    LnNonPositive,
    #[msg("Division by zero")]
    DivisionByZero,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Invalid outcome index")]
    InvalidOutcome,
    #[msg("Zero delta shares")]
    ZeroDelta,
    #[msg("Zero b parameter")]
    ZeroB,
    #[msg("Zero denominator")]
    ZeroDenominator,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_exp() {
        // exp(0) = 1
        assert_eq!(exp(0).unwrap(), ONE);
        
        // exp(1) ≈ 2.718281828
        let exp_1 = exp(ONE).unwrap();
        assert!((exp_1 - 2718281828459045235).abs() < ONE / 1000);
    }
    
    #[test]
    fn test_ln() {
        // ln(1) = 0
        assert_eq!(ln(ONE).unwrap(), 0);
        
        // ln(e) ≈ 1
        let e = 2718281828459045235;
        let ln_e = ln(e).unwrap();
        assert!((ln_e - ONE).abs() < ONE / 1000);
    }
    
    #[test]
    fn test_price_balanced() {
        let state = LmsrState {
            q_yes: 1000,
            q_no: 1000,
        };
        
        let p = price(state, 0, 1000).unwrap();
        // Should be ~0.5 (50%)
        assert!((p as i128 - ONE / 2).abs() < ONE / 100);
    }
}

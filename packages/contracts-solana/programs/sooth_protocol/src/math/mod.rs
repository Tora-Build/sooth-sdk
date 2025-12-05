//! LMSR (Logarithmic Market Scoring Rule) math implementation
//! Ported from Solidity SoothLMSRReal.sol

use anchor_lang::prelude::*;

/// Fixed-point precision (10^18 equivalent in Solidity)
pub const PRECISION: u128 = 1_000_000_000_000_000_000; // 1e18

/// Calculate LMSR cost function: C(q) = b * ln(exp(qY/b) + exp(qN/b))
/// 
/// Uses the log-sum-exp trick for numerical stability:
/// ln(exp(a) + exp(b)) = m + ln(exp(a-m) + exp(b-m)) where m = max(a,b)
pub fn cost(q_yes: i64, q_no: i64, b: u64) -> Result<i128> {
    require!(b > 0, LmsrError::ZeroB);
    
    let b_i128 = b as i128;
    let q_yes_i128 = q_yes as i128;
    let q_no_i128 = q_no as i128;
    
    // Scale by precision
    let a = (q_yes_i128 * PRECISION as i128) / b_i128;
    let c = (q_no_i128 * PRECISION as i128) / b_i128;
    
    let lse = log_sum_exp_2(a, c)?;
    
    Ok((b_i128 * lse) / PRECISION as i128)
}

/// Calculate cost delta for a trade
/// Returns the cost to move from current state to new state
pub fn cost_delta(
    q_yes: i64,
    q_no: i64,
    outcome: u8,
    delta_shares: i64,
    b: u64,
) -> Result<(i128, i64, i64)> {
    require!(outcome < 2, LmsrError::InvalidOutcome);
    require!(delta_shares != 0, LmsrError::ZeroDelta);
    
    let old_cost = cost(q_yes, q_no, b)?;
    
    let (new_q_yes, new_q_no) = if outcome == 0 {
        (q_yes.checked_add(delta_shares).ok_or(LmsrError::Overflow)?, q_no)
    } else {
        (q_yes, q_no.checked_add(delta_shares).ok_or(LmsrError::Overflow)?)
    };
    
    let new_cost = cost(new_q_yes, new_q_no, b)?;
    let delta_cost = new_cost - old_cost;
    
    Ok((delta_cost, new_q_yes, new_q_no))
}

/// Calculate price for an outcome (0 = YES, 1 = NO)
/// Price = exp(q_i/b) / (exp(q_yes/b) + exp(q_no/b))
pub fn price(q_yes: i64, q_no: i64, outcome: u8, b: u64) -> Result<u64> {
    require!(outcome < 2, LmsrError::InvalidOutcome);
    require!(b > 0, LmsrError::ZeroB);
    
    let b_i128 = b as i128;
    let a = (q_yes as i128 * PRECISION as i128) / b_i128;
    let c = (q_no as i128 * PRECISION as i128) / b_i128;
    
    let exp_a = exp_approx(a)?;
    let exp_c = exp_approx(c)?;
    let denom = exp_a + exp_c;
    
    require!(denom > 0, LmsrError::DenominatorZero);
    
    let price_yes = (exp_a * PRECISION as i128) / denom;
    
    if outcome == 0 {
        Ok(price_yes as u64)
    } else {
        Ok((PRECISION as i128 - price_yes) as u64)
    }
}

/// Log-sum-exp trick: ln(exp(a) + exp(b))
fn log_sum_exp_2(a: i128, c: i128) -> Result<i128> {
    let m = a.max(c);
    let exp_a_shifted = exp_approx(a - m)?;
    let exp_c_shifted = exp_approx(c - m)?;
    let sum = exp_a_shifted + exp_c_shifted;
    
    require!(sum > 0, LmsrError::ExpUnderflow);
    
    Ok(ln_approx(sum)? + m)
}

/// Approximate exp(x) for fixed-point x
/// Using Taylor series: exp(x) ≈ 1 + x + x²/2! + x³/3! + ...
fn exp_approx(x: i128) -> Result<i128> {
    // Clamp to reasonable range to prevent overflow
    if x > 40 * PRECISION as i128 {
        return Ok(i128::MAX / 2);
    }
    if x < -40 * PRECISION as i128 {
        return Ok(0);
    }
    
    // Taylor series with 10 terms
    let precision = PRECISION as i128;
    let mut result = precision; // 1
    let mut term = precision;
    
    for i in 1..=10 {
        term = (term * x) / (precision * i as i128);
        result = result.saturating_add(term);
    }
    
    Ok(result)
}

/// Approximate ln(x) for fixed-point x
/// Using series expansion around x=1
fn ln_approx(x: i128) -> Result<i128> {
    require!(x > 0, LmsrError::LogOfZero);
    
    let precision = PRECISION as i128;
    
    // Normalize x to be close to 1 for better convergence
    // ln(x) = ln(x/2^n) + n*ln(2)
    let ln_2 = 693_147_180_559_945_309_i128; // ln(2) * 1e18
    
    let mut x_normalized = x;
    let mut shift = 0i128;
    
    while x_normalized > 2 * precision {
        x_normalized /= 2;
        shift += 1;
    }
    while x_normalized < precision / 2 {
        x_normalized *= 2;
        shift -= 1;
    }
    
    // Now compute ln(x_normalized) where x_normalized ≈ 1
    // ln(1+y) ≈ y - y²/2 + y³/3 - y⁴/4 + ...
    let y = x_normalized - precision;
    let mut result = 0i128;
    let mut term = y;
    
    for i in 1..=10 {
        if i % 2 == 1 {
            result = result.saturating_add(term / i as i128);
        } else {
            result = result.saturating_sub(term / i as i128);
        }
        term = (term * y) / precision;
    }
    
    Ok(result + shift * ln_2)
}

#[error_code]
pub enum LmsrError {
    #[msg("b parameter cannot be zero")]
    ZeroB,
    #[msg("Invalid outcome (must be 0 or 1)")]
    InvalidOutcome,
    #[msg("Delta shares cannot be zero")]
    ZeroDelta,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Denominator is zero")]
    DenominatorZero,
    #[msg("Exp underflow")]
    ExpUnderflow,
    #[msg("Log of zero or negative")]
    LogOfZero,
}

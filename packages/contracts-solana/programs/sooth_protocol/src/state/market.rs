//! Market state - prediction market with AMM

use anchor_lang::prelude::*;

/// A prediction market
#[account]
#[derive(Default)]
pub struct Market {
    /// Unique market identifier
    pub market_id: u64,
    /// Market creator/governor
    pub governor: Pubkey,
    /// LMSR liquidity parameter (b)
    pub b_param: u64,
    /// AMM fee in basis points
    pub fee_bps: u16,
    /// AMM state: quantity of YES tokens
    pub q_yes: i64,
    /// AMM state: quantity of NO tokens
    pub q_no: i64,
    /// Is market live for trading
    pub is_live: bool,
    /// Is market settled
    pub is_settled: bool,
    /// Winning outcome (0 = YES, 1 = NO)
    pub winning_outcome: u8,
    /// Bump seed
    pub bump: u8,
}

impl Market {
    pub const LEN: usize = 8 + 8 + 32 + 8 + 2 + 8 + 8 + 1 + 1 + 1 + 1;
}

/// User's position in a specific market
#[account]
#[derive(Default)]
pub struct UserPosition {
    /// User's wallet
    pub owner: Pubkey,
    /// Market this position belongs to
    pub market: Pubkey,
    /// YES token balance
    pub yes_balance: u64,
    /// NO token balance
    pub no_balance: u64,
    /// Bump seed
    pub bump: u8,
}

impl UserPosition {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1;
}

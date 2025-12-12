//! Custom error codes for Sooth Protocol

use anchor_lang::prelude::*;

#[error_code]
pub enum SoothError {
    #[msg("Insufficient balance")]
    InsufficientBalance,
    
    #[msg("Insufficient free balance")]
    InsufficientFreeBalance,
    
    #[msg("Market is not live")]
    MarketNotLive,
    
    #[msg("Market is already settled")]
    MarketAlreadySettled,
    
    #[msg("Market is not settled")]
    MarketNotSettled,
    
    #[msg("Invalid outcome")]
    InvalidOutcome,
    
    #[msg("Slippage exceeded")]
    SlippageExceeded,
    
    #[msg("Unauthorized")]
    Unauthorized,
    
    #[msg("Arithmetic overflow")]
    Overflow,
    
    #[msg("Nothing to claim")]
    NothingToClaim,
}

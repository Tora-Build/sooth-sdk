//! Trader Vault state - manages user deposits and balances

use anchor_lang::prelude::*;

/// Global trader vault configuration
#[account]
#[derive(Default)]
pub struct TraderVault {
    /// Vault authority (PDA)
    pub authority: Pubkey,
    /// USDC mint address
    pub usdc_mint: Pubkey,
    /// Vault USDC token account
    pub vault_token_account: Pubkey,
    /// Total deposits in vault
    pub total_deposits: u64,
    /// Bump seed for PDA
    pub bump: u8,
}

impl TraderVault {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 1;
}

/// User's balance in the trader vault
#[account]
#[derive(Default)]
pub struct UserBalance {
    /// User's wallet address
    pub owner: Pubkey,
    /// Free balance (available for trading)
    pub free_balance: u64,
    /// Locked balance (in active orders)
    pub locked_balance: u64,
    /// Bump seed
    pub bump: u8,
}

impl UserBalance {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 1;
}

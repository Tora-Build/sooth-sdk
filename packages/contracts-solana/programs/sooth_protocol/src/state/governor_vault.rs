//! Governor Vault state - LP liquidity pool with ERC4626-style shares

use anchor_lang::prelude::*;

/// Governor vault for LP liquidity
#[account]
#[derive(Default)]
pub struct GovernorVault {
    /// Vault authority (PDA)
    pub authority: Pubkey,
    /// USDC mint address
    pub usdc_mint: Pubkey,
    /// Vault USDC token account
    pub vault_token_account: Pubkey,
    /// Total assets under management
    pub total_assets: u64,
    /// Total shares issued
    pub total_shares: u64,
    /// Total exposure across all markets
    pub total_exposure: u64,
    /// Bump seed
    pub bump: u8,
}

impl GovernorVault {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1;
}

/// LP's share balance
#[account]
#[derive(Default)]
pub struct LpPosition {
    /// LP's wallet address
    pub owner: Pubkey,
    /// Number of shares owned
    pub shares: u64,
    /// Bump seed
    pub bump: u8,
}

impl LpPosition {
    pub const LEN: usize = 8 + 32 + 8 + 1;
}

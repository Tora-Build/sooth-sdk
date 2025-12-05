//! Governor Vault (LP) instructions - deposit and withdraw with shares

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::{GovernorVault, LpPosition};
use crate::errors::SoothError;

#[derive(Accounts)]
pub struct LpDeposit<'info> {
    #[account(mut)]
    pub lp: Signer<'info>,
    
    #[account(mut)]
    pub governor_vault: Account<'info, GovernorVault>,
    
    #[account(
        init_if_needed,
        payer = lp,
        space = LpPosition::LEN,
        seeds = [b"lp_position", lp.key().as_ref()],
        bump
    )]
    pub lp_position: Account<'info, LpPosition>,
    
    #[account(mut)]
    pub lp_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn lp_deposit(ctx: Context<LpDeposit>, assets: u64) -> Result<()> {
    let vault = &mut ctx.accounts.governor_vault;
    
    // Calculate shares to mint (ERC4626-style)
    let shares = if vault.total_shares == 0 {
        assets // 1:1 for first deposit
    } else {
        (assets as u128 * vault.total_shares as u128 / vault.total_assets as u128) as u64
    };
    
    // Transfer tokens from LP to vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.lp_token_account.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.lp.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::transfer(CpiContext::new(cpi_program, cpi_accounts), assets)?;
    
    // Update LP position
    ctx.accounts.lp_position.owner = ctx.accounts.lp.key();
    ctx.accounts.lp_position.shares = ctx.accounts.lp_position.shares
        .checked_add(shares)
        .ok_or(SoothError::Overflow)?;
    
    // Update vault totals
    vault.total_assets = vault.total_assets.checked_add(assets).ok_or(SoothError::Overflow)?;
    vault.total_shares = vault.total_shares.checked_add(shares).ok_or(SoothError::Overflow)?;
    
    msg!("LP deposited {} assets, received {} shares", assets, shares);
    Ok(())
}

#[derive(Accounts)]
pub struct LpWithdraw<'info> {
    #[account(mut)]
    pub lp: Signer<'info>,
    
    #[account(mut)]
    pub governor_vault: Account<'info, GovernorVault>,
    
    #[account(
        mut,
        seeds = [b"lp_position", lp.key().as_ref()],
        bump = lp_position.bump
    )]
    pub lp_position: Account<'info, LpPosition>,
    
    #[account(mut)]
    pub lp_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: PDA authority for the vault
    pub vault_authority: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
}

pub fn lp_withdraw(ctx: Context<LpWithdraw>, shares: u64) -> Result<()> {
    require!(
        ctx.accounts.lp_position.shares >= shares,
        SoothError::InsufficientBalance
    );
    
    let vault = &mut ctx.accounts.governor_vault;
    
    // Calculate assets to return (ERC4626-style)
    let assets = (shares as u128 * vault.total_assets as u128 / vault.total_shares as u128) as u64;
    
    // Transfer tokens from vault to LP (PDA signs)
    let seeds = &[
        b"vault_authority",
        &[vault.bump],
    ];
    let signer = &[&seeds[..]];
    
    let cpi_accounts = Transfer {
        from: ctx.accounts.vault_token_account.to_account_info(),
        to: ctx.accounts.lp_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::transfer(CpiContext::new_with_signer(cpi_program, cpi_accounts, signer), assets)?;
    
    // Update LP position
    ctx.accounts.lp_position.shares -= shares;
    
    // Update vault totals
    vault.total_assets -= assets;
    vault.total_shares -= shares;
    
    msg!("LP burned {} shares, withdrew {} assets", shares, assets);
    Ok(())
}

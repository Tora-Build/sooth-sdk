//! Trader Vault instructions - deposit and withdraw

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::{TraderVault, UserBalance};
use crate::errors::SoothError;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut)]
    pub trader_vault: Account<'info, TraderVault>,
    
    #[account(
        init_if_needed,
        payer = user,
        space = UserBalance::LEN,
        seeds = [b"user_balance", user.key().as_ref()],
        bump
    )]
    pub user_balance: Account<'info, UserBalance>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    // Transfer tokens from user to vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::transfer(CpiContext::new(cpi_program, cpi_accounts), amount)?;
    
    // Update user balance
    ctx.accounts.user_balance.owner = ctx.accounts.user.key();
    ctx.accounts.user_balance.free_balance = ctx.accounts.user_balance.free_balance
        .checked_add(amount)
        .ok_or(SoothError::Overflow)?;
    
    // Update vault total
    ctx.accounts.trader_vault.total_deposits = ctx.accounts.trader_vault.total_deposits
        .checked_add(amount)
        .ok_or(SoothError::Overflow)?;
    
    msg!("Deposited {} to trader vault", amount);
    Ok(())
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut)]
    pub trader_vault: Account<'info, TraderVault>,
    
    #[account(
        mut,
        seeds = [b"user_balance", user.key().as_ref()],
        bump = user_balance.bump
    )]
    pub user_balance: Account<'info, UserBalance>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: PDA authority for the vault
    pub vault_authority: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
}

pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    require!(
        ctx.accounts.user_balance.free_balance >= amount,
        SoothError::InsufficientFreeBalance
    );
    
    // Transfer tokens from vault to user (PDA signs)
    let seeds = &[
        b"vault_authority",
        &[ctx.accounts.trader_vault.bump],
    ];
    let signer = &[&seeds[..]];
    
    let cpi_accounts = Transfer {
        from: ctx.accounts.vault_token_account.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::transfer(CpiContext::new_with_signer(cpi_program, cpi_accounts, signer), amount)?;
    
    // Update user balance
    ctx.accounts.user_balance.free_balance -= amount;
    
    // Update vault total
    ctx.accounts.trader_vault.total_deposits -= amount;
    
    msg!("Withdrew {} from trader vault", amount);
    Ok(())
}

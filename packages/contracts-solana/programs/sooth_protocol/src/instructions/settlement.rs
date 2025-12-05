//! Settlement instructions - settle markets and claim winnings

use anchor_lang::prelude::*;

use crate::state::{Market, UserPosition, UserBalance, GovernorVault};
use crate::errors::SoothError;

#[derive(Accounts)]
pub struct SettleMarket<'info> {
    #[account(mut)]
    pub governor: Signer<'info>,
    
    #[account(
        mut,
        constraint = market.governor == governor.key() @ SoothError::Unauthorized
    )]
    pub market: Account<'info, Market>,
}

pub fn settle_market(ctx: Context<SettleMarket>, winning_outcome: u8) -> Result<()> {
    let market = &mut ctx.accounts.market;
    
    require!(!market.is_settled, SoothError::MarketAlreadySettled);
    require!(winning_outcome < 2, SoothError::InvalidOutcome);
    
    market.is_live = false;
    market.is_settled = true;
    market.winning_outcome = winning_outcome;
    
    msg!("Market {} settled with outcome {}", market.market_id, winning_outcome);
    Ok(())
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        constraint = market.is_settled @ SoothError::MarketNotSettled
    )]
    pub market: Account<'info, Market>,
    
    #[account(
        mut,
        seeds = [b"user_position", user.key().as_ref(), market.key().as_ref()],
        bump = user_position.bump
    )]
    pub user_position: Account<'info, UserPosition>,
    
    #[account(
        mut,
        seeds = [b"user_balance", user.key().as_ref()],
        bump = user_balance.bump
    )]
    pub user_balance: Account<'info, UserBalance>,
    
    #[account(mut)]
    pub governor_vault: Account<'info, GovernorVault>,
}

pub fn claim(ctx: Context<Claim>) -> Result<()> {
    let market = &ctx.accounts.market;
    let user_position = &mut ctx.accounts.user_position;
    let user_balance = &mut ctx.accounts.user_balance;
    
    // Calculate winnings (1 USDC per winning token)
    let winning_tokens = if market.winning_outcome == 0 {
        user_position.yes_balance
    } else {
        user_position.no_balance
    };
    
    require!(winning_tokens > 0, SoothError::NothingToClaim);
    
    // Payout = winning tokens * 1 USDC (assuming 6 decimals)
    let payout = winning_tokens;
    
    // Transfer from governor vault to user balance
    ctx.accounts.governor_vault.total_assets = ctx.accounts.governor_vault.total_assets
        .saturating_sub(payout);
    user_balance.free_balance = user_balance.free_balance
        .checked_add(payout)
        .ok_or(SoothError::Overflow)?;
    
    // Clear user position
    user_position.yes_balance = 0;
    user_position.no_balance = 0;
    
    msg!("Claimed {} tokens", winning_tokens);
    Ok(())
}

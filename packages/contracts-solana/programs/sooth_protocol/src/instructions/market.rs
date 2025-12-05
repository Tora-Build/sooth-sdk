//! Market instructions - create market and trade

use anchor_lang::prelude::*;

use crate::state::{Market, UserPosition, UserBalance, GovernorVault};
use crate::errors::SoothError;
use crate::math;

#[derive(Accounts)]
#[instruction(market_id: u64)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub governor: Signer<'info>,
    
    #[account(
        init,
        payer = governor,
        space = Market::LEN,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump
    )]
    pub market: Account<'info, Market>,
    
    pub system_program: Program<'info, System>,
}

pub fn create_market(
    ctx: Context<CreateMarket>,
    market_id: u64,
    b_param: u64,
    fee_bps: u16,
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    
    market.market_id = market_id;
    market.governor = ctx.accounts.governor.key();
    market.b_param = b_param;
    market.fee_bps = fee_bps;
    market.q_yes = (b_param as i64) * 1_000_000; // Initial balanced state
    market.q_no = (b_param as i64) * 1_000_000;
    market.is_live = true;
    market.is_settled = false;
    market.bump = ctx.bumps.market;
    
    msg!("Created market {} with b={}", market_id, b_param);
    Ok(())
}

#[derive(Accounts)]
pub struct Trade<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    
    #[account(mut)]
    pub market: Account<'info, Market>,
    
    #[account(
        mut,
        seeds = [b"user_balance", trader.key().as_ref()],
        bump = user_balance.bump
    )]
    pub user_balance: Account<'info, UserBalance>,
    
    #[account(
        init_if_needed,
        payer = trader,
        space = UserPosition::LEN,
        seeds = [b"user_position", trader.key().as_ref(), market.key().as_ref()],
        bump
    )]
    pub user_position: Account<'info, UserPosition>,
    
    #[account(mut)]
    pub governor_vault: Account<'info, GovernorVault>,
    
    pub system_program: Program<'info, System>,
}

pub fn trade(
    ctx: Context<Trade>,
    outcome: u8,
    delta_shares: i64,
    max_cost: u64,
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let user_balance = &mut ctx.accounts.user_balance;
    let user_position = &mut ctx.accounts.user_position;
    
    require!(market.is_live && !market.is_settled, SoothError::MarketNotLive);
    require!(outcome < 2, SoothError::InvalidOutcome);
    
    // Selling: check user has tokens
    if delta_shares < 0 {
        let shares_to_sell = (-delta_shares) as u64;
        if outcome == 0 {
            require!(user_position.yes_balance >= shares_to_sell, SoothError::InsufficientBalance);
            user_position.yes_balance -= shares_to_sell;
        } else {
            require!(user_position.no_balance >= shares_to_sell, SoothError::InsufficientBalance);
            user_position.no_balance -= shares_to_sell;
        }
    }
    
    // Calculate cost using LMSR
    let (cost, new_q_yes, new_q_no) = math::cost_delta(
        market.q_yes,
        market.q_no,
        outcome,
        delta_shares,
        market.b_param,
    )?;
    
    // Calculate fee
    let abs_cost = if cost >= 0 { cost as u64 } else { (-cost) as u64 };
    let fee = (abs_cost as u128 * market.fee_bps as u128 / 10000) as u64;
    
    // For buying: check user has funds and deduct
    if delta_shares > 0 {
        let total_cost = (cost as u64).checked_add(fee).ok_or(SoothError::Overflow)?;
        require!(total_cost <= max_cost, SoothError::SlippageExceeded);
        require!(user_balance.free_balance >= total_cost, SoothError::InsufficientFreeBalance);
        
        user_balance.free_balance -= total_cost;
        
        // Credit shares
        let shares = delta_shares as u64;
        if outcome == 0 {
            user_position.yes_balance += shares;
        } else {
            user_position.no_balance += shares;
        }
        
        // Governor vault receives payment
        ctx.accounts.governor_vault.total_assets += total_cost;
    } else {
        // Selling: user receives payout
        let payout = (-cost) as u64;
        user_balance.free_balance += payout.saturating_sub(fee);
        ctx.accounts.governor_vault.total_assets -= payout;
    }
    
    // Update market state
    market.q_yes = new_q_yes;
    market.q_no = new_q_no;
    
    // Initialize position owner if needed
    user_position.owner = ctx.accounts.trader.key();
    user_position.market = market.key();
    
    msg!("Trade executed: outcome={}, delta={}, cost={}", outcome, delta_shares, cost);
    Ok(())
}

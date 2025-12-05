//! Sooth Protocol - Prediction Markets on Solana
//! 
//! Minimal scaffold that compiles. Full implementation TBD.

use anchor_lang::prelude::*;

declare_id!("SoothProtoco1111111111111111111111111111111");

#[program]
pub mod sooth_protocol {
    use super::*;

    /// Initialize trader vault
    pub fn initialize_trader_vault(ctx: Context<InitializeTraderVault>) -> Result<()> {
        let vault = &mut ctx.accounts.trader_vault;
        vault.authority = ctx.accounts.authority.key();
        vault.total_deposits = 0;
        vault.bump = ctx.bumps.trader_vault;
        msg!("Trader vault initialized");
        Ok(())
    }

    /// Initialize user balance account
    pub fn initialize_user_balance(ctx: Context<InitializeUserBalance>) -> Result<()> {
        let user_balance = &mut ctx.accounts.user_balance;
        user_balance.owner = ctx.accounts.user.key();
        user_balance.free_balance = 0;
        user_balance.locked_balance = 0;
        user_balance.bump = ctx.bumps.user_balance;
        msg!("User balance initialized");
        Ok(())
    }

    /// Deposit USDC into trader vault
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let user_balance = &mut ctx.accounts.user_balance;
        user_balance.free_balance = user_balance.free_balance
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        
        ctx.accounts.trader_vault.total_deposits = ctx.accounts.trader_vault.total_deposits
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        
        msg!("Deposited {} to trader vault", amount);
        Ok(())
    }

    /// Withdraw USDC from trader vault
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let user_balance = &mut ctx.accounts.user_balance;
        require!(user_balance.free_balance >= amount, ErrorCode::InsufficientBalance);
        
        user_balance.free_balance -= amount;
        ctx.accounts.trader_vault.total_deposits -= amount;
        
        msg!("Withdrew {} from trader vault", amount);
        Ok(())
    }

    /// Create a new prediction market
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
        market.q_yes = (b_param as i64) * 1_000_000;
        market.q_no = (b_param as i64) * 1_000_000;
        market.is_live = true;
        market.is_settled = false;
        market.bump = ctx.bumps.market;
        
        msg!("Created market {} with b={}", market_id, b_param);
        Ok(())
    }

    /// Initialize user position for a market
    pub fn initialize_position(ctx: Context<InitializePosition>) -> Result<()> {
        let position = &mut ctx.accounts.user_position;
        position.owner = ctx.accounts.trader.key();
        position.market = ctx.accounts.market.key();
        position.yes_balance = 0;
        position.no_balance = 0;
        position.bump = ctx.bumps.user_position;
        msg!("Position initialized");
        Ok(())
    }

    /// Execute AMM trade
    pub fn trade(
        ctx: Context<Trade>,
        outcome: u8,
        delta_shares: i64,
        _max_cost: u64,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let position = &mut ctx.accounts.user_position;
        
        require!(market.is_live && !market.is_settled, ErrorCode::MarketNotLive);
        require!(outcome < 2, ErrorCode::InvalidOutcome);
        
        // Simplified: just update quantities and positions
        if outcome == 0 {
            market.q_yes = market.q_yes.checked_add(delta_shares).ok_or(ErrorCode::Overflow)?;
            if delta_shares > 0 {
                position.yes_balance += delta_shares as u64;
            }
        } else {
            market.q_no = market.q_no.checked_add(delta_shares).ok_or(ErrorCode::Overflow)?;
            if delta_shares > 0 {
                position.no_balance += delta_shares as u64;
            }
        }
        
        msg!("Trade: outcome={}, delta={}", outcome, delta_shares);
        Ok(())
    }

    /// Settle market with winning outcome
    pub fn settle_market(ctx: Context<SettleMarket>, winning_outcome: u8) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(!market.is_settled, ErrorCode::MarketAlreadySettled);
        require!(winning_outcome < 2, ErrorCode::InvalidOutcome);
        
        market.is_live = false;
        market.is_settled = true;
        market.winning_outcome = winning_outcome;
        
        msg!("Market settled with outcome {}", winning_outcome);
        Ok(())
    }
}

// ============ Account Structs ============

#[account]
#[derive(Default)]
pub struct TraderVault {
    pub authority: Pubkey,
    pub total_deposits: u64,
    pub bump: u8,
}

#[account]
#[derive(Default)]
pub struct UserBalance {
    pub owner: Pubkey,
    pub free_balance: u64,
    pub locked_balance: u64,
    pub bump: u8,
}

#[account]
#[derive(Default)]
pub struct Market {
    pub market_id: u64,
    pub governor: Pubkey,
    pub b_param: u64,
    pub fee_bps: u16,
    pub q_yes: i64,
    pub q_no: i64,
    pub is_live: bool,
    pub is_settled: bool,
    pub winning_outcome: u8,
    pub bump: u8,
}

#[account]
#[derive(Default)]
pub struct UserPosition {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub yes_balance: u64,
    pub no_balance: u64,
    pub bump: u8,
}

// ============ Instruction Contexts ============

#[derive(Accounts)]
pub struct InitializeTraderVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 1,
        seeds = [b"trader_vault"],
        bump
    )]
    pub trader_vault: Account<'info, TraderVault>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeUserBalance<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 8 + 8 + 1,
        seeds = [b"user_balance", user.key().as_ref()],
        bump
    )]
    pub user_balance: Account<'info, UserBalance>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut, seeds = [b"trader_vault"], bump = trader_vault.bump)]
    pub trader_vault: Account<'info, TraderVault>,
    
    #[account(
        mut,
        seeds = [b"user_balance", user.key().as_ref()],
        bump = user_balance.bump
    )]
    pub user_balance: Account<'info, UserBalance>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut, seeds = [b"trader_vault"], bump = trader_vault.bump)]
    pub trader_vault: Account<'info, TraderVault>,
    
    #[account(
        mut,
        seeds = [b"user_balance", user.key().as_ref()],
        bump = user_balance.bump
    )]
    pub user_balance: Account<'info, UserBalance>,
}

#[derive(Accounts)]
#[instruction(market_id: u64)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub governor: Signer<'info>,
    
    #[account(
        init,
        payer = governor,
        space = 8 + 8 + 32 + 8 + 2 + 8 + 8 + 1 + 1 + 1 + 1,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump
    )]
    pub market: Account<'info, Market>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializePosition<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    
    pub market: Account<'info, Market>,
    
    #[account(
        init,
        payer = trader,
        space = 8 + 32 + 32 + 8 + 8 + 1,
        seeds = [b"position", trader.key().as_ref(), market.key().as_ref()],
        bump
    )]
    pub user_position: Account<'info, UserPosition>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Trade<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    
    #[account(mut)]
    pub market: Account<'info, Market>,
    
    #[account(
        mut,
        seeds = [b"position", trader.key().as_ref(), market.key().as_ref()],
        bump = user_position.bump
    )]
    pub user_position: Account<'info, UserPosition>,
}

#[derive(Accounts)]
pub struct SettleMarket<'info> {
    #[account(mut)]
    pub governor: Signer<'info>,
    
    #[account(
        mut,
        constraint = market.governor == governor.key() @ ErrorCode::Unauthorized
    )]
    pub market: Account<'info, Market>,
}

// ============ Error Codes ============

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Market is not live")]
    MarketNotLive,
    #[msg("Market already settled")]
    MarketAlreadySettled,
    #[msg("Invalid outcome")]
    InvalidOutcome,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Unauthorized")]
    Unauthorized,
}

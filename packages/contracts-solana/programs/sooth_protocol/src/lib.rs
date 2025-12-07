//! Sooth Protocol - Prediction Markets on Solana
//! 
//! LMSR-based prediction markets with trader and governor vaults.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("23pTwMDF5Y9FFjnaqr2411cXVN2qfYmvuHMmsaeHVPmG");

mod lmsr;
use lmsr::{LmsrState, cost_delta, price};

#[program]
pub mod sooth_protocol {
    use super::*;

    /// Initialize trader vault
    pub fn initialize_trader_vault(ctx: Context<InitializeTraderVault>) -> Result<()> {
        let vault = &mut ctx.accounts.trader_vault;
        vault.total_deposits = 0;
        vault.usdc_mint = ctx.accounts.usdc_mint.key();
        vault.bump = ctx.bumps.trader_vault;
        msg!("Trader vault initialized with USDC mint: {}", vault.usdc_mint);
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
        // Transfer USDC from user to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;
        
        // Update user balance
        let user_balance = &mut ctx.accounts.user_balance;
        user_balance.free_balance = user_balance.free_balance
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        
        // Update vault total
        ctx.accounts.trader_vault.total_deposits = ctx.accounts.trader_vault.total_deposits
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        
        msg!("Deposited {} USDC to trader vault", amount);
        Ok(())
    }

    /// Withdraw USDC from trader vault
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let user_balance = &mut ctx.accounts.user_balance;
        require!(user_balance.free_balance >= amount, ErrorCode::InsufficientBalance);
        
        // Transfer USDC from vault to user using PDA signer
        let seeds = &[
            b"trader_vault".as_ref(),
            &[ctx.accounts.trader_vault.bump],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.trader_vault.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, amount)?;
        
        // Update balances
        user_balance.free_balance -= amount;
        ctx.accounts.trader_vault.total_deposits -= amount;
        
        msg!("Withdrew {} USDC from trader vault", amount);
        Ok(())
    }

    /// Create a new prediction market
    pub fn create_market(
        ctx: Context<CreateMarket>,
        market_id: u64,
        b_param: u128,
        fee_bps: u16,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        market.market_id = market_id;
        market.governor = ctx.accounts.governor.key();
        market.b_param = b_param;
        market.fee_bps = fee_bps;
        market.q_yes = 0;
        market.q_no = 0;
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

    /// Execute AMM trade with LMSR pricing
    pub fn trade(
        ctx: Context<Trade>,
        outcome: u8,
        delta_shares: i64,
        max_cost: u64,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let position = &mut ctx.accounts.user_position;
        let user_balance = &mut ctx.accounts.user_balance;
        
        require!(market.is_live && !market.is_settled, ErrorCode::MarketNotLive);
        require!(outcome < 2, ErrorCode::InvalidOutcome);
        require!(delta_shares != 0, ErrorCode::ZeroAmount);
        
        let delta_shares_i128 = delta_shares as i128;
        
        // Use i128 for state
        let state = LmsrState {
            q_yes: market.q_yes,
            q_no: market.q_no,
        };
        
        let (cost, new_state) = cost_delta(state, outcome, delta_shares_i128, market.b_param)?;
        
        // For buys (delta > 0), cost should be positive
        // For sells (delta < 0), cost should be negative (refund)
        let abs_cost = cost.abs() as u64;
        
        // Slippage protection
        require!(abs_cost <= max_cost, ErrorCode::SlippageExceeded);
        
        if delta_shares > 0 {
            // Buying shares - deduct cost from user balance
            require!(
                user_balance.free_balance >= abs_cost,
                ErrorCode::InsufficientBalance
            );
            user_balance.free_balance -= abs_cost;
            
            // Add shares to position
            if outcome == 0 {
                position.yes_balance = position.yes_balance
                    .checked_add(delta_shares as u64)
                    .ok_or(ErrorCode::Overflow)?;
            } else {
                position.no_balance = position.no_balance
                    .checked_add(delta_shares as u64)
                    .ok_or(ErrorCode::Overflow)?;
            }
        } else {
            // Selling shares - add refund to user balance
            let shares_to_sell = (-delta_shares) as u64;
            
            // Check user has enough shares
            if outcome == 0 {
                require!(
                    position.yes_balance >= shares_to_sell,
                    ErrorCode::InsufficientShares
                );
                position.yes_balance -= shares_to_sell;
            } else {
                require!(
                    position.no_balance >= shares_to_sell,
                    ErrorCode::InsufficientShares
                );
                position.no_balance -= shares_to_sell;
            }
            
            // Add refund to balance
            user_balance.free_balance = user_balance.free_balance
                .checked_add(abs_cost)
                .ok_or(ErrorCode::Overflow)?;
        }
        
        // Update market state
        market.q_yes = new_state.q_yes;
        market.q_no = new_state.q_no;
        
        msg!(
            "Trade: outcome={}, delta={}, cost={}, new_qYes={}, new_qNo={}",
            outcome,
            delta_shares,
            cost,
            new_state.q_yes,
            new_state.q_no
        );
        
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

    /// Initialize Governor Vault
    pub fn initialize_governor_vault(
        ctx: Context<InitializeGovernorVault>,
        default_b_base: u128,
        default_fee_bps: u16,
        reserve_factor_bps: u16,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.governor_vault;
        vault.authority = ctx.accounts.authority.key();
        vault.usdc_mint = ctx.accounts.usdc_mint.key();
        vault.total_supply = 0;
        vault.total_assets = 0;
        vault.total_locked_exposure = 0;
        vault.default_b_base = default_b_base;
        vault.default_fee_bps = default_fee_bps;
        vault.reserve_factor_bps = reserve_factor_bps;
        vault.bump = ctx.bumps.governor_vault;
        
        msg!("Governor vault initialized");
        Ok(())
    }

    /// Initialize LP balance account
    pub fn initialize_lp_balance(ctx: Context<InitializeLpBalance>) -> Result<()> {
        let lp_balance = &mut ctx.accounts.lp_balance;
        lp_balance.owner = ctx.accounts.lp.key();
        lp_balance.shares = 0;
        lp_balance.bump = ctx.bumps.lp_balance;
        
        msg!("LP balance initialized");
        Ok(())
    }

    /// LP deposit USDC to governor vault
    pub fn lp_deposit(ctx: Context<LpDeposit>, assets: u64) -> Result<()> {
        require!(assets > 0, ErrorCode::ZeroAmount);
        
        let vault = &mut ctx.accounts.governor_vault;
        let lp_balance = &mut ctx.accounts.lp_balance;
        
        // Calculate shares (ERC4626 style)
        let shares = if vault.total_supply == 0 {
            assets
        } else {
            assets
                .checked_mul(vault.total_supply)
                .ok_or(ErrorCode::Overflow)?
                .checked_div(vault.total_assets)
                .ok_or(ErrorCode::DivisionByZero)?
        };
        
        // Transfer USDC from LP to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.lp_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.lp.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, assets)?;
        
        // Update state
        lp_balance.shares = lp_balance.shares
            .checked_add(shares)
            .ok_or(ErrorCode::Overflow)?;
        vault.total_supply = vault.total_supply
            .checked_add(shares)
            .ok_or(ErrorCode::Overflow)?;
        vault.total_assets = vault.total_assets
            .checked_add(assets)
            .ok_or(ErrorCode::Overflow)?;
        
        msg!("LP deposited {} USDC, received {} shares", assets, shares);
        Ok(())
    }

    /// LP withdraw USDC from governor vault
    pub fn lp_withdraw(ctx: Context<LpWithdraw>, assets: u64) -> Result<()> {
        require!(assets > 0, ErrorCode::ZeroAmount);
        
        // Calculate shares to burn
        let shares = if ctx.accounts.governor_vault.total_assets == 0 {
            assets
        } else {
            assets
                .checked_mul(ctx.accounts.governor_vault.total_supply)
                .ok_or(ErrorCode::Overflow)?
                .checked_div(ctx.accounts.governor_vault.total_assets)
                .ok_or(ErrorCode::DivisionByZero)?
        };
        
        // Check LP has enough shares
        require!(ctx.accounts.lp_balance.shares >= shares, ErrorCode::InsufficientShares);
        
        // Check vault has enough unlocked assets
        let available = ctx.accounts.governor_vault.total_assets
            .checked_sub(ctx.accounts.governor_vault.total_locked_exposure)
            .ok_or(ErrorCode::Underflow)?;
        require!(available >= assets, ErrorCode::LockedFunds);
        
        // Transfer USDC from vault to LP using PDA signer (do this BEFORE mutating state)
        let bump = ctx.accounts.governor_vault.bump;
        let seeds = &[
            b"governor_vault".as_ref(),
            &[bump],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.lp_token_account.to_account_info(),
            authority: ctx.accounts.governor_vault.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, assets)?;
        
        // Update state AFTER transfer
        ctx.accounts.lp_balance.shares -= shares;
        ctx.accounts.governor_vault.total_supply -= shares;
        ctx.accounts.governor_vault.total_assets -= assets;
        
        msg!("LP withdrew {} USDC, burned {} shares", assets, shares);
        Ok(())
    }

    /// Create limit order
    pub fn create_limit_order(
        ctx: Context<CreateLimitOrder>,
        order_id: u64,
        outcome: u8,
        price: u64,
        amount: u64,
    ) -> Result<()> {
        require!(outcome < 2, ErrorCode::InvalidOutcome);
        require!(price > 0 && price < 1_000_000_000_000_000_000, ErrorCode::InvalidPrice); // 0 < price < 1e18
        require!(amount > 0, ErrorCode::ZeroAmount);
        
        let order = &mut ctx.accounts.order;
        order.order_id = order_id;
        order.market = ctx.accounts.market.key();
        order.maker = ctx.accounts.maker.key();
        order.outcome = outcome;
        order.price = price;
        order.amount = amount;
        order.filled = 0;
        order.is_cancelled = false;
        order.timestamp = Clock::get()?.unix_timestamp;
        order.bump = ctx.bumps.order;
        
        // Calculate collateral needed
        let collateral = (price as u128)
            .checked_mul(amount as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(1_000_000_000_000_000_000)
            .ok_or(ErrorCode::DivisionByZero)? as u64;
        
        // Lock collateral in user balance
        let user_balance = &mut ctx.accounts.user_balance;
        require!(user_balance.free_balance >= collateral, ErrorCode::InsufficientBalance);
        user_balance.free_balance -= collateral;
        user_balance.locked_balance = user_balance.locked_balance
            .checked_add(collateral)
            .ok_or(ErrorCode::Overflow)?;
        
        msg!("Created order {} for {} shares at price {}", order_id, amount, price);
        Ok(())
    }

    /// Cancel limit order
    pub fn cancel_order(ctx: Context<CancelOrder>) -> Result<()> {
        let order = &mut ctx.accounts.order;
        require!(!order.is_cancelled, ErrorCode::OrderAlreadyCancelled);
        require!(order.maker == ctx.accounts.maker.key(), ErrorCode::Unauthorized);
        
        let remaining = order.amount - order.filled;
        require!(remaining > 0, ErrorCode::OrderFullyFilled);
        
        // Calculate refund
        let refund = (order.price as u128)
            .checked_mul(remaining as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(1_000_000_000_000_000_000)
            .ok_or(ErrorCode::DivisionByZero)? as u64;
        
        // Unlock collateral
        let user_balance = &mut ctx.accounts.user_balance;
        user_balance.locked_balance -= refund;
        user_balance.free_balance = user_balance.free_balance
            .checked_add(refund)
            .ok_or(ErrorCode::Overflow)?;
        
        order.is_cancelled = true;
        
        msg!("Cancelled order {}, refunded {}", order.order_id, refund);
        Ok(())
    }

    /// Match two orders (manual matching)
    pub fn match_orders(ctx: Context<MatchOrders>) -> Result<()> {
        let order_a = &mut ctx.accounts.order_a;
        let order_b = &mut ctx.accounts.order_b;
        
        // Validate orders are for same market
        require!(order_a.market == order_b.market, ErrorCode::MarketMismatch);
        require!(!order_a.is_cancelled && !order_b.is_cancelled, ErrorCode::OrderCancelled);
        
        // Determine which is buy and which is sell
        // For matching: one wants YES, one wants NO
        require!(order_a.outcome != order_b.outcome, ErrorCode::SameOutcome);
        
        // Check if prices cross
        // For YES buyer and NO buyer: yesPrice + noPrice should >= 1e18
        let total_price = (order_a.price as u128)
            .checked_add(order_b.price as u128)
            .ok_or(ErrorCode::Overflow)?;
        require!(total_price >= 1_000_000_000_000_000_000, ErrorCode::PricesDoNotCross);
        
        // Calculate match amount
        let remaining_a = order_a.amount - order_a.filled;
        let remaining_b = order_b.amount - order_b.filled;
        let match_amount = if remaining_a < remaining_b {
            remaining_a
        } else {
            remaining_b
        };
        
        require!(match_amount > 0, ErrorCode::NoMatchAmount);
        
        // Execute match: complete set creation
        // YES buyer gets YES tokens, NO buyer gets NO tokens
        let (yes_buyer, no_buyer) = if order_a.outcome == 0 {
            (ctx.accounts.maker_a.key(), ctx.accounts.maker_b.key())
        } else {
            (ctx.accounts.maker_b.key(), ctx.accounts.maker_a.key())
        };
        
        // Update positions
        if order_a.outcome == 0 {
            ctx.accounts.position_a.yes_balance = ctx.accounts.position_a.yes_balance
                .checked_add(match_amount)
                .ok_or(ErrorCode::Overflow)?;
            ctx.accounts.position_b.no_balance = ctx.accounts.position_b.no_balance
                .checked_add(match_amount)
                .ok_or(ErrorCode::Overflow)?;
        } else {
            ctx.accounts.position_a.no_balance = ctx.accounts.position_a.no_balance
                .checked_add(match_amount)
                .ok_or(ErrorCode::Overflow)?;
            ctx.accounts.position_b.yes_balance = ctx.accounts.position_b.yes_balance
                .checked_add(match_amount)
                .ok_or(ErrorCode::Overflow)?;
        }
        
        // Update order filled amounts
        order_a.filled = order_a.filled
            .checked_add(match_amount)
            .ok_or(ErrorCode::Overflow)?;
        order_b.filled = order_b.filled
            .checked_add(match_amount)
            .ok_or(ErrorCode::Overflow)?;
        
        msg!("Matched {} shares between orders {} and {}", 
            match_amount, order_a.order_id, order_b.order_id);
        Ok(())
    }
}

// ============ Account Structs ============

#[account]
#[derive(Default)]
pub struct TraderVault {
    pub authority: Pubkey,
    pub usdc_mint: Pubkey,
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
    pub b_param: u128,
    pub fee_bps: u16,
    pub q_yes: i128,
    pub q_no: i128,
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

/// Governor Vault for LP liquidity management
#[account]
pub struct GovernorVault {
    pub authority: Pubkey,
    pub usdc_mint: Pubkey,
    /// Total LP shares issued
    pub total_supply: u64,
    /// Total assets (USDC) in vault
    pub total_assets: u64,
    /// Total exposure locked across all markets
    pub total_locked_exposure: u64,
    /// Default b parameter for new markets
    pub default_b_base: u128,
    /// Default fee in basis points
    pub default_fee_bps: u16,
    /// Reserve factor in basis points
    pub reserve_factor_bps: u16,
    pub bump: u8,
}

/// LP share balance for a user
#[account]
pub struct LpBalance {
    pub owner: Pubkey,
    pub shares: u64,
    pub bump: u8,
}

/// Market exposure tracking
#[account]
pub struct MarketExposure {
    pub market_id: u64,
    pub locked_exposure: u64,
    pub market_reserve: i64, // PnL
    pub bump: u8,
}

/// Limit order
#[account]
pub struct Order {
    pub order_id: u64,
    pub market: Pubkey,
    pub maker: Pubkey,
    pub outcome: u8,        // 0 = YES, 1 = NO
    pub price: u64,         // WAD (1e18 = 100%)
    pub amount: u64,        // Total shares
    pub filled: u64,        // Shares filled
    pub is_cancelled: bool,
    pub timestamp: i64,
    pub bump: u8,
}

// ============ Instruction Contexts ============

#[derive(Accounts)]
pub struct InitializeTraderVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub usdc_mint: Account<'info, token::Mint>,
    
    #[account(
        init,
        payer = authority,
        space = 100, // padded to avoid deserialization issues
        seeds = [b"trader_vault_v2"],
        bump
    )]
    pub trader_vault: Account<'info, TraderVault>,

    #[account(
        init,
        payer = authority,
        seeds = [b"vault_token_account_v2", trader_vault.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = trader_vault,
    )]
    pub vault_token_account: Account<'info, token::TokenAccount>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, token::Token>,
    pub rent: Sysvar<'info, Rent>,
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
    
    #[account(
        mut,
        seeds = [b"trader_vault_v2"],
        bump = trader_vault.bump
    )]
    pub trader_vault: Account<'info, TraderVault>,
    
    #[account(
        mut,
        seeds = [b"user_balance", user.key().as_ref()],
        bump = user_balance.bump
    )]
    pub user_balance: Account<'info, UserBalance>,
    
    #[account(
        mut,
        token::mint = trader_vault.usdc_mint,
        token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"vault_token_account_v2", trader_vault.key().as_ref()],
        bump,
        token::mint = trader_vault.usdc_mint,
        token::authority = trader_vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut, seeds = [b"trader_vault_v2"], bump = trader_vault.bump)]
    pub trader_vault: Account<'info, TraderVault>,
    
    #[account(
        mut,
        seeds = [b"user_balance", user.key().as_ref()],
        bump = user_balance.bump
    )]
    pub user_balance: Account<'info, UserBalance>,
    
    #[account(
        mut,
        token::mint = trader_vault.usdc_mint,
        token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"vault_token_account_v2", trader_vault.key().as_ref()],
        bump,
        token::mint = trader_vault.usdc_mint,
        token::authority = trader_vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(market_id: u64)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub governor: Signer<'info>,
    
    #[account(
        init,
        payer = governor,
        space = 8 + 8 + 32 + 16 + 2 + 16 + 16 + 1 + 1 + 1 + 1, // updated for u128 b_param and i128 qs
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
    
    #[account(
        mut,
        seeds = [b"user_balance", trader.key().as_ref()],
        bump = user_balance.bump
    )]
    pub user_balance: Account<'info, UserBalance>,
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

#[derive(Accounts)]
pub struct InitializeGovernorVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub usdc_mint: Account<'info, token::Mint>,

    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 16 + 2 + 2 + 1, // updated for usdc_mint
        seeds = [b"governor_vault_v2"],
        bump
    )]
    pub governor_vault: Account<'info, GovernorVault>,

    #[account(
        init,
        payer = authority,
        seeds = [b"gv_token_account_v2", governor_vault.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = governor_vault,
    )]
    pub vault_token_account: Account<'info, token::TokenAccount>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, token::Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InitializeLpBalance<'info> {
    #[account(mut)]
    pub lp: Signer<'info>,
    
    #[account(
        init,
        payer = lp,
        space = 8 + 32 + 8 + 1,
        seeds = [b"lp_balance", lp.key().as_ref()],
        bump
    )]
    pub lp_balance: Account<'info, LpBalance>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LpDeposit<'info> {
    #[account(mut)]
    pub lp: Signer<'info>,
    
    #[account(mut, seeds = [b"governor_vault_v2"], bump = governor_vault.bump)]
    pub governor_vault: Account<'info, GovernorVault>,
    
    #[account(
        mut,
        seeds = [b"lp_balance", lp.key().as_ref()],
        bump = lp_balance.bump
    )]
    pub lp_balance: Account<'info, LpBalance>,
    
    #[account(
        mut,
        token::mint = governor_vault.usdc_mint,
        token::authority = lp,
    )]
    pub lp_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"gv_token_account_v2", governor_vault.key().as_ref()],
        bump,
        token::mint = governor_vault.usdc_mint,
        token::authority = governor_vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct LpWithdraw<'info> {
    #[account(mut)]
    pub lp: Signer<'info>,
    
    #[account(mut, seeds = [b"governor_vault_v2"], bump = governor_vault.bump)]
    pub governor_vault: Account<'info, GovernorVault>,
    
    #[account(
        mut,
        seeds = [b"lp_balance", lp.key().as_ref()],
        bump = lp_balance.bump
    )]
    pub lp_balance: Account<'info, LpBalance>,
    
    #[account(
        mut,
        token::mint = governor_vault.usdc_mint,
        token::authority = lp,
    )]
    pub lp_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"gv_token_account_v2", governor_vault.key().as_ref()],
        bump,
        token::mint = governor_vault.usdc_mint,
        token::authority = governor_vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(order_id: u64)]
pub struct CreateLimitOrder<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,
    
    pub market: Account<'info, Market>,
    
    #[account(
        mut,
        seeds = [b"user_balance", maker.key().as_ref()],
        bump = user_balance.bump
    )]
    pub user_balance: Account<'info, UserBalance>,
    
    #[account(
        init,
        payer = maker,
        space = 8 + 8 + 32 + 32 + 1 + 8 + 8 + 8 + 1 + 8 + 1,
        seeds = [b"order", maker.key().as_ref(), order_id.to_le_bytes().as_ref()],
        bump
    )]
    pub order: Account<'info, Order>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelOrder<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"order", maker.key().as_ref(), order.order_id.to_le_bytes().as_ref()],
        bump = order.bump
    )]
    pub order: Account<'info, Order>,
    
    #[account(
        mut,
        seeds = [b"user_balance", maker.key().as_ref()],
        bump = user_balance.bump
    )]
    pub user_balance: Account<'info, UserBalance>,
}

#[derive(Accounts)]
pub struct MatchOrders<'info> {
    #[account(mut)]
    pub order_a: Account<'info, Order>,
    
    #[account(mut)]
    pub order_b: Account<'info, Order>,
    
    /// CHECK: Maker A address
    pub maker_a: UncheckedAccount<'info>,
    
    /// CHECK: Maker B address  
    pub maker_b: UncheckedAccount<'info>,
    
    #[account(
        mut,
        seeds = [b"position", maker_a.key().as_ref(), order_a.market.as_ref()],
        bump = position_a.bump
    )]
    pub position_a: Account<'info, UserPosition>,
    
    #[account(
        mut,
        seeds = [b"position", maker_b.key().as_ref(), order_b.market.as_ref()],
        bump = position_b.bump
    )]
    pub position_b: Account<'info, UserPosition>,
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
    #[msg("Zero delta shares")]
    ZeroDelta,
    #[msg("Slippage exceeded")]
    SlippageExceeded,
    #[msg("Insufficient shares")]
    InsufficientShares,
    #[msg("Zero amount")]
    ZeroAmount,
    #[msg("Division by zero")]
    DivisionByZero,
    #[msg("Arithmetic underflow")]
    Underflow,
    #[msg("Locked funds")]
    LockedFunds,
    #[msg("Invalid price")]
    InvalidPrice,
    #[msg("Order already cancelled")]
    OrderAlreadyCancelled,
    #[msg("Order fully filled")]
    OrderFullyFilled,
    #[msg("Market mismatch")]
    MarketMismatch,
    #[msg("Order cancelled")]
    OrderCancelled,
    #[msg("Same outcome")]
    SameOutcome,
    #[msg("Prices do not cross")]
    PricesDoNotCross,
    #[msg("No match amount")]
    NoMatchAmount,
}

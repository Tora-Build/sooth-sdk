//! State account definitions for Sooth Protocol

use anchor_lang::prelude::*;

pub mod trader_vault;
pub mod governor_vault;
pub mod market;

pub use trader_vault::*;
pub use governor_vault::*;
pub use market::*;

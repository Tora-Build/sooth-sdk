// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

/// @title IOutcomeToken
/// @notice Interface for ERC1155 outcome tokens used by orderbook
interface IOutcomeToken is IERC1155 {
    // ============ Token IDs ============
    
    /// @notice YES token ID
    function YES_TOKEN_ID() external pure returns (uint256);
    
    /// @notice NO token ID  
    function NO_TOKEN_ID() external pure returns (uint256);

    // ============ State ============
    
    /// @notice The market that controls this token
    function market() external view returns (address);
    
    /// @notice The trader vault for merge proceeds
    function traderVault() external view returns (address);

    // ============ Market-Only Functions ============
    
    /// @notice Mint outcome tokens (called by Market on orderbook match)
    /// @param to Recipient address
    /// @param id Token ID (0=YES, 1=NO)
    /// @param amount Amount to mint
    function mint(address to, uint256 id, uint256 amount) external;
    
    /// @notice Burn outcome tokens (called by Market)
    /// @param from Owner address
    /// @param id Token ID (0=YES, 1=NO)
    /// @param amount Amount to burn
    function burn(address from, uint256 id, uint256 amount) external;

    // ============ User Functions ============
    
    /// @notice Merge equal amounts of YES and NO tokens to unlock collateral
    /// @dev Burns both tokens, credits USDC to sender via TraderVault
    /// @param amount Amount of complete sets to merge (in WAD)
    function merge(uint256 amount) external;

    // ============ View Functions ============
    
    /// @notice Get YES token balance for user
    function yesBalance(address user) external view returns (uint256);
    
    /// @notice Get NO token balance for user
    function noBalance(address user) external view returns (uint256);

    /// @notice Get total supply of a specific token ID
    function totalSupply(uint256 id) external view returns (uint256);

    // ============ Events ============
    
    event Merged(address indexed user, uint256 amount);
}

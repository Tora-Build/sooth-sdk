// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Mock USDC token for testnet deployments
 * @dev Uses 18 decimals for WAD compatibility (real USDC uses 6)
 */
contract MockUSDC is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    /**
     * @notice Mint tokens to any address (for testing)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens from any address (for testing)
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }

    /**
     * @notice Returns 18 decimals for WAD compatibility
     * @dev Real USDC uses 6 decimals, but testnet uses 18 for simplicity
     */
    function decimals() public view virtual override returns (uint8) {
        return 18;
    }
}


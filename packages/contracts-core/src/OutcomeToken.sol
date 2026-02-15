// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title OutcomeToken
 * @notice ERC20 token representing a binary outcome (YES or NO)
 * @dev Minted/burned by Collateralizer during split/merge/redeem operations
 */
contract OutcomeToken is ERC20 {
    // ============================================
    // State Variables
    // ============================================

    /// @notice Collateralizer address (can mint/burn)
    address public immutable collateralizer;

    /// @notice Additional authorized minter/burner (e.g., SoothBook)
    address public minter;

    /// @notice Market address this token represents
    address public immutable market;

    /// @notice Outcome index (0 = NO, 1 = YES)
    uint8 public immutable outcome;

    // ============================================
    // Constructor
    // ============================================

    /**
     * @notice Deploy outcome token
     * @param _name Token name (e.g., "Sooth Market #123 - YES")
     * @param _symbol Token symbol (e.g., "SOOTH-123-YES")
     * @param _collateralizer Collateralizer address
     * @param _market Market address
     * @param _outcome Outcome index (0 or 1)
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _collateralizer,
        address _market,
        uint8 _outcome
    ) ERC20(_name, _symbol) {
        require(_collateralizer != address(0), "OutcomeToken: zero collateralizer");
        require(_market != address(0), "OutcomeToken: zero market");
        require(_outcome <= 1, "OutcomeToken: invalid outcome");

        collateralizer = _collateralizer;
        market = _market;
        outcome = _outcome;
    }

    // ============================================
    // Mint/Burn (Collateralizer Only)
    // ============================================

    /**
     * @notice Mint tokens (only collateralizer)
     * @param to Recipient address
     * @param amount Amount to mint (WAD)
     */
    function mint(address to, uint256 amount) external {
        require(msg.sender == collateralizer || msg.sender == minter, "OutcomeToken: unauthorized");
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens (only collateralizer or minter)
     * @param from Address to burn from
     * @param amount Amount to burn (WAD)
     */
    function burn(address from, uint256 amount) external {
        require(msg.sender == collateralizer || msg.sender == minter, "OutcomeToken: unauthorized");
        _burn(from, amount);
    }

    /**
     * @notice Set additional minter (only collateralizer)
     * @param _minter Address to authorize as minter
     */
    function setMinter(address _minter) external {
        require(msg.sender == collateralizer, "OutcomeToken: only collateralizer");
        minter = _minter;
    }
}

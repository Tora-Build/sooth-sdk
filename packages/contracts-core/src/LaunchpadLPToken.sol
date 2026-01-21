// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ITruthMarket} from "./interfaces/ITruthMarket.sol";

/**
 * @title LaunchpadLPToken
 * @notice ERC20 LP token for Sooth launchpad markets
 * @dev V11: Settlement-locked transfers
 *      - Pre-settlement: Tokens are freely transferable (DeFi composability)
 *      - Post-settlement: Transfers are locked to prevent gaming
 *      - Minting/burning always allowed for LaunchpadEngine operations
 */
contract LaunchpadLPToken is ERC20 {
    // ============================================
    // Errors
    // ============================================

    error TransfersLocked();
    error OnlyLaunchpadEngine();
    error ZeroAddress();

    // ============================================
    // Immutables
    // ============================================

    /// @notice The TruthMarket this LP token represents
    address public immutable market;

    /// @notice The LaunchpadEngine that can mint/burn tokens
    address public immutable launchpadEngine;

    // ============================================
    // Constructor
    // ============================================

    /**
     * @param _market The TruthMarket address
     * @param _launchpadEngine The LaunchpadEngine address
     * @param _name Token name (e.g., "Sooth LP: Will ETH hit $10k?")
     * @param _symbol Token symbol (e.g., "sLP-ETH10K")
     */
    constructor(
        address _market,
        address _launchpadEngine,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) {
        if (_market == address(0)) revert ZeroAddress();
        if (_launchpadEngine == address(0)) revert ZeroAddress();

        market = _market;
        launchpadEngine = _launchpadEngine;
    }

    // ============================================
    // Transfer Lock Logic
    // ============================================

    /**
     * @notice Check if transfers are currently unlocked
     * @return True if transfers are allowed (market not yet settled)
     */
    function transfersUnlocked() public view returns (bool) {
        return !ITruthMarket(market).isSettled();
    }

    /**
     * @dev Override _update to enforce transfer lock after settlement
     *      Mints (from == address(0)) and burns (to == address(0)) are always allowed
     *      Transfers between users are only allowed before settlement
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override {
        // Allow mints and burns always
        if (from != address(0) && to != address(0)) {
            // This is a transfer (not mint or burn)
            if (!transfersUnlocked()) revert TransfersLocked();
        }
        super._update(from, to, value);
    }

    // ============================================
    // LaunchpadEngine Functions
    // ============================================

    modifier onlyLaunchpadEngine() {
        if (msg.sender != launchpadEngine) revert OnlyLaunchpadEngine();
        _;
    }

    /**
     * @notice Mint LP tokens to an address
     * @dev Only callable by LaunchpadEngine
     * @param to Recipient address
     * @param amount Amount to mint (WAD)
     */
    function mint(address to, uint256 amount) external onlyLaunchpadEngine {
        _mint(to, amount);
    }

    /**
     * @notice Burn LP tokens from an address
     * @dev Only callable by LaunchpadEngine
     * @param from Address to burn from
     * @param amount Amount to burn (WAD)
     */
    function burn(address from, uint256 amount) external onlyLaunchpadEngine {
        _burn(from, amount);
    }

    // ============================================
    // View Functions
    // ============================================

    /**
     * @notice Get the market question
     * @return The market question string
     */
    function marketQuestion() external view returns (string memory) {
        return ITruthMarket(market).question();
    }

    /**
     * @notice Check if the underlying market is settled
     * @return True if settled
     */
    function isMarketSettled() external view returns (bool) {
        return ITruthMarket(market).isSettled();
    }
}

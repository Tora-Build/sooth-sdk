// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILaunchpadFactory {
    // =========================================================================
    // Events
    // =========================================================================

    /// @notice Emitted when a new market is created via the launchpad
    event MarketCreated(
        address indexed market,
        address indexed creator,
        address indexed lpVault,
        string name,
        string symbol,
        uint256 liquidityTier, // The 'b' value or tier ID
        uint256 depositAmount // USDC amount deposited by creator
    );

    /// @notice Emitted when protocol fees are updated
    event ProtocolFeeConfigUpdated(
        uint256 newInternalFeeBps,
        uint256 newExternalAmmFeeBps,
        uint256 newExternalOrderbookFeeBps
    );

    /// @notice Emitted when protocol fee destination addresses are updated
    event ProtocolAddressesUpdated(
        address indexed newTreasury,
        address indexed newAdjudicator // Or whoever gets the incentive
    );

    // =========================================================================
    // Functions
    // =========================================================================

    /// @notice Creates a new launchpad market
    /// @param name The name of the outcome token
    /// @param symbol The symbol of the outcome token
    /// @param description The market description (IPFS hash or similar)
    /// @param liquidityTierIndex Index of the liquidity tier (0=$100, 1=$1k, 2=$10k, 3=$100k)
    /// @param isOpenEnd Whether the market is open-ended (no expiry) or fixed expiry
    /// @param durationSeconds Duration in seconds (only for fixed-expiry markets)
    /// @return market The address of the deployed LaunchpadMarket
    /// @return lpVault V6: Always returns address(0). Market implements ISoothLiquidityVault itself.
    function createMarket(
        string memory name,
        string memory symbol,
        string memory description,
        uint8 liquidityTierIndex,
        bool isOpenEnd,
        uint40 durationSeconds
    ) external returns (address market, address lpVault);

    /// @notice Returns the required deposit for a given liquidity tier index
    function getRequiredDeposit(uint8 tierIndex) external view returns (uint256);

    /// @notice Returns the 'b' value (liquidity parameter) for a given tier index
    function getLiquidityB(uint8 tierIndex) external view returns (uint256);

    /// @notice Check if an address is a valid market created by this factory
    function isMarket(address market) external view returns (bool);

    /// @notice Returns all created markets
    function getAllMarkets() external view returns (address[] memory);
    
    /// @notice V6: Returns ProtocolConfig address (for immutable Factory)
    function protocolConfig() external view returns (address);
}

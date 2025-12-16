// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISoothMarketV4} from "../interfaces/ISoothMarketV4.sol";
import {ILaunchpadFactory} from "./interfaces/ILaunchpadFactory.sol";
import {ILaunchpadMarket} from "./interfaces/ILaunchpadMarket.sol";
import {IProtocolConfig} from "../core/ProtocolConfig.sol";

/// @title LaunchpadFactory
/// @notice Immutable Factory for deploying Launchpad Markets
/// @dev Built on SoothMarketBase architecture
///      No Ownable, all mutable config moved to ProtocolConfig
contract LaunchpadFactory is ILaunchpadFactory {
    using SafeERC20 for IERC20;

    // =========================================================================
    // Immutable State
    // =========================================================================

    address public immutable marketImplementation;
    address public immutable usdc;
    address public immutable traderVault;
    address public immutable feeController;
    address public immutable outcomeTokenImplementation;
    address public immutable treasury;
    address public immutable adjudicator;
    address public immutable protocolConfig; // V6: ProtocolConfig reference

    // =========================================================================
    // Mutable State
    // =========================================================================

    address[] public allMarkets;
    mapping(address => bool) public isMarket;

    // Liquidity Constants (USDC 6 decimals context)
    // Tier 0: $100 -> b ~ 144
    // Tier 1: $1,000 -> b ~ 1,442
    // Tier 2: $10,000 -> b ~ 14,426
    // Tier 3: $100,000 -> b ~ 144,269
    // M = b * ln(2) ~= b * 0.693147
    // b = M / 0.693147
    
    uint256[4] public tierDeposits;
    uint256[4] public tierBValues;

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor(
        address _marketImplementation,
        address _usdc,
        address _traderVault,
        address _feeController,
        address _outcomeTokenImplementation,
        address _treasury,
        address _adjudicator,
        address _protocolConfig // V6: New parameter
    ) {
        require(_marketImplementation != address(0), "Factory: zero marketImpl");
        require(_usdc != address(0), "Factory: zero usdc");
        require(_traderVault != address(0), "Factory: zero traderVault");
        require(_feeController != address(0), "Factory: zero feeController");
        require(_outcomeTokenImplementation != address(0), "Factory: zero outcomeTokenImpl");
        require(_treasury != address(0), "Factory: zero treasury");
        require(_adjudicator != address(0), "Factory: zero adjudicator");
        require(_protocolConfig != address(0), "Factory: zero protocolConfig");
        
        marketImplementation = _marketImplementation;
        usdc = _usdc;
        traderVault = _traderVault;
        feeController = _feeController;
        outcomeTokenImplementation = _outcomeTokenImplementation;
        treasury = _treasury;
        adjudicator = _adjudicator;
        protocolConfig = _protocolConfig;

        // Initialize Tiers (User pays M, Market gets b)
        // Values in USDC (6 decimals)
        
        // Tier 0: $100
        tierDeposits[0] = 100 * 1e6;
        tierBValues[0] = 144269504 * 1e12; // 100 / ln(2) ~ 144.2695 * 1e18

        // Tier 1: $1,000
        tierDeposits[1] = 1000 * 1e6;
        tierBValues[1] = 1442695040 * 1e12; // 1442.69 * 1e18

        // Tier 2: $10,000
        tierDeposits[2] = 10000 * 1e6;
        tierBValues[2] = 14426950408 * 1e12;

        // Tier 3: $100,000
        tierDeposits[3] = 100000 * 1e6;
        tierBValues[3] = 144269504088 * 1e12;
    }

    // =========================================================================
    // External Functions
    // =========================================================================

    /// @notice V6: Creates a new launchpad market (no lpVault return)
    function createMarket(
        string memory name,
        string memory symbol,
        string memory /* description */,
        uint8 liquidityTierIndex,
        bool isOpenEnd,
        uint40 durationSeconds
    ) external returns (address market, address /* lpVault - V6: not used */) {
        require(liquidityTierIndex < 4, "Factory: invalid tier");
        
        uint256 depositAmount = tierDeposits[liquidityTierIndex];
        uint256 bValue = tierBValues[liquidityTierIndex];

        // 1. Pull funds
        IERC20(usdc).safeTransferFrom(msg.sender, address(this), depositAmount);

        // 2. Deploy Market (Clone)
        market = Clones.clone(marketImplementation);
        
        // 3. V4 Init
        uint256 marketId = allMarkets.length;

        // Deploy OutcomeToken
        address outcomeToken = Clones.clone(outcomeTokenImplementation);
        (bool success, ) = outcomeToken.call(abi.encodeWithSignature("initialize(string,string,address)", name, symbol, market));
        require(success, "Factory: OutcomeToken init failed");
        
        // Market is its own vault (implements ISoothLiquidityVault), so pass address(this) as liquidityVault
        ISoothMarketV4(market).initialize(
            marketId,
            address(market), // Market is its own vault
            traderVault,
            feeController,
            outcomeToken,
            bytes32(uint256(uint160(adjudicator))),
            bValue,
            msg.sender, // Creator is the operator (marketOperator = creator)
            0, // Initial Q (50/50 probability)
            0
        );
        
        // 4. Launchpad Specific Init
        uint40 deadline = uint40(block.timestamp + durationSeconds);
        if (isOpenEnd) deadline = type(uint40).max;

        // Transfer deposit to market (Market holds USDC directly)
        IERC20(usdc).safeTransfer(market, depositAmount);

        try ILaunchpadMarket(market).initializeLaunchpad(
            msg.sender,
            liquidityTierIndex,
            deadline,
            address(0), // No lpVault (market is its own vault)
            depositAmount,
            usdc // Asset address
        ) {} catch {
            revert("Factory: Launchpad init failed");
        }

        // 5. Register
        allMarkets.push(market);
        isMarket[market] = true;

        emit MarketCreated(market, msg.sender, address(0), name, symbol, bValue, depositAmount);
        
        // Return market only (no lpVault - market is its own vault)
        return (market, address(0));
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    function getRequiredDeposit(uint8 tierIndex) external view returns (uint256) {
        if (tierIndex >= 4) return 0;
        return tierDeposits[tierIndex];
    }
    
    function getLiquidityB(uint8 tierIndex) external view returns (uint256) {
        if (tierIndex >= 4) return 0;
        return tierBValues[tierIndex];
    }

    function getAllMarkets() external view returns (address[] memory) {
        return allMarkets;
    }
}

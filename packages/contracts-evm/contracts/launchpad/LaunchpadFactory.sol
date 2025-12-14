// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISoothMarketV4} from "../interfaces/ISoothMarketV4.sol";

import {ILaunchpadFactory} from "./interfaces/ILaunchpadFactory.sol";
import {ILaunchpadMarket} from "./interfaces/ILaunchpadMarket.sol";
import {MarketLPVault} from "./MarketLPVault.sol";

/// @title LaunchpadFactory
/// @notice Factory for deploying Sooth Launchpad Markets.
contract LaunchpadFactory is Ownable, ILaunchpadFactory {
    using SafeERC20 for IERC20;

    // =========================================================================
    // State
    // =========================================================================

    address public immutable marketImplementation;
    address public immutable usdc;
    address public immutable traderVault;
    address public immutable governorVault; // For config/fallback
    address public immutable feeController;
    address public immutable outcomeTokenImplementation; // Assuming one per market? Or shared? V4 uses one per market.

    address[] public allMarkets;
    mapping(address => bool) public isMarket;

    // Protocol config
    address public treasury;
    address public adjudicator; // Default adjudicator for new markets (e.g. Brevis)

    // Liquidity Constants (USDC 6 decimals context)
    // Tier 0: $100 -> b ~ 144
    // Tier 1: $1,000 -> b ~ 1,442
    // Tier 2: $10,000 -> b ~ 14,426
    // Tier 3: $100,000 -> b ~ 144,269
    // M = b * ln(2) ~= b * 0.693147
    // b = M / 0.693147
    
    // We store required deposits (M) for each tier.
    uint256[4] public tierDeposits;
    uint256[4] public tierBValues;

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor(
        address _marketImplementation,
        address _usdc,
        address _traderVault,
        address _governorVault,
        address _feeController,
        address _outcomeTokenImplementation,
        address _treasury,
        address _adjudicator
    ) Ownable(msg.sender) {
        marketImplementation = _marketImplementation;
        usdc = _usdc;
        traderVault = _traderVault;
        governorVault = _governorVault;
        feeController = _feeController;
        outcomeTokenImplementation = _outcomeTokenImplementation;
        treasury = _treasury;
        adjudicator = _adjudicator;

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

    function createMarket(
        string memory name,
        string memory symbol,
        string memory description,
        uint8 liquidityTierIndex,
        bool isOpenEnd,
        uint40 durationSeconds
    ) external override returns (address market, address lpVault) {
        require(liquidityTierIndex < 4, "Factory: invalid tier");
        
        uint256 depositAmount = tierDeposits[liquidityTierIndex];
        uint256 bValue = tierBValues[liquidityTierIndex];

        // 1. Pull funds
        IERC20(usdc).safeTransferFrom(msg.sender, address(this), depositAmount);

        // 2. Predict Market Address (for LPVault market param)
        // Actually, we can't easily predict clone address without salt.
        // We act as the transient owner of LPVault, then transfer to market.
        
        // 3. Deploy Market (Clone)
        market = Clones.clone(marketImplementation);
        
        // 4. Deploy LPVault (Standard deploy, not clone, for simplicity unless gas is concern)
        // Creating new contract is ~32k gas + code. LPVault is small.
        // pass 'market' address.
        MarketLPVault vault = new MarketLPVault(
            string(abi.encodePacked("Sooth LP: ", name)),
            string(abi.encodePacked("SLP-", symbol)),
            market,
            usdc,
            address(this) // Factory is initial owner
        );
        lpVault = address(vault);
        
        // Transfer initial liquidity to Vault
        IERC20(usdc).safeTransfer(lpVault, depositAmount);

        // V4 Init
        // Note: governorVault argument is ignored by LaunchpadMarket override, but we must pass something.
        uint256 marketId = allMarkets.length;

        // TODO: Ensure TraderVault allows this Market (Whitelist)
        // Critical: In prod, Factory or Admin must trust this market for trading to work.
        // Deploy OutcomeToken
        address outcomeToken = Clones.clone(outcomeTokenImplementation);
        (bool success, ) = outcomeToken.call(abi.encodeWithSignature("initialize(string,string,address)", name, symbol, market));
        require(success, "Factory: OutcomeToken init failed");
        
        ISoothMarketV4(market).initialize(
            marketId,
            lpVault, // governorVault arg (market overrides it anyway, but passing lpVault is semantic)
            traderVault,
            feeController,
            outcomeToken,
            bytes32(uint256(uint160(adjudicator))), // Adjudicator ID (cast address to bytes32)
            bValue,
            msg.sender, // governor (creator? or factory? let's make creator the governor for manual updates?)
            // Initial Q (50/50 probability, cost = 0 if q=0?).
            // If qYes=qNo=0, price is 0.5.
            0,
            0
        );
        
        // Launchpad Specific Init
        
        // Compute deadline
        uint40 deadline = uint40(block.timestamp + durationSeconds);
        if (isOpenEnd) deadline = type(uint40).max;

        try ILaunchpadMarket(market).initializeLaunchpad(
            msg.sender,
            liquidityTierIndex,
            deadline,
            lpVault,
            depositAmount
        ) {} catch {
            revert("Factory: Launchpad init failed");
        }

        // 6. Transfer LPVault ownership to Market
        vault.transferOwnership(market);

        // 7. Register
        allMarkets.push(market);
        isMarket[market] = true;

        emit MarketCreated(market, msg.sender, lpVault, name, symbol, bValue, depositAmount);
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    function getRequiredDeposit(uint8 tierIndex) external view override returns (uint256) {
        if (tierIndex >= 4) return 0;
        return tierDeposits[tierIndex];
    }
    
    function getLiquidityB(uint8 tierIndex) external view override returns (uint256) {
        if (tierIndex >= 4) return 0;
        return tierBValues[tierIndex];
    }

    function getAllMarkets() external view override returns (address[] memory) {
        return allMarkets;
    }
}

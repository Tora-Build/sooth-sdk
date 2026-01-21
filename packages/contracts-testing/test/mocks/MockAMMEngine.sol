// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAMMEngine} from "@core/interfaces/IAMMEngine.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockAMMEngine
 * @notice Mock AMM for V11 LaunchpadEngine testing
 */
contract MockAMMEngine is IAMMEngine {
    address public override router;
    IERC20 public usdc;

    struct Market {
        bool initialized;
        uint256 liquidity;
        uint256 qYes;
        uint256 qNo;
    }

    struct UserPosition {
        uint256 yesShares;
        uint256 noShares;
    }

    struct UserBalance {
        uint256 available;
        uint256 locked;
    }

    mapping(address => Market) public markets;
    mapping(address => mapping(address => UserPosition)) public positions;
    mapping(address => UserBalance) public balances;
    mapping(address => LockEntry[]) public lockQueues;

    uint256 constant WAD = 1e18;

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    // ============================================
    // Test Setup
    // ============================================

    function setRouter(address _router) external override {
        router = _router;
        emit RouterUpdated(_router);
    }

    function setBalance(address user, uint256 available, uint256 locked) external {
        balances[user] = UserBalance(available, locked);
    }

    function setPosition(address market, address user, uint256 yesShares, uint256 noShares) external {
        positions[market][user] = UserPosition(yesShares, noShares);
    }

    // ============================================
    // IAMMEngine Implementation
    // ============================================

    function initializeMarket(address market, uint256 initialLiquidity) external override {
        markets[market] = Market({
            initialized: true,
            liquidity: initialLiquidity,
            qYes: 0,
            qNo: 0
        });
        emit MarketInitialized(market, initialLiquidity);
    }

    function tradePositions(
        address market,
        uint8 outcome,
        int256 deltaShares,
        uint256 maxCostOrMinProceeds
    ) external override returns (uint256 actualCost) {
        return _trade(msg.sender, market, outcome, deltaShares, maxCostOrMinProceeds, 0);
    }

    function tradePositionsFor(
        address user,
        address market,
        uint8 outcome,
        int256 deltaShares,
        uint256 maxCostOrMinProceeds,
        uint256 // fee (ignored in mock)
    ) external override returns (uint256 actualCost) {
        require(msg.sender == router, "MockAMMEngine: not router");
        return _trade(user, market, outcome, deltaShares, maxCostOrMinProceeds, 0);
    }

    function _trade(
        address user,
        address market,
        uint8 outcome,
        int256 deltaShares,
        uint256, // maxCostOrMinProceeds
        uint256 // fee
    ) internal returns (uint256 actualCost) {
        require(markets[market].initialized, "MockAMMEngine: market not initialized");

        UserPosition storage pos = positions[market][user];

        if (deltaShares > 0) {
            // Buy
            uint256 shares = uint256(deltaShares);
            if (outcome == 0) {
                pos.noShares += shares;
                markets[market].qNo += shares;
            } else {
                pos.yesShares += shares;
                markets[market].qYes += shares;
            }
            // Mock cost calculation (simple linear for testing)
            actualCost = shares / 2;
        } else {
            // Sell
            uint256 shares = uint256(-deltaShares);
            if (outcome == 0) {
                require(pos.noShares >= shares, "MockAMMEngine: insufficient NO shares");
                pos.noShares -= shares;
                markets[market].qNo -= shares;
            } else {
                require(pos.yesShares >= shares, "MockAMMEngine: insufficient YES shares");
                pos.yesShares -= shares;
                markets[market].qYes -= shares;
            }
            // Mock proceeds
            actualCost = shares / 2;

            // Lock proceeds
            balances[user].available += actualCost;
            balances[user].locked += actualCost;
        }

        emit PositionTraded(
            user,
            market,
            outcome,
            deltaShares,
            actualCost,
            markets[market].qYes,
            markets[market].qNo
        );
    }

    function increaseLiquidity(address market, uint256 deltaLiquidity) external override {
        require(msg.sender == router, "MockAMMEngine: not router");
        markets[market].liquidity += deltaLiquidity;
        emit LiquidityIncreased(market, deltaLiquidity, markets[market].liquidity);
    }

    function getPositionQuote(
        address, // market
        uint8, // outcome
        int256 deltaShares
    ) external pure override returns (uint256 cost, uint256 newPrice) {
        // Simple mock: cost is half of shares
        if (deltaShares > 0) {
            cost = uint256(deltaShares) / 2;
        } else {
            cost = uint256(-deltaShares) / 2;
        }
        newPrice = 0.5e18; // Mock 50% probability
    }

    function getPosition(address market, address user)
        external
        view
        override
        returns (uint256 yesShares, uint256 noShares)
    {
        UserPosition memory pos = positions[market][user];
        return (pos.yesShares, pos.noShares);
    }

    function claimUnlocked(uint256) external override returns (uint256 totalUnlocked) {
        UserBalance storage bal = balances[msg.sender];
        totalUnlocked = bal.locked;
        bal.locked = 0;
        if (totalUnlocked > 0) {
            usdc.transfer(msg.sender, totalUnlocked);
        }
    }

    function getBalances(address user)
        external
        view
        override
        returns (uint256 available, uint256 locked)
    {
        UserBalance memory bal = balances[user];
        return (bal.available, bal.locked);
    }

    function getLockQueue(address user)
        external
        view
        override
        returns (LockEntry[] memory)
    {
        return lockQueues[user];
    }

    function spendBalanceFor(address user, uint256 amount)
        external
        override
        returns (uint256 spent)
    {
        require(msg.sender == router, "MockAMMEngine: not router");
        UserBalance storage bal = balances[user];
        spent = amount > bal.available ? bal.available : amount;
        bal.available -= spent;
        if (bal.locked > spent) {
            bal.locked -= spent;
        } else {
            bal.locked = 0;
        }
    }

    function getClaimableAmount(address user)
        external
        view
        override
        returns (uint256 claimable, uint64 nextUnlock, uint256 nextAmount)
    {
        return (balances[user].locked, 0, 0);
    }

    function getMarketState(address market)
        external
        view
        override
        returns (uint256 qYes, uint256 qNo, uint256 price)
    {
        Market memory m = markets[market];
        return (m.qYes, m.qNo, 0.5e18);
    }

    function getLiquidity(address market) external view override returns (uint256) {
        return markets[market].liquidity;
    }

    function settlePosition(address) external pure override returns (uint256) {
        return 0;
    }
}

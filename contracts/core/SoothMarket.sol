// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SoothInterfaces.sol";

/// @notice Infinite-end YES/NO market using a pluggable AMM and dynamic b.
/// @dev For MVP this can use SoothBalancedAMM; later you can point new markets
///      at SoothLMSRReal without changing this contract.
contract SoothMarket is Ownable {
    ISoothVault public vault;
    IRiskManager public riskManager;
    ISoothAMM public amm;

    uint256 public marketId;
    bytes32 public adjudicatorId;

    bool public isLive;
    bool public isSettled;

    uint8 public winningOutcome;
    uint64 public truthTime; // T*

    ISoothAMM.State public ammState; // qYes, qNo

    mapping(address => uint256) public yesBalance;
    mapping(address => uint256) public noBalance;

    event Initialized(
        uint256 indexed marketId,
        address vault,
        address riskManager,
        address amm,
        bytes32 adjudicatorId
    );
    event Trade(address indexed trader, uint8 outcomeIndex, int256 deltaShares, int256 cost);
    event Settled(uint8 winningOutcome, uint64 truthTime);

    constructor() {}

    function initialize(
        uint256 _marketId,
        ISoothVault _vault,
        IRiskManager _riskManager,
        ISoothAMM _amm,
        bytes32 _adjudicatorId
    ) external onlyOwner {
        require(address(vault) == address(0), "Market: already init");
        vault = _vault;
        riskManager = _riskManager;
        amm = _amm;
        adjudicatorId = _adjudicatorId;
        marketId = _marketId;
        isLive = true;

        emit Initialized(_marketId, address(_vault), address(_riskManager), address(_amm), _adjudicatorId);
    }

    modifier onlyLive() {
        require(isLive && !isSettled, "Market: not live");
        _;
    }

    /// @notice outcomeIndex: 0 = YES, 1 = NO
    /// @param deltaShares > 0 to buy, < 0 to sell.
    /// @param maxCost Maximum cost willing to pay (buy) or minimum proceeds to receive (sell).
    ///                For buys: positive value representing max tokens to spend.
    ///                For sells: negative value representing min tokens to receive.
    function trade(uint8 outcomeIndex, int256 deltaShares, int256 maxCost) external onlyLive {
        require(deltaShares != 0, "Market: zero trade");

        // spot-style restriction: no synthetic shorts – must own before selling
        if (deltaShares < 0) {
            uint256 shares = uint256(-deltaShares);
            if (outcomeIndex == 0) {
                require(yesBalance[msg.sender] >= shares, "Market: not enough YES");
                yesBalance[msg.sender] -= shares;
            } else {
                require(noBalance[msg.sender] >= shares, "Market: not enough NO");
                noBalance[msg.sender] -= shares;
            }
        }

        uint256 b = riskManager.getBForMarket(marketId);

        (int256 cost, ISoothAMM.State memory newState) =
            amm.costDelta(ammState, outcomeIndex, deltaShares, b);

        // Slippage protection
        // Algebraic check works for both:
        // - Buys (cost > 0): cost <= maxCost (don't pay more than max)
        // - Sells (cost < 0): cost <= maxCost (e.g. -100 <= -98, means receive at least 98)
        require(cost <= maxCost, "Market: slippage exceeded");

        // Positive cost: trader pays vault; negative cost: vault pays trader.
        IERC20 collateral = vault.asset();
        if (cost > 0) {
            uint256 pay = uint256(cost);
            collateral.transferFrom(msg.sender, address(vault), pay);
        } else if (cost < 0) {
            // Vault pays trader (pnlDelta = -cost > 0)
            // We use applySettlementDelta which handles transfers from vault to user
            vault.applySettlementDelta(msg.sender, -cost);
        }

        ammState = newState;

        if (deltaShares > 0) {
            uint256 shares = uint256(deltaShares);
            if (outcomeIndex == 0) {
                yesBalance[msg.sender] += shares;
            } else {
                noBalance[msg.sender] += shares;
            }
        }

        emit Trade(msg.sender, outcomeIndex, deltaShares, cost);
    }

    /// @notice Internal hook for settlement to mark the market as settled.
    function markSettled(uint8 _winningOutcome, uint64 _truthTime) external onlyOwner {
        require(!isSettled, "Market: already settled");
        isSettled = true;
        isLive = false;
        winningOutcome = _winningOutcome;
        truthTime = _truthTime;
        emit Settled(_winningOutcome, _truthTime);
    }
}

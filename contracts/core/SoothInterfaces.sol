// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal ERC20 interface for Sooth core contracts.
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address who) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @notice Singleton vault interface used by markets, risk manager, settlement and smart accounts.
interface ISoothVault {
    function asset() external view returns (IERC20);
    function totalAssets() external view returns (uint256);
    function getTreasuryBalance() external view returns (uint256);
    function getLiquidBufferBalance() external view returns (uint256);

    function depositFor(address lp, uint256 assets) external returns (uint256);
    function withdrawFor(address lp, uint256 assets, address receiver) external returns (uint256);

    function allocateExposure(uint256 marketId, uint256 amount) external;
    function releaseExposure(uint256 marketId, uint256 amount) external;

    function applySettlementDelta(address account, int256 pnlDelta) external;
}

/// @notice AMM interface. Concrete curves (Balanced CFMM, LMSR) implement this.
interface ISoothAMM {
    struct State {
        int256 qYes;
        int256 qNo;
    }

    /// @notice Returns cost (can be negative) and updated state for a trade.
    function costDelta(
        State memory s,
        uint8 outcomeIndex,
        int256 deltaShares,
        uint256 b
    ) external pure returns (int256 cost, State memory newState);

    /// @notice Returns current price for the given outcome in 1e18 fixed point.
    function price(
        State memory s,
        uint8 outcomeIndex,
        uint256 b
    ) external pure returns (uint256 priceWad);
}

/// @notice Risk manager interface – markets query dynamic b_market from this.
interface IRiskManager {
    function getBForMarket(uint256 marketId) external view returns (uint256);
}

/// @notice Adjudicator registry interface – settlement queries config for adjudication.
interface ISoothAdjudicatorRegistry {
    function getAdjudicator(bytes32 id)
        external
        view
        returns (uint8 cls, address externalContract, bytes memory params, bool enabled);
}

/// @notice Simple Ownable base used by most Sooth contracts in this reference.
abstract contract Ownable {
    address public owner;

    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "OWNABLE: not owner");
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "OWNABLE: zero");
        owner = newOwner;
        emit OwnershipTransferred(msg.sender, newOwner);
    }
}

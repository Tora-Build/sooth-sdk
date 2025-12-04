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

/// @notice ERC20 metadata interface for reading token decimals.
interface IERC20Metadata is IERC20 {
    function decimals() external view returns (uint8);
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
}

/// @notice Governor Vault interface for LP liquidity management.
interface ISoothGovernorVault {
    function asset() external view returns (IERC20);
    function totalAssets() external view returns (uint256);
    function decimalsScale() external view returns (uint256);

    // LP Actions
    function depositFor(address lp, uint256 assets) external returns (uint256);
    function withdrawFor(address lp, uint256 assets, address receiver) external returns (uint256);

    // Market Actions
    function allocateExposure(uint256 marketId, uint256 amount) external;
    function releaseExposure(uint256 marketId, uint256 amount) external;

    /// @notice Called by Market when it (or TraderVault) sends funds to Governor.
    function receiveFunds(uint256 marketId, uint256 amount) external;

    /// @notice Called by Market to request payment from Governor to recipient.
    function sendFunds(uint256 marketId, address recipient, uint256 amount) external;

    function getMarketReserve(uint256 marketId) external view returns (int256);
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

/// @notice Fee controller interface - Guardian-controlled global fees.
interface ISoothFeeController {
    function orderbookFee() external view returns (uint256);
    function lpSplitBps() external view returns (uint256);
    function treasury() external view returns (address);
    function calculateOrderbookFees(uint256 volume) external view returns (uint256 lpFee, uint256 treasuryFee);
}

/// @notice Adjudicator registry interface – settlement queries config for adjudication.
interface ISoothAdjudicatorRegistry {
    function getAdjudicator(bytes32 id)
        external
        view
        returns (uint8 cls, address externalContract, bytes memory params, bool enabled);
}

/// @notice Order struct for the on-chain orderbook.
struct Order {
    uint256 id;
    address maker;
    uint8 outcome; // 0 = YES, 1 = NO
    uint256 price; // 1e18 fixed point
    uint256 amount; // Remaining size
    uint256 timestamp;
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

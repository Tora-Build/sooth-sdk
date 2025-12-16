// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

// ISoothLiquidityVault interface - moved to separate file to avoid Ownable conflicts
// Import it here for backward compatibility
import "./ISoothLiquidityVault.sol";

/// @notice AMM interface. Concrete curves (Balanced CFMM, LMSR) implement this.
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

/// @notice Simple Ownable base used by legacy Sooth contracts.
/// @dev NOTE: New contracts should use OpenZeppelin's Ownable to avoid conflicts.
///      This is kept for backward compatibility with existing contracts.
abstract contract SoothOwnable {
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

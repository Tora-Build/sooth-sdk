// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SoothInterfaces.sol";

/// @notice Global fee settings controlled by Protocol Guardian.
/// @dev Markets reference this contract for unified orderbook fees.
contract SoothFeeController is Ownable {
    /// @notice Unified orderbook fee for all markets (basis points, e.g., 10 = 0.1%)
    uint256 public orderbookFee;
    
    /// @notice Fee distribution: percentage to LP pool (rest goes to treasury)
    uint256 public lpSplitBps;
    
    /// @notice Treasury address for protocol fees
    address public treasury;
    
    uint256 public constant MAX_BPS = 10000;
    uint256 public constant MAX_ORDERBOOK_FEE = 200; // Max 2%
    
    event OrderbookFeeSet(uint256 newFeeBps);
    event LpSplitSet(uint256 newSplitBps);
    event TreasurySet(address newTreasury);
    
    constructor(address _treasury) {
        treasury = _treasury;
        orderbookFee = 10;   // Default 0.1%
        lpSplitBps = 5000;   // Default 50% to LPs
    }
    
    /// @notice Set unified orderbook fee (Guardian only)
    /// @param _feeBps Fee in basis points (e.g., 10 = 0.1%)
    function setOrderbookFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_ORDERBOOK_FEE, "FeeController: fee too high");
        orderbookFee = _feeBps;
        emit OrderbookFeeSet(_feeBps);
    }
    
    /// @notice Set LP split percentage (Guardian only)
    /// @param _splitBps Percentage to LP pool (e.g., 5000 = 50%)
    function setLpSplit(uint256 _splitBps) external onlyOwner {
        require(_splitBps <= MAX_BPS, "FeeController: invalid split");
        lpSplitBps = _splitBps;
        emit LpSplitSet(_splitBps);
    }
    
    /// @notice Set treasury address (Guardian only)
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "FeeController: zero address");
        treasury = _treasury;
        emit TreasurySet(_treasury);
    }
    
    /// @notice Calculate fee amounts for a given trade volume
    /// @param volume Trade volume in USDC
    /// @return lpFee Amount going to LP pool
    /// @return treasuryFee Amount going to treasury
    function calculateOrderbookFees(uint256 volume) external view returns (uint256 lpFee, uint256 treasuryFee) {
        uint256 totalFee = (volume * orderbookFee) / MAX_BPS;
        lpFee = (totalFee * lpSplitBps) / MAX_BPS;
        treasuryFee = totalFee - lpFee;
    }
}

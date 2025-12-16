// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ProtocolConfig
/// @notice Mutable protocol-wide configuration for V6 Launchpad
/// @dev Separated from immutable Factory to allow protocol parameter updates
interface IProtocolConfig {
    function liquidationFeeBps() external view returns (uint256);
    function guardian() external view returns (address);
}

/// @title ProtocolConfig
/// @notice Stores mutable protocol parameters for V6 Launchpad
contract ProtocolConfig is Ownable, IProtocolConfig {
    // =========================================================================
    // State
    // =========================================================================

    uint256 public override liquidationFeeBps;
    address public override guardian;

    // =========================================================================
    // Events
    // =========================================================================

    event LiquidationFeeBpsUpdated(uint256 oldFee, uint256 newFee);
    event GuardianUpdated(address oldGuardian, address newGuardian);

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor(address _guardian, uint256 _liquidationFeeBps) Ownable(msg.sender) {
        require(_guardian != address(0), "ProtocolConfig: zero guardian");
        require(_liquidationFeeBps <= 10000, "ProtocolConfig: fee > 100%");
        
        guardian = _guardian;
        liquidationFeeBps = _liquidationFeeBps;
        
        emit GuardianUpdated(address(0), _guardian);
        emit LiquidationFeeBpsUpdated(0, _liquidationFeeBps);
    }

    // =========================================================================
    // Admin Functions
    // =========================================================================

    function setLiquidationFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 10000, "ProtocolConfig: fee > 100%");
        
        uint256 oldFee = liquidationFeeBps;
        liquidationFeeBps = _feeBps;
        
        emit LiquidationFeeBpsUpdated(oldFee, _feeBps);
    }

    function setGuardian(address _guardian) external onlyOwner {
        require(_guardian != address(0), "ProtocolConfig: zero guardian");
        
        address oldGuardian = guardian;
        guardian = _guardian;
        
        emit GuardianUpdated(oldGuardian, _guardian);
    }
}

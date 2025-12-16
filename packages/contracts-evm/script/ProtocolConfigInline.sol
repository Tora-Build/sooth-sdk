// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IProtocolConfigInline {
    function liquidationFeeBps() external view returns (uint256);
    function guardian() external view returns (address);
}

contract ProtocolConfigInline is Ownable, IProtocolConfigInline {
    uint256 public override liquidationFeeBps;
    address public override guardian;
    
    constructor(address _guardian, uint256 _liquidationFeeBps) Ownable(msg.sender) {
        guardian = _guardian;
        liquidationFeeBps = _liquidationFeeBps;
    }
    
    function setLiquidationFeeBps(uint256 _feeBps) external onlyOwner {
        liquidationFeeBps = _feeBps;
    }
    
    function setGuardian(address _guardian) external onlyOwner {
        guardian = _guardian;
    }
}

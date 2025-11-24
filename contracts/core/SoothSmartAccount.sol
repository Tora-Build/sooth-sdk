// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SoothVault.sol";
import "./SoothMarket.sol";

contract SoothSmartAccount {
    SoothVault public immutable vault;
    address public immutable owner;

    uint256 public cooldownUntil;

    modifier onlyOwner() {
        require(msg.sender == owner, "SoothSmartAccount: not owner");
        _;
    }

    constructor(address _vault, address _owner) {
        require(_vault != address(0), "zero vault");
        require(_owner != address(0), "zero owner");
        vault = SoothVault(_vault);
        owner = _owner;
    }

    function deposit(uint256 amount) external onlyOwner {
        vault.depositUser(amount);
    }

    function withdraw(uint256 amount) external onlyOwner {
        require(block.timestamp >= cooldownUntil, "cooldown");
        vault.withdrawUser(amount);
    }

    function startCooldown(uint256 duration) external onlyOwner {
        cooldownUntil = block.timestamp + duration;
    }

    function trade(
        address market,
        bool isBuy,
        uint8 outcomeIndex,
        uint256 shares
    ) external onlyOwner {
        if (isBuy) {
            SoothMarket(market).buy(outcomeIndex, shares);
        } else {
            SoothMarket(market).sell(outcomeIndex, shares);
        }
    }
}

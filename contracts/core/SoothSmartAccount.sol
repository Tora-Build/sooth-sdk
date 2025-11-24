// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SoothVault.sol";
import "./SoothMarket.sol";

/// @title SoothSmartAccount - per-user account wrapper with optional cooldown
/// @notice This is an optional helper; users can still interact directly with SoothVault/SoothMarket.
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

    /// @notice Deposit collateral into the underlying SoothVault as user balance.
    function deposit(uint256 amount) external onlyOwner {
        vault.depositUser(amount);
    }

    /// @notice Withdraw from SoothVault user balance, respecting cooldown.
    function withdraw(uint256 amount) external onlyOwner {
        require(block.timestamp >= cooldownUntil, "cooldown");
        vault.withdrawUser(amount);
    }

    /// @notice Enter a cooldown period (e.g. to quit markets safely).
    function startCooldown(uint256 duration) external onlyOwner {
        cooldownUntil = block.timestamp + duration;
    }

    /// @notice Proxy a trade into a given market.
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

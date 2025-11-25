// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SoothVault.sol";
import "./SoothMarket.sol";
import "../stubs/IERC20Upgradeable.sol";

/// @title SoothSmartAccount
/// @notice Minimal account abstraction-style wrapper around SoothVault and SoothMarket.
///         - Custodies collateral on behalf of a single owner.
///         - Moves tokens between owner <-> vault explicitly.
///         - Enforces a configurable withdrawal cooldown.
contract SoothSmartAccount {
    SoothVault public immutable vault;
    IERC20Upgradeable public immutable collateral;
    address public immutable owner;

    uint256 public cooldownUntil;

    modifier onlyOwner() {
        require(msg.sender == owner, "SoothSmartAccount: not owner");
        _;
    }

    constructor(address _vault, address _owner) {
        require(_vault != address(0), "SoothSmartAccount: zero vault");
        require(_owner != address(0), "SoothSmartAccount: zero owner");
        vault = SoothVault(_vault);
        owner = _owner;
        collateral = IERC20Upgradeable(address(vault.collateral()));
    }

    /// @notice Owner can set (or extend) the cooldown end timestamp.
    function setCooldown(uint256 newCooldownUntil) external onlyOwner {
        require(newCooldownUntil >= block.timestamp, "SoothSmartAccount: past time");
        cooldownUntil = newCooldownUntil;
    }

    /// @notice Pull tokens from the owner and deposit into the SoothVault under this account.
    /// @dev Owner must have approved this contract on the collateral token.
    function deposit(uint256 amount) external onlyOwner {
        require(amount > 0, "SoothSmartAccount: zero amount");
        require(
            collateral.transferFrom(owner, address(this), amount),
            "SoothSmartAccount: transferFrom failed"
        );
        collateral.approve(address(vault), amount);
        vault.depositUser(amount);
    }

    /// @notice Withdraw from the vault back to the owner, respecting cooldown.
    function withdraw(uint256 amount) external onlyOwner {
        require(block.timestamp >= cooldownUntil, "SoothSmartAccount: cooldown");
        require(amount > 0, "SoothSmartAccount: zero amount");

        // Pull from vault into this smart account
        vault.withdrawUser(amount);

        // Forward to owner
        require(
            collateral.transfer(owner, amount),
            "SoothSmartAccount: transfer failed"
        );
    }

    /// @notice Execute a trade on a SoothMarket using this account's vault balance.
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

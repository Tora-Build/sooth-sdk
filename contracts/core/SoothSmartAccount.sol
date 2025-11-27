// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SoothInterfaces.sol";
import "./SoothMarket.sol";

/// @notice Minimal smart account wrapper for Sooth.
/// @dev Holds collateral in the vault on behalf of an owner and can trade in markets.
contract SoothSmartAccount {
    ISoothVault public immutable vault;
    IERC20 public immutable collateral;
    address public immutable owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "SmartAccount: not owner");
        _;
    }

    constructor(ISoothVault _vault, address _owner) {
        vault = _vault;
        collateral = _vault.asset();
        owner = _owner;
    }

    /// @notice Move collateral from owner into the vault under this account.
    function enterVault(uint256 amount) external onlyOwner {
        require(amount > 0, "SmartAccount: zero");
        collateral.transferFrom(owner, address(this), amount);
        collateral.approve(address(vault), amount);
        vault.depositFor(address(this), amount);
    }

    /// @notice Withdraw collateral from the vault back to the owner.
    function exitVault(uint256 amount) external onlyOwner {
        vault.withdrawFor(address(this), amount, address(this));
        collateral.transfer(owner, amount);
    }

    /// @notice Execute a trade in a SoothMarket using this account as msg.sender.
    /// @dev For simplicity this forwards the call; more advanced AA would use signatures.
    function trade(SoothMarket market, uint8 outcomeIndex, int256 deltaShares) external onlyOwner {
        market.trade(outcomeIndex, deltaShares);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IProtocolConfig} from "./interfaces/IProtocolConfig.sol";

/**
 * @title ProtocolConfig
 * @notice Protocol-level guardian roles and global pause flag
 */
contract ProtocolConfig is Ownable, IProtocolConfig {
    mapping(address => bool) private _guardians;
    bool private _paused;

    event GuardianAdded(address indexed guardian);
    event GuardianRemoved(address indexed guardian);
    event ProtocolPaused(address indexed caller);
    event ProtocolUnpaused(address indexed caller);

    constructor(address _owner) Ownable(_owner) {}

    modifier onlyGuardianOrOwner() {
        if (msg.sender != owner() && !_guardians[msg.sender]) {
            revert("ProtocolConfig: not guardian");
        }
        _;
    }

    function isPaused() external view override returns (bool) {
        return _paused;
    }

    function isGuardian(address account) external view override returns (bool) {
        return _guardians[account];
    }

    function setGuardians(address[] calldata add, address[] calldata remove) external onlyOwner {
        for (uint256 i = 0; i < add.length; ) {
            address guardian = add[i];
            if (guardian != address(0) && !_guardians[guardian]) {
                _guardians[guardian] = true;
                emit GuardianAdded(guardian);
            }
            unchecked { ++i; }
        }

        for (uint256 i = 0; i < remove.length; ) {
            address guardian = remove[i];
            if (_guardians[guardian]) {
                _guardians[guardian] = false;
                emit GuardianRemoved(guardian);
            }
            unchecked { ++i; }
        }
    }

    function pause() external onlyGuardianOrOwner {
        if (_paused) return;
        _paused = true;
        emit ProtocolPaused(msg.sender);
    }

    function unpause() external onlyGuardianOrOwner {
        if (!_paused) return;
        _paused = false;
        emit ProtocolUnpaused(msg.sender);
    }
}

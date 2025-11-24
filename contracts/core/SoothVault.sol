// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

/// @title SoothVault - upgradeable singleton vault for Sooth
/// @notice Holds collateral, tracks user balances, and per-adjudicator LP pools.
contract SoothVault is OwnableUpgradeable, ReentrancyGuardUpgradeable {
    IERC20Upgradeable public collateral;

    struct AdjudicatorPool {
        uint256 totalLP;
        uint256 lockedAmount;
    }

    /// @notice Per-adjudicator aggregated LP pool
    mapping(bytes32 => AdjudicatorPool) public pools;

    /// @notice Optional per-adjudicator LP balances (for multi-LP accounting)
    mapping(bytes32 => mapping(address => uint256)) public lpBalances;

    /// @notice User free balances
    mapping(address => uint256) public userBalances;

    /// @notice Addresses allowed to move funds between user and LP pools
    mapping(address => bool) public isAuthorized;

    event LPDeposited(bytes32 indexed adjudicatorId, address indexed lp, uint256 amount);
    event LPWithdrawn(bytes32 indexed adjudicatorId, address indexed lp, uint256 amount);
    event UserDeposited(address indexed user, uint256 amount);
    event UserWithdrew(address indexed user, uint256 amount);
    event FundsMoved(address indexed from, address indexed to, uint256 amount);
    event ExposureIncreased(bytes32 indexed adjudicatorId, uint256 amount, uint256 newLocked);
    event ExposureDecreased(bytes32 indexed adjudicatorId, uint256 amount, uint256 newLocked);
    event AuthorizedSetter(address indexed target, bool allowed);

    modifier onlyAuthorized() {
        require(isAuthorized[msg.sender], "SoothVault: not authorized");
        _;
    }

    function initialize(address _collateral) external initializer {
        require(_collateral != address(0), "SoothVault: zero collateral");
        __Ownable_init();
        __ReentrancyGuard_init();
        collateral = IERC20Upgradeable(_collateral);
    }

    function setAuthorized(address target, bool allowed) external onlyOwner {
        isAuthorized[target] = allowed;
        emit AuthorizedSetter(target, allowed);
    }

    // --------- LP functions ---------

    function depositLP(bytes32 adjudicatorId, uint256 amount) external nonReentrant {
        require(amount > 0, "SoothVault: zero amount");
        require(collateral.transferFrom(msg.sender, address(this), amount), "SoothVault: transferFrom failed");

        AdjudicatorPool storage pool = pools[adjudicatorId];
        pool.totalLP += amount;
        lpBalances[adjudicatorId][msg.sender] += amount;

        emit LPDeposited(adjudicatorId, msg.sender, amount);
    }

    function withdrawLP(bytes32 adjudicatorId, uint256 amount) external nonReentrant {
        require(amount > 0, "SoothVault: zero amount");
        AdjudicatorPool storage pool = pools[adjudicatorId];
        require(lpBalances[adjudicatorId][msg.sender] >= amount, "SoothVault: lp too low");
        require(pool.totalLP >= amount, "SoothVault: pool short");
        require(pool.totalLP - amount >= pool.lockedAmount, "SoothVault: locked exposure");

        pool.totalLP -= amount;
        lpBalances[adjudicatorId][msg.sender] -= amount;

        require(collateral.transfer(msg.sender, amount), "SoothVault: transfer failed");
        emit LPWithdrawn(adjudicatorId, msg.sender, amount);
    }

    // --------- User functions ---------

    function depositUser(uint256 amount) external nonReentrant {
        require(amount > 0, "SoothVault: zero amount");
        require(collateral.transferFrom(msg.sender, address(this), amount), "SoothVault: transferFrom failed");
        userBalances[msg.sender] += amount;
        emit UserDeposited(msg.sender, amount);
    }

    function withdrawUser(uint256 amount) external nonReentrant {
        require(amount > 0, "SoothVault: zero amount");
        require(userBalances[msg.sender] >= amount, "SoothVault: balance too low");
        // cooldown hook could be enforced here
        userBalances[msg.sender] -= amount;
        require(collateral.transfer(msg.sender, amount), "SoothVault: transfer failed");
        emit UserWithdrew(msg.sender, amount);
    }

    // --------- Internal accounting ---------

    /// @notice Move funds from user free balance into LP pool (e.g. to pay trading cost)
    function userToLP(address user, bytes32 adjudicatorId, uint256 amount) external onlyAuthorized {
        require(userBalances[user] >= amount, "SoothVault: user balance low");
        AdjudicatorPool storage pool = pools[adjudicatorId];
        userBalances[user] -= amount;
        pool.totalLP += amount;
        emit FundsMoved(user, address(this), amount);
    }

    /// @notice Move funds from LP pool into user free balance (e.g. to pay user PnL)
    function lpToUser(address user, bytes32 adjudicatorId, uint256 amount) external onlyAuthorized {
        AdjudicatorPool storage pool = pools[adjudicatorId];
        require(pool.totalLP >= amount, "SoothVault: pool short");
        pool.totalLP -= amount;
        userBalances[user] += amount;
        emit FundsMoved(address(this), user, amount);
    }

    /// @notice Increase locked exposure for a given adjudicator pool
    function increaseExposure(bytes32 adjudicatorId, uint256 amount) external onlyAuthorized {
        AdjudicatorPool storage pool = pools[adjudicatorId];
        pool.lockedAmount += amount;
        require(pool.lockedAmount <= pool.totalLP, "SoothVault: exposure > LP");
        emit ExposureIncreased(adjudicatorId, amount, pool.lockedAmount);
    }

    /// @notice Decrease locked exposure for a given adjudicator pool
    function decreaseExposure(bytes32 adjudicatorId, uint256 amount) external onlyAuthorized {
        AdjudicatorPool storage pool = pools[adjudicatorId];
        if (amount > pool.lockedAmount) {
            amount = pool.lockedAmount;
        }
        pool.lockedAmount -= amount;
        emit ExposureDecreased(adjudicatorId, amount, pool.lockedAmount);
    }
}

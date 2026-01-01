// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {ITickBookVault} from "./interfaces/ITickBookVault.sol";
import {ITruthMarket} from "./interfaces/ITruthMarket.sol";

/**
 * @title TickBookVault
 * @notice Global per-chain vault for TickBook (ADR-051)
 * @dev Holds USDC custody and tracks internal balances in WAD.
 */
contract TickBookVault is ITickBookVault, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant WAD = 1e18;

    IERC20 public immutable usdc;
    uint8 private immutable usdcDecimals;

    /// @notice Authorized TickBook matching engine
    address public tickBook;

    mapping(address => uint256) private _availableUsdcWad;
    mapping(address => uint256) private _reservedUsdcWad;

    mapping(address => mapping(address => uint256)) private _yesInternalWad; // market => user => yes shares
    mapping(address => mapping(address => uint256)) private _noInternalWad;  // market => user => no shares

    // Locked shares for spot sell orders (market => user => outcome => locked amount)
    mapping(address => mapping(address => uint256)) private _yesLockedWad;
    mapping(address => mapping(address => uint256)) private _noLockedWad;

    mapping(address => uint256) private _marketCollateralWad; // market => USDC WAD backing outstanding internal shares

    modifier onlyTickBook() {
        require(msg.sender == tickBook, "TickBookVault: only tickBook");
        _;
    }

    constructor(address _usdc, address _owner) Ownable(_owner) {
        require(_usdc != address(0), "TickBookVault: zero usdc");
        usdc = IERC20(_usdc);
        usdcDecimals = IERC20Metadata(_usdc).decimals();
    }

    // ============================================
    // Admin
    // ============================================

    /**
     * @notice Set or update the authorized TickBook contract
     * @dev Owner can update the tickBook address for upgrades or migrations.
     *      Previous tickBook loses authorization immediately.
     */
    function setTickBook(address _tickBook) external onlyOwner {
        require(_tickBook != address(0), "TickBookVault: zero tickBook");
        address previousTickBook = tickBook;
        tickBook = _tickBook;
        emit TickBookSet(_tickBook);

        // Emit event for tracking when tickBook is updated (not just initially set)
        if (previousTickBook != address(0)) {
            emit TickBookUpdated(previousTickBook, _tickBook);
        }
    }

    /// @notice Emitted when tickBook is updated (not just initially set)
    event TickBookUpdated(address indexed previousTickBook, address indexed newTickBook);

    // ============================================
    // User USDC
    // ============================================

    function depositUsdc(uint256 amountAsset) external nonReentrant {
        require(amountAsset > 0, "TickBookVault: zero amount");
        usdc.safeTransferFrom(msg.sender, address(this), amountAsset);
        uint256 wadAmount = _usdcToWad(amountAsset);
        _availableUsdcWad[msg.sender] += wadAmount;
        emit UsdcDeposited(msg.sender, amountAsset, wadAmount);
    }

    function withdrawUsdc(uint256 amountWad) external nonReentrant {
        require(amountWad > 0, "TickBookVault: zero amount");
        require(_availableUsdcWad[msg.sender] >= amountWad, "TickBookVault: insufficient available");
        _availableUsdcWad[msg.sender] -= amountWad;
        uint256 assetAmount = _wadToUsdc(amountWad);
        usdc.safeTransfer(msg.sender, assetAmount);
        emit UsdcWithdrawn(msg.sender, amountWad, assetAmount);
    }

    function availableUsdcWad(address user) external view returns (uint256) {
        return _availableUsdcWad[user];
    }

    function reservedUsdcWad(address user) external view returns (uint256) {
        return _reservedUsdcWad[user];
    }

    // ============================================
    // Internal Outcomes (read-only)
    // ============================================

    function getInternalOutcomes(address market, address user) external view returns (uint256 yesSharesWad, uint256 noSharesWad) {
        return (_yesInternalWad[market][user], _noInternalWad[market][user]);
    }

    // ============================================
    // Market Collateral
    // ============================================

    function marketCollateralWad(address market) external view returns (uint256) {
        return _marketCollateralWad[market];
    }

    // ============================================
    // TickBook-only hooks
    // ============================================

    function reserveUsdc(address user, uint256 amountWad) external onlyTickBook {
        require(amountWad > 0, "TickBookVault: zero reserve");
        require(_availableUsdcWad[user] >= amountWad, "TickBookVault: insufficient available");
        _availableUsdcWad[user] -= amountWad;
        _reservedUsdcWad[user] += amountWad;
        emit UsdcReserved(user, amountWad);
    }

    function releaseUsdc(address user, uint256 amountWad) external onlyTickBook {
        require(amountWad > 0, "TickBookVault: zero release");
        require(_reservedUsdcWad[user] >= amountWad, "TickBookVault: insufficient reserved");
        _reservedUsdcWad[user] -= amountWad;
        _availableUsdcWad[user] += amountWad;
        emit UsdcReleased(user, amountWad);
    }

    function spendAvailableToMarket(address user, address market, uint256 amountWad) external onlyTickBook {
        require(amountWad > 0, "TickBookVault: zero spend");
        require(_availableUsdcWad[user] >= amountWad, "TickBookVault: insufficient available");
        _availableUsdcWad[user] -= amountWad;
        _marketCollateralWad[market] += amountWad;
    }

    function spendReservedToMarket(address user, address market, uint256 amountWad) external onlyTickBook {
        require(amountWad > 0, "TickBookVault: zero spend");
        require(_reservedUsdcWad[user] >= amountWad, "TickBookVault: insufficient reserved");
        _reservedUsdcWad[user] -= amountWad;
        _marketCollateralWad[market] += amountWad;
    }

    function creditOutcome(address market, address user, uint8 outcome, uint256 sharesWad) external onlyTickBook {
        require(sharesWad > 0, "TickBookVault: zero shares");
        require(outcome <= 1, "TickBookVault: invalid outcome");
        if (outcome == 1) {
            _yesInternalWad[market][user] += sharesWad;
        } else {
            _noInternalWad[market][user] += sharesWad;
        }
        emit OutcomeCredited(market, user, outcome, sharesWad);
    }

    /**
     * @notice Refund collateral from market back to user's available balance
     * @dev Used when maker cancels unfilled portion of order
     */
    function refundMarketToAvailable(address market, address user, uint256 amountWad) external onlyTickBook {
        require(amountWad > 0, "TickBookVault: zero refund");
        require(_marketCollateralWad[market] >= amountWad, "TickBookVault: insufficient market collateral");
        _marketCollateralWad[market] -= amountWad;
        _availableUsdcWad[user] += amountWad;
        emit UsdcReleased(user, amountWad);
    }

    // ============================================
    // Spot Sell Support (lock/unlock/transfer shares)
    // ============================================

    /**
     * @notice Lock internal shares for a spot sell order
     */
    function lockOutcome(address market, address user, uint8 outcome, uint256 sharesWad) external onlyTickBook {
        require(sharesWad > 0, "TickBookVault: zero shares");
        require(outcome <= 1, "TickBookVault: invalid outcome");
        
        if (outcome == 1) {
            require(_yesInternalWad[market][user] >= sharesWad, "TickBookVault: insufficient YES");
            _yesInternalWad[market][user] -= sharesWad;
            _yesLockedWad[market][user] += sharesWad;
        } else {
            require(_noInternalWad[market][user] >= sharesWad, "TickBookVault: insufficient NO");
            _noInternalWad[market][user] -= sharesWad;
            _noLockedWad[market][user] += sharesWad;
        }
        emit OutcomeLocked(market, user, outcome, sharesWad);
    }

    /**
     * @notice Unlock shares back to internal balance (cancel spot sell)
     */
    function unlockOutcome(address market, address user, uint8 outcome, uint256 sharesWad) external onlyTickBook {
        require(sharesWad > 0, "TickBookVault: zero shares");
        require(outcome <= 1, "TickBookVault: invalid outcome");
        
        if (outcome == 1) {
            require(_yesLockedWad[market][user] >= sharesWad, "TickBookVault: insufficient locked YES");
            _yesLockedWad[market][user] -= sharesWad;
            _yesInternalWad[market][user] += sharesWad;
        } else {
            require(_noLockedWad[market][user] >= sharesWad, "TickBookVault: insufficient locked NO");
            _noLockedWad[market][user] -= sharesWad;
            _noInternalWad[market][user] += sharesWad;
        }
        emit OutcomeUnlocked(market, user, outcome, sharesWad);
    }

    /**
     * @notice Get locked shares for a user
     */
    function getLockedOutcome(address market, address user, uint8 outcome) external view returns (uint256) {
        if (outcome == 1) {
            return _yesLockedWad[market][user];
        } else {
            return _noLockedWad[market][user];
        }
    }

    /**
     * @notice Transfer locked shares from seller to buyer (spot sell fill)
     */
    function transferLockedOutcome(
        address market,
        address from,
        address to,
        uint8 outcome,
        uint256 sharesWad
    ) external onlyTickBook {
        require(sharesWad > 0, "TickBookVault: zero shares");
        require(outcome <= 1, "TickBookVault: invalid outcome");
        
        if (outcome == 1) {
            require(_yesLockedWad[market][from] >= sharesWad, "TickBookVault: insufficient locked YES");
            _yesLockedWad[market][from] -= sharesWad;
            _yesInternalWad[market][to] += sharesWad;
        } else {
            require(_noLockedWad[market][from] >= sharesWad, "TickBookVault: insufficient locked NO");
            _noLockedWad[market][from] -= sharesWad;
            _noInternalWad[market][to] += sharesWad;
        }
        emit OutcomeTransferred(market, from, to, outcome, sharesWad);
    }

    /**
     * @notice Credit USDC to user's available balance (from spot sell proceeds)
     * @dev Transfers from buyer's spending to seller
     */
    function creditUsdcAvailable(address user, uint256 amountWad) external onlyTickBook {
        require(amountWad > 0, "TickBookVault: zero credit");
        _availableUsdcWad[user] += amountWad;
        emit UsdcCredited(user, amountWad);
    }

    // ============================================
    // Fee Collection
    // ============================================

    event FeeCollected(address indexed market, address indexed recipient, uint256 amountWad);

    /**
     * @notice Transfer fees from market collateral to recipient
     * @dev Called by TickBook after collecting taker fees
     * @param market The market the fee was collected from
     * @param recipient The fee recipient address
     * @param amountWad Amount of fees to transfer (in WAD)
     */
    function transferFee(
        address market,
        address recipient,
        uint256 amountWad
    ) external onlyTickBook {
        require(amountWad > 0, "TickBookVault: zero fee");
        require(recipient != address(0), "TickBookVault: zero recipient");
        require(_marketCollateralWad[market] >= amountWad, "TickBookVault: insufficient market collateral");

        _marketCollateralWad[market] -= amountWad;

        // Transfer USDC to recipient
        uint256 assetAmount = _wadToUsdc(amountWad);
        usdc.safeTransfer(recipient, assetAmount);

        emit FeeCollected(market, recipient, amountWad);
    }

    // ============================================
    // Redemption
    // ============================================

    function redeemResolved(address market) external nonReentrant returns (uint256 payoutWad) {
        require(market != address(0), "TickBookVault: zero market");
        ITruthMarket tm = ITruthMarket(market);
        require(tm.isSettled(), "TickBookVault: not settled");

        uint256 yesBal = _yesInternalWad[market][msg.sender];
        uint256 noBal = _noInternalWad[market][msg.sender];
        require(yesBal > 0 || noBal > 0, "TickBookVault: no position");

        // TruthMarket.getRedemptionValue only accepts outcome 0/1, and returns 0.5 for INVALID.
        uint256 valNo = tm.getRedemptionValue(0);
        uint256 valYes = tm.getRedemptionValue(1);

        uint256 payoutNo = (noBal * valNo) / WAD;
        uint256 payoutYes = (yesBal * valYes) / WAD;
        payoutWad = payoutNo + payoutYes;

        // Burn internal shares (both sides)
        _yesInternalWad[market][msg.sender] = 0;
        _noInternalWad[market][msg.sender] = 0;

        // Pay out from market collateral into user's available balance
        require(_marketCollateralWad[market] >= payoutWad, "TickBookVault: insufficient collateral");
        _marketCollateralWad[market] -= payoutWad;
        _availableUsdcWad[msg.sender] += payoutWad;

        emit RedeemedResolved(market, msg.sender, payoutWad, yesBal, noBal);
    }

    // ============================================
    // Decimal Helpers (WAD ↔ token decimals)
    // ============================================

    function _usdcToWad(uint256 assetAmount) internal view returns (uint256) {
        if (usdcDecimals == 18) return assetAmount;
        if (usdcDecimals < 18) return assetAmount * (10 ** (18 - usdcDecimals));
        return assetAmount / (10 ** (usdcDecimals - 18));
    }

    function _wadToUsdc(uint256 wadAmount) internal view returns (uint256) {
        // Floor conversion for transfers FROM the contract.
        if (usdcDecimals == 18) return wadAmount;
        if (usdcDecimals < 18) return wadAmount / (10 ** (18 - usdcDecimals));
        return wadAmount * (10 ** (usdcDecimals - 18));
    }
}



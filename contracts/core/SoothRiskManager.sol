// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SoothInterfaces.sol";

/// @notice Risk manager computing global b and per-market b_market.
/// @dev Matches the dynamic-b algorithm in the Sooth dev spec.
contract SoothRiskManager is IRiskManager, Ownable {
    ISoothVault public vault;

    struct GlobalRiskParams {
        uint256 bGlobal;
        uint256 maxConcurrentWorstCase; // K
    }

    enum RiskClass {
        LOW,
        MEDIUM,
        HIGH,
        CRITICAL
    }

    struct RiskClassConfig {
        uint256 multiplierBps;
    }

    GlobalRiskParams public globalRisk;
    mapping(RiskClass => RiskClassConfig) public riskClassConfigs;
    mapping(uint256 => RiskClass) public marketRiskClass;
    mapping(address => bool) public authorized;

    event GlobalBUpdated(uint256 bGlobal, uint256 Lmax, uint256 T, uint256 B);
    event MarketRiskClassSet(uint256 indexed marketId, RiskClass cls);
    event RiskClassConfigSet(RiskClass cls, uint256 multiplierBps);
    event VaultSet(address vault);
    event AuthorizedSet(address indexed who, bool allowed);

    constructor(ISoothVault _vault) {
        vault = _vault;

        // basic defaults
        riskClassConfigs[RiskClass.LOW] = RiskClassConfig({multiplierBps: 6000});
        riskClassConfigs[RiskClass.MEDIUM] = RiskClassConfig({multiplierBps: 10000});
        riskClassConfigs[RiskClass.HIGH] = RiskClassConfig({multiplierBps: 14000});
        riskClassConfigs[RiskClass.CRITICAL] = RiskClassConfig({multiplierBps: 18000});

        globalRisk.maxConcurrentWorstCase = 10;
    }

    modifier onlyAuthorized() {
        require(msg.sender == owner || authorized[msg.sender], "RiskManager: not authorized");
        _;
    }

    function setAuthorized(address who, bool allowed) external onlyOwner {
        authorized[who] = allowed;
        emit AuthorizedSet(who, allowed);
    }

    function setVault(ISoothVault _vault) external onlyOwner {
        vault = _vault;
        emit VaultSet(address(_vault));
    }

    function setGlobalMaxConcurrentWorstCase(uint256 K) external onlyOwner {
        globalRisk.maxConcurrentWorstCase = K;
    }

    function setRiskClassConfig(RiskClass cls, uint256 multiplierBps) external onlyOwner {
        riskClassConfigs[cls].multiplierBps = multiplierBps;
        emit RiskClassConfigSet(cls, multiplierBps);
    }

    function setMarketRiskClass(uint256 marketId, RiskClass cls) external onlyAuthorized {
        marketRiskClass[marketId] = cls;
        emit MarketRiskClassSet(marketId, cls);
    }

    /// @notice Recompute global b based on treasury, buffer, and K.
    /// @dev Treasury and buffer are normalized to 18 decimals for pricing calculations.
    function updateGlobalB() external {
        uint256 T_raw = vault.getTreasuryBalance();
        uint256 B_raw = vault.getLiquidBufferBalance();
        uint256 scale = vault.decimalsScale();
        uint256 K = globalRisk.maxConcurrentWorstCase;
        if (K == 0) return;

        // Normalize to 18 decimals for pricing calculations
        // For 18-decimal tokens: scale = 1 (no change)
        // For 6-decimal tokens: scale = 10^12 (multiply by 1 trillion)
        uint256 T = T_raw * scale;
        uint256 B = B_raw * scale;

        uint256 Lmax = (T + B) / K;

        // bGlobal ≈ Lmax / ln(2). Approximate 1/ln(2) ≈ 1.4427.
        uint256 LN2_INV_BPS = 14427;
        uint256 newB = Lmax * LN2_INV_BPS / 1e4;

        globalRisk.bGlobal = newB;
        emit GlobalBUpdated(newB, Lmax, T, B);
    }

    function getBForMarket(uint256 marketId) external view override returns (uint256) {
        RiskClass cls = marketRiskClass[marketId];
        RiskClassConfig storage cfg = riskClassConfigs[cls];
        return (globalRisk.bGlobal * cfg.multiplierBps) / 1e4;
    }
}

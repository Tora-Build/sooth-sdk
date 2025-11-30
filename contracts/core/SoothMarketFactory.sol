// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SoothInterfaces.sol";
import "./SoothRiskManager.sol";
import "./SoothMarket.sol";

/// @notice Factory to create SoothMarket instances with a given risk class and adjudicator.
/// @dev This is a convenience helper for ops / deploy scripts; it wires:
///      - marketId (auto-increment)
///      - vault + riskManager + AMM
///      - risk class
///      - optional exposure allocation via the vault
contract SoothMarketFactory is Ownable {
    ISoothVault public vault;
    SoothRiskManager public riskManager;
    ISoothAMM public amm;

    uint256 public nextMarketId = 1;

    event MarketCreated(
        uint256 indexed marketId,
        address market,
        bytes32 adjudicatorId,
        SoothRiskManager.RiskClass riskClass,
        uint256 exposureAllocated
    );

    constructor(ISoothVault _vault, SoothRiskManager _riskManager, ISoothAMM _amm) {
        vault = _vault;
        riskManager = _riskManager;
        amm = _amm;
    }

    function setAMM(ISoothAMM _amm) external onlyOwner {
        amm = _amm;
    }

    /// @notice Create and initialize a new SoothMarket.
    /// @param adjudicatorId The adjudicator configuration id from SoothAdjudicatorRegistry.
    /// @param riskClass The risk class for this market (drives b_market).
    function createMarket(bytes32 adjudicatorId, SoothRiskManager.RiskClass riskClass)
        external
        onlyOwner
        returns (SoothMarket)
    {
        uint256 marketId = nextMarketId++;
        riskManager.setMarketRiskClass(marketId, riskClass);
        riskManager.updateGlobalB();

        SoothMarket m = new SoothMarket();
        
        // Initialize with balanced quantities (1000 shares per side)
        // This creates a 50/50 starting price and prevents LMSR pricing breakdown at (0,0)
        int256 initialQuantity = 1000 * 1e18;
        m.initialize(marketId, vault, riskManager, amm, adjudicatorId, initialQuantity);

        // Approximate Lmax ≈ b * ln(2) ~ 0.693...
        uint256 bMarket = riskManager.getBForMarket(marketId);
        uint256 Lmax = (bMarket * 693147180000000000) / 1e18;

        uint256 exposureAllocated = 0;
        // Allocate exposure if this factory is authorized on the vault.
        try vault.allocateExposure(marketId, Lmax) {
            exposureAllocated = Lmax;
        } catch {
            // If not authorized, ops can allocate manually later.
        }

        emit MarketCreated(marketId, address(m), adjudicatorId, riskClass, exposureAllocated);
        return m;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SoothInterfaces.sol";
import "./SoothMarket.sol";

/// @notice Factory to create SoothMarket instances.
/// @dev Convenience helper for deployment; wires marketId, vaults, AMM, fees.
contract SoothMarketFactory is Ownable {
    ISoothGovernorVault public governorVault;
    ISoothTraderVault public traderVault;
    ISoothAMM public amm;
    ISoothFeeController public feeController;

    uint256 public nextMarketId = 1;

    event MarketCreated(
        uint256 indexed marketId,
        address market,
        bytes32 adjudicatorId,
        address governor,
        uint256 b,
        uint256 feeLMSR
    );

    constructor(
        ISoothGovernorVault _governorVault, 
        ISoothTraderVault _traderVault, 
        ISoothAMM _amm,
        ISoothFeeController _feeController
    ) {
        governorVault = _governorVault;
        traderVault = _traderVault;
        amm = _amm;
        feeController = _feeController;
    }

    function setAMM(ISoothAMM _amm) external onlyOwner {
        amm = _amm;
    }

    function setFeeController(ISoothFeeController _feeController) external onlyOwner {
        feeController = _feeController;
    }

    /// @notice Create and initialize a new SoothMarket.
    /// @param adjudicatorId The adjudicator configuration id.
    /// @param governor Address that can adjust b and feeLMSR for this market.
    /// @param b Initial liquidity parameter.
    /// @param feeLMSR Initial LMSR fee in basis points.
    function createMarket(
        bytes32 adjudicatorId, 
        address governor,
        uint256 b,
        uint256 feeLMSR
    ) external onlyOwner returns (SoothMarket) {
        uint256 marketId = nextMarketId++;

        SoothMarket m = new SoothMarket();
        
        int256 initialQuantity = 1000 * 1e18;
        m.initialize(
            marketId, 
            governorVault, 
            traderVault, 
            amm, 
            feeController,
            adjudicatorId, 
            b, 
            feeLMSR,
            governor,
            initialQuantity
        );

        // Allocate exposure: Lmax = b * ln(2)
        uint256 Lmax = (b * 693147180000000000) / 1e18;

        try governorVault.allocateExposure(marketId, Lmax) {
            // Exposure allocated
        } catch {
            // If not authorized, ops can allocate manually later.
        }

        emit MarketCreated(marketId, address(m), adjudicatorId, governor, b, feeLMSR);
        return m;
    }
}

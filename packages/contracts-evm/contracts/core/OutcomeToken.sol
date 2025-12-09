// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "../interfaces/IOutcomeToken.sol";
import "../interfaces/ISoothTraderVault.sol";

/// @title OutcomeToken
/// @notice ERC1155 tokens representing outcome shares for orderbook trading
/// @dev Separate from AMM - only orderbook matches mint/burn these tokens
contract OutcomeToken is ERC1155, IOutcomeToken {
    // ============ Constants ============
    
    uint256 public constant override YES_TOKEN_ID = 0;
    uint256 public constant override NO_TOKEN_ID = 1;

    // ============ State ============
    
    address public override market;
    address public override traderVault;
    bool private _initialized;

    // ============ Modifiers ============
    
    modifier onlyMarket() {
        require(msg.sender == market, "OutcomeToken: not market");
        _;
    }

    // ============ Constructor ============
    
    constructor() ERC1155("") {
        // Empty URI - metadata handled off-chain or via market
    }

    // ============ Initialization ============
    
    /// @notice Initialize the token with market and vault references
    /// @param _market The market contract address
    /// @param _traderVault The trader vault contract address
    function initialize(address _market, address _traderVault) external {
        require(!_initialized, "OutcomeToken: already initialized");
        require(_market != address(0), "OutcomeToken: zero market");
        require(_traderVault != address(0), "OutcomeToken: zero vault");
        
        market = _market;
        traderVault = _traderVault;
        _initialized = true;
    }

    // ============ Market-Only Functions ============
    
    /// @inheritdoc IOutcomeToken
    function mint(address to, uint256 id, uint256 amount) external override onlyMarket {
        require(id == YES_TOKEN_ID || id == NO_TOKEN_ID, "OutcomeToken: invalid token id");
        _mint(to, id, amount, "");
    }

    /// @inheritdoc IOutcomeToken
    function burn(address from, uint256 id, uint256 amount) external override onlyMarket {
        require(id == YES_TOKEN_ID || id == NO_TOKEN_ID, "OutcomeToken: invalid token id");
        _burn(from, id, amount);
    }

    // ============ User Functions ============
    
    /// @inheritdoc IOutcomeToken
    function merge(uint256 amount) external override {
        require(amount > 0, "OutcomeToken: zero amount");
        
        uint256 yesBalance_ = balanceOf(msg.sender, YES_TOKEN_ID);
        uint256 noBalance_ = balanceOf(msg.sender, NO_TOKEN_ID);
        
        require(yesBalance_ >= amount, "OutcomeToken: insufficient YES");
        require(noBalance_ >= amount, "OutcomeToken: insufficient NO");
        
        // Burn both tokens
        _burn(msg.sender, YES_TOKEN_ID, amount);
        _burn(msg.sender, NO_TOKEN_ID, amount);
        
        // Credit USDC to user via TraderVault
        // Merge is FREE (no lock) - user holds delta-neutral position
        ISoothTraderVault(traderVault).creditMergeProceeds(msg.sender, amount);
        
        emit Merged(msg.sender, amount);
    }

    // ============ View Functions ============
    
    /// @inheritdoc IOutcomeToken
    function yesBalance(address user) external view override returns (uint256) {
        return balanceOf(user, YES_TOKEN_ID);
    }

    /// @inheritdoc IOutcomeToken
    function noBalance(address user) external view override returns (uint256) {
        return balanceOf(user, NO_TOKEN_ID);
    }

    // ============ ERC1155 Overrides ============
    
    /// @notice Returns URI for token metadata
    /// @dev Can be customized to return market-specific metadata
    function uri(uint256 id) public view virtual override returns (string memory) {
        if (id == YES_TOKEN_ID) {
            return "ipfs://sooth/outcome/yes";
        } else if (id == NO_TOKEN_ID) {
            return "ipfs://sooth/outcome/no";
        }
        return "";
    }

    /// @notice Check interface support
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, IERC165) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

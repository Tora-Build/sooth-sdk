// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "../interfaces/IOutcomeToken.sol";
import "../interfaces/ISoothMarketV4.sol";
import "../interfaces/ISoothTraderVaultV4.sol";

/// @title LaunchpadOutcomeToken
/// @notice ERC1155 outcome tokens for Launchpad markets
contract LaunchpadOutcomeToken is ERC1155Supply, IOutcomeToken {
    // ============ Constants ============
    
    uint256 public constant override YES_TOKEN_ID = 0;
    uint256 public constant override NO_TOKEN_ID = 1;

    // ============ State ============
    
    address public override market;
    address public override traderVault;
    
    string public name;
    string public symbol;
    bool private _initialized;

    // ============ Modifiers ============
    
    modifier onlyMarket() {
        require(msg.sender == market, "OutcomeToken: not market");
        _;
    }

    // ============ Constructor ============
    
    constructor() ERC1155("") {
        // Implementation logic
    }

    // ============ Initialization ============
    
    /// @notice Initialize the token with market and metadata
    /// @param _name Token Name
    /// @param _symbol Token Symbol
    /// @param _market Market address
    function initialize(
        string memory _name,
        string memory _symbol,
        address _market
    ) external {
        require(!_initialized, "OutcomeToken: already initialized");
        require(_market != address(0), "OutcomeToken: zero market");
        
        market = _market;
        name = _name;
        symbol = _symbol;
        
        // Note: We do NOT fetch traderVault here because Market might not be initialized yet.
        // We strict lazy-load it in merge(), or assume Market checks pass.
        
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
        
        // Lazy load traderVault if not set
        if (traderVault == address(0)) {
            traderVault = ISoothMarketV4(market).traderVault();
            require(traderVault != address(0), "OutcomeToken: zero traderVault");
        }

        // Burn both tokens
        _burn(msg.sender, YES_TOKEN_ID, amount);
        _burn(msg.sender, NO_TOKEN_ID, amount);
        
        // Credit USDC to user via TraderVault
        // Merge is FREE (no lock) - user holds delta-neutral position
        ISoothTraderVaultV4(traderVault).creditMergeProceeds(msg.sender, amount);
        
        emit Merged(msg.sender, amount);
    }

    /// @inheritdoc IOutcomeToken
    function split(uint256 amount) external override {
        require(amount > 0, "OutcomeToken: zero amount");
        
        // Lazy load traderVault if not set
        if (traderVault == address(0)) {
            traderVault = ISoothMarketV4(market).traderVault();
            require(traderVault != address(0), "OutcomeToken: zero traderVault");
        }

        // Debit USDC from user via TraderVault
        ISoothTraderVaultV4(traderVault).debitSplitProceeds(msg.sender, amount);
        
        // Mint both tokens
        _mint(msg.sender, YES_TOKEN_ID, amount, "");
        _mint(msg.sender, NO_TOKEN_ID, amount, "");
        
        emit Split(msg.sender, amount);
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
    function uri(uint256 id) public view virtual override returns (string memory) {
        // Construct standard URI using symbol?
        // Or keep generic. Launchpad usually displays metadata from offchain.
        return super.uri(id);
    }

    /// @notice Check interface support
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, IERC165) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /// @notice Get total supply of a specific token ID
    function totalSupply(uint256 id) public view virtual override(ERC1155Supply, IOutcomeToken) returns (uint256) {
        return super.totalSupply(id);
    }
}

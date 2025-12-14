import { parseAbi } from "viem";

export const SOOTH_MARKET_ABI = parseAbi([
  "function isLive() view returns (bool)",
  "function isSettled() view returns (bool)",
  "function price(uint8 outcome) view returns (uint256)",
  "function b() view returns (uint256)",
  "function bBase() view returns (uint256)",
  "function qYes() view returns (int256)",
  "function qNo() view returns (int256)",
  "function winningOutcome() view returns (uint8)",
  "function feeLMSR() view returns (uint256)",
  "function governor() view returns (address)",
  // V3 Unified Orderbook
  "function bestAsk() view returns (uint256)",
  "function bestBid() view returns (uint256)",
  "function bestOrder(uint256 outcome) view returns (uint256)", // Compatibility shim
  "function orders(uint256) view returns (uint256 id, address maker, uint256 yesPrice, uint256 amount, uint256 timestamp, bool isBuySide)",
  "function nextOrder(uint256) view returns (uint256)",
  // Events
  "event OrderCreated(uint256 indexed orderId, address indexed maker, uint8 outcome, uint256 price, uint256 amount)",
  "event OrderMatched(uint256 indexed buyOrderId, uint256 indexed sellOrderId, uint256 amount, uint256 yesPrice)",
  "event OrderCancelled(uint256 indexed orderId)",
  "event BBaseIncrease(uint256 amount, uint256 newBBase)",
]);

// V3: TraderVaultV3 for user fund management
export const TRADER_VAULT_V3_ABI = parseAbi([
  "function deposit(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function availableBalance(address user) view returns (uint256)",
  "function pendingBalance(address user) view returns (uint256)",
  "function totalBalance(address user) view returns (uint256)",
  "function tradeAMM(address market, uint8 outcome, int256 deltaShares, int256 maxCost)",
  "function placeOrder(address market, uint8 outcome, uint256 price, uint256 amount) returns (uint256)",
  "function cancelOrder(address market, uint256 orderId)",
  "function claimUnlocked()",
  "function redeem(address market)",
  "function asset() view returns (address)",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function convertToShares(uint256 assets) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256)",
  "function previewMint(uint256 shares) view returns (uint256)",
  "function previewWithdraw(uint256 assets) view returns (uint256)",
  "function previewRedeem(uint256 shares) view returns (uint256)",
  "event Deposit(address indexed user, uint256 amount)",
  "event Withdraw(address indexed user, uint256 amount)",
  "event Trade(address indexed user, address indexed market, uint8 outcome, int256 deltaShares, int256 cost)",
  "event OrderPlaced(address indexed user, address indexed market, uint256 orderId, uint8 outcome, uint256 price, uint256 amount)",
  "event OrderCancelled(address indexed user, address indexed market, uint256 orderId)",
  "event UnlockClaimed(address indexed user, uint256 amount)",
]);

// DEPRECATED: V2 TraderVault (kept for reference)
export const SOOTH_TRADER_VAULT_ABI = parseAbi([
  "function deposit(uint256 amount) returns (uint256)",
  "function withdraw(uint256 amount) returns (uint256)",
  "function freeBalance(address) view returns (uint256)",
  "function lockedBalance(address) view returns (uint256)",
  "function asset() view returns (address)",
]);

// RENAMED: SoothVault -> SoothGovernorVault (LP liquidity)
export const SOOTH_GOVERNOR_VAULT_ABI = parseAbi([
  "function asset() view returns (address)",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function totalLockedExposure() view returns (uint256)",
  "function lockedExposure(uint256 marketId) view returns (uint256)",
  "function marketReserves(uint256 marketId) view returns (int256)",
  "function depositFor(address lp, uint256 assets) returns (uint256)",
  "function withdrawFor(address lp, uint256 assets, address receiver) returns (uint256)",
  "function getMarketReserve(uint256 marketId) view returns (int256)",
  "function defaultBBase() view returns (uint256)",
  "function defaultFeeBps() view returns (uint256)",
  "function reserveFactorBps() view returns (uint256)",
  "function setVaultConfig(uint256 bBase, uint256 feeBps, uint256 reserveFactorBps)",
  "event Deposit(address indexed lp, uint256 assets, uint256 shares)",
  "event Withdraw(address indexed lp, uint256 assets, uint256 shares, address indexed receiver)",
  "event MarketFlow(uint256 indexed marketId, int256 amount, int256 newReserve)",
  "event VaultConfigSet(uint256 bBase, uint256 feeBps, uint256 reserveFactorBps)",
]);

// DEPRECATED: Keep for backward compatibility
export const SOOTH_VAULT_ABI = SOOTH_GOVERNOR_VAULT_ABI;

// NEW: SoothFeeController for fee settings
export const SOOTH_FEE_CONTROLLER_ABI = parseAbi([
  "function orderbookFee() view returns (uint256)",
  "function lpSplitBps() view returns (uint256)",
  "function treasury() view returns (address)",
]);

export const SOOTH_SETTLEMENT_ABI = parseAbi([
  "function results(uint256) view returns (bool exists, bool settled, bytes32 adjudicatorId, uint64 truthTime, uint8 winningOutcome)",
  "function settlementRoots(bytes32) view returns (bytes32)",
  "function claimed(bytes32, address) view returns (bool)",
  "function storeResult(uint256 marketId, bytes32 adjudicatorId, uint8 winningOutcome, uint64 truthTime)",
  "function storeSettlementRoot(uint256 marketId, bytes32 batchId, bytes32 root, bytes proofMeta)",
  "function claimSettlement(uint256 marketId, bytes32 batchId, int256 pnlDelta, bytes32[] merkleProof)",
  "event ResultStored(uint256 indexed marketId, bytes32 adjudicatorId, uint8 winningOutcome, uint64 truthTime)",
  "event SettlementRootStored(uint256 indexed marketId, bytes32 batchId, bytes32 root)",
  "event Claimed(uint256 indexed marketId, bytes32 batchId, address indexed account, int256 pnlDelta)",
]);

export const SOOTH_BALANCED_AMM_ABI = parseAbi([
  "function price((int256 qYes, int256 qNo) s, uint8 outcomeIndex, uint256 b) pure returns (uint256 priceWad)",
  "function costDelta((int256 qYes, int256 qNo) s, uint8 outcomeIndex, int256 deltaShares, uint256 b) pure returns (int256 cost, (int256 qYes, int256 qNo) newState)",
]);

// DEPRECATED: RiskManager removed in v2
export const SOOTH_RISK_MANAGER_ABI = parseAbi([
  "function getBForMarket(uint256 marketId) view returns (uint256 b)",
  "function reserveMultiplierBps() view returns (uint256)",
]);

export const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

export const MOCK_ERC20_ABI = parseAbi([
  "function mint(address to, uint256 amount)",
  "function _mint(address to, uint256 amount)",
]);

// V4.6: TraderVaultV4 with dual-venue trading + Lock-on-Sell
export const TRADER_VAULT_V4_ABI = parseAbi([
  "function deposit(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function accounts(address user) view returns (uint256 available, uint256 pending)",
  "function shareBalances(address user, address market, uint8 outcome) view returns (uint256)",
  // V4.6: ammPositions now returns only 2 fields (Lock-on-Sell - no unlockTime)
  "function ammPositions(address user, address market) view returns (uint256 yesShares, uint256 noShares)",
  "function tradeAMM(address market, uint8 outcome, int256 deltaShares, int256 maxCost)",
  "function depositShares(address market, uint8 outcome, uint256 amount)",
  "function withdrawShares(address market, uint8 outcome, uint256 amount)",
  "function placeOrder(address market, uint8 outcome, uint256 price, uint256 amount, bool isBuy) returns (uint256)",
  "function placeSpotOrder(address market, uint8 outcome, uint256 price, uint256 amount) returns (uint256)",
  "function executeHybridSell(address market, uint8 outcome, uint256 price, uint256 totalAmount)",
  "function cancelOrder(address market, uint256 orderId)",
  "function cancelSpotOrder(address market, uint256 orderId)",
  "function onOrderMatched(uint256 orderId, uint256 matchedAmount)",
  "function claimUnlocked() returns (uint256)",
  "function redeem(address market)",
  "function collateralToken() view returns (address)",
  "function asset() view returns (address)",
  "function isMarket(address market) view returns (bool)",
  "function orderOwners(uint256 orderId) view returns (address)",
  // V4.6 Lock-on-Sell additions
  "function lockedBalance(address user) view returns (uint256)",
  "function claimableBalance(address user) view returns (uint256)",
  "function availableBalance(address user) view returns (uint256)",
  "function pendingBalance(address user) view returns (uint256)",
  "function totalBalance(address user) view returns (uint256)",
  "function nextUnlock(address user) view returns (uint256 amount, uint64 unlockTime)",
]);

// V4.6: GovernorVault (ERC4626 + Lock-on-Sell)
export const GOVERNOR_VAULT_V4_ABI = parseAbi([
  "function asset() view returns (address)",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function totalLockedExposure() view returns (uint256)",
  "function totalLockedProceeds() view returns (uint256)",
  "function convertToShares(uint256 assets) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)",
  // V4.6 Lock-on-Sell additions
  "function lockedBalance(address user) view returns (uint256)",
  "function claimableBalance(address user) view returns (uint256)",
  "event Deposit(address indexed user, address indexed receiver, uint256 assets, uint256 shares)",
  "event Withdraw(address indexed user, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)",
  "event Locked(address indexed user, uint256 amount, uint64 unlockTime)",
  "event Unlocked(address indexed user, uint256 amount)",
  "event Claimed(address indexed user, uint256 amount)",
]);

// V4: MarketV4 with continuous LMSR (qYes/qNo)
export const MARKET_V4_ABI = parseAbi([
  "function qYes() view returns (int256)",
  "function qNo() view returns (int256)",
  "function b() view returns (uint256)",
  "function bBase() view returns (uint256)",
  "function feeLMSR() view returns (uint256)",
  "function price(uint8 outcome) view returns (uint256)",
  "function calculateAMMTradeCost(uint8 outcome, uint256 shares, bool isBuy) view returns (int256 cost, uint256 fee, int256 newQYes, int256 newQNo)",
  "function isLive() view returns (bool)",
  "function isSettled() view returns (bool)",
  "function yesBalance(address user) view returns (uint256)",
  "function noBalance(address user) view returns (uint256)",
  "function bestAsk() view returns (uint256)",
  "function bestBid() view returns (uint256)",
  "function orders(uint256 id) view returns (address maker, uint8 outcome, uint256 yesPrice, uint256 amount, bool isBuySide)",
  "function nextOrder(uint256 id) view returns (uint256)",
  "function outcomeToken() view returns (address)",
  "function merge(uint256 amount) returns (uint256 proceeds)",
]);

// V5: Launchpad Factory
export const LAUNCHPAD_FACTORY_ABI = parseAbi([
  "function createMarket(string name, string symbol, string description, uint8 liquidityTierIndex, bool isOpenEnd, uint40 durationSeconds) returns (address market, address lpVault)",
  "function tierDeposits(uint256) view returns (uint256)",
  "function tierBValues(uint256) view returns (uint256)",
  "function usdc() view returns (address)",
  "function getAllMarkets() view returns (address[])",
  "event MarketCreated(address indexed market, address indexed creator, address indexed lpVault, string name, string symbol, uint256 liquidityTier, uint256 depositAmount)",
]);

// V5: Launchpad Market (inherits MarketV4)
export const LAUNCHPAD_MARKET_ABI = parseAbi([
  // Inherits V4 functions...
  "function qYes() view returns (int256)",
  "function qNo() view returns (int256)",
  "function b() view returns (uint256)",
  "function bBase() view returns (uint256)",
  "function price(uint8 outcome) view returns (uint256)",
  "function isLive() view returns (bool)",
  "function isSettled() view returns (bool)",
  "function calculateAMMTradeCost(uint8 outcome, uint256 shares, bool isBuy) view returns (int256 cost, uint256 fee, int256 newQYes, int256 newQNo)",
  "function yesBalance(address user) view returns (uint256)",
  "function noBalance(address user) view returns (uint256)",
  "function outcomeToken() view returns (address)",
  "function merge(uint256 amount) returns (uint256 proceeds)",
  // Launchpad specifics
  "function isGraduated() view returns (bool)",
  "function graduationThreshold() view returns (uint256)",
  "function deadline() view returns (uint40)",
  "function creator() view returns (address)",
  "function lpVault() view returns (address)",
  "function graduate()",
  "function expire()",
  "function claimRefund()",
  "event Graduated(uint256 timestamp, uint256 totalLiquidity)",
  "event Expired(uint256 timestamp)",
]);

// V5: Market LP Vault (Per-market Governor)
export const MARKET_LP_VAULT_ABI = parseAbi([
  "function totalAssets() view returns (uint256)",
  "function market() view returns (address)",
  "function asset() view returns (address)",
]);


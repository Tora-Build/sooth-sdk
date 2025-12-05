import { parseAbi } from "viem";

export const SOOTH_MARKET_ABI = parseAbi([
  "function isLive() view returns (bool)",
  "function isSettled() view returns (bool)",
  "function ammState() view returns (int256 qYes, int256 qNo)",
  "function yesBalance(address) view returns (uint256)",
  "function noBalance(address) view returns (uint256)",
  "function winningOutcome() view returns (uint8)",
  "function b() view returns (uint256)",
  "function feeLMSR() view returns (uint256)",
  "function governor() view returns (address)",
  "function bestOrder(uint256 outcome) view returns (uint256)",
  "function orders(uint256) view returns (uint256 id, address maker, uint8 outcome, uint256 price, uint256 amount, uint256 timestamp)",
  "function nextOrder(uint256) view returns (uint256)",
  "event OrderPlaced(uint256 indexed orderId, address indexed maker, uint8 outcome, uint256 price, uint256 amount)",
  "event OrderCancelled(uint256 indexed orderId)",
  "event OrderMatched(uint256 indexed orderId, uint256 amount)",
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
  "function getTreasuryBalance() view returns (uint256)",
  "function getLiquidBufferBalance() view returns (uint256)",
  "function lockedExposure(uint256) view returns (uint256)",
  "function depositFor(address lp, uint256 assets) returns (uint256)",
  "function withdrawFor(address lp, uint256 assets, address receiver) returns (uint256)",
  "function getMarketReserve(uint256 marketId) view returns (int256)",
  "function maxDeposit(address) view returns (uint256)",
  "event Deposit(address indexed lp, uint256 assets)",
  "event Withdraw(address indexed lp, uint256 assets, address indexed receiver)",
  "event MarketFlow(uint256 indexed marketId, int256 amount, int256 newReserve)",
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

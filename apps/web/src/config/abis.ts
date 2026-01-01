import { parseAbi, type Abi } from "viem";

// ABIs - Flat structure (no versioned folders)
import LaunchpadEngineABI from "./abis/LaunchpadEngine.json";
import CollateralizerABI from "./abis/Collateralizer.json";
import AMMEngineABI from "./abis/AMMEngine.json";
import TickBookABI from "./abis/TickBook.json";
import TickBookVaultABI from "./abis/TickBookVault.json";
import TruthMarketABI from "./abis/TruthMarket.json";
import OutcomeTokenABI from "./abis/OutcomeToken.json";
import TickBookPoolManagerABI from "./abis/TickBookPoolManager.json";
import TickBookPoolManagerV996ABI from "./abis/TickBookPoolManagerV996.json";
import TickBookVaultPoolManagerABI from "./abis/TickBookVaultPoolManager.json";
import DynamicFeeHookABI from "./abis/DynamicFeeHook.json";
import ITickBookHooksABI from "./abis/ITickBookHooks.json";

// Contract ABIs - unified export
export const ABIS = {
  LaunchpadEngine: (LaunchpadEngineABI as any).abi as Abi,
  Collateralizer: (CollateralizerABI as any).abi as Abi,
  AMMEngine: (AMMEngineABI as any).abi as Abi,
  TickBook: (TickBookABI as any).abi as Abi,
  TickBookVault: (TickBookVaultABI as any).abi as Abi,
  TruthMarket: (TruthMarketABI as any).abi as Abi,
  OutcomeToken: (OutcomeTokenABI as any).abi as Abi,
  // TickBook singleton (pool manager architecture)
  TickBookPoolManager: (TickBookPoolManagerABI as any).abi as Abi,
  TickBookVaultPoolManager: (TickBookVaultPoolManagerABI as any).abi as Abi,
  DynamicFeeHook: (DynamicFeeHookABI as any).abi as Abi,
  ITickBookHooks: (ITickBookHooksABI as any).abi as Abi,
};

// Legacy aliases for backward compatibility
export const V8_ABIS = {
  LaunchpadEngine: (LaunchpadEngineABI as any).abi as Abi,
  Collateralizer: (CollateralizerABI as any).abi as Abi,
  AMMEngine: (AMMEngineABI as any).abi as Abi,
  TickBook: (TickBookABI as any).abi as Abi,
  TickBookVault: (TickBookVaultABI as any).abi as Abi,
  TruthMarket: (TruthMarketABI as any).abi as Abi,
  OutcomeToken: (OutcomeTokenABI as any).abi as Abi,
};

export const V9_ABIS = {
  TickBookPoolManager: (TickBookPoolManagerABI as any).abi as Abi,
  TickBookVault: (TickBookVaultPoolManagerABI as any).abi as Abi,
  DynamicFeeHook: (DynamicFeeHookABI as any).abi as Abi,
  ITickBookHooks: (ITickBookHooksABI as any).abi as Abi,
  // Re-export unchanged contracts
  LaunchpadEngine: (LaunchpadEngineABI as any).abi as Abi,
  Collateralizer: (CollateralizerABI as any).abi as Abi,
  AMMEngine: (AMMEngineABI as any).abi as Abi,
  TruthMarket: (TruthMarketABI as any).abi as Abi,
  OutcomeToken: (OutcomeTokenABI as any).abi as Abi,
};

// V9.9.6 ABIs - Unified Order API
export const V996_ABIS = {
  TickBookPoolManager: (TickBookPoolManagerV996ABI as any).abi as Abi,
  TickBookVault: (TickBookVaultPoolManagerABI as any).abi as Abi,
  // Re-export unchanged contracts
  LaunchpadEngine: (LaunchpadEngineABI as any).abi as Abi,
  Collateralizer: (CollateralizerABI as any).abi as Abi,
  AMMEngine: (AMMEngineABI as any).abi as Abi,
  TruthMarket: (TruthMarketABI as any).abi as Abi,
  OutcomeToken: (OutcomeTokenABI as any).abi as Abi,
};

// Legacy V7 ABIs (parseAbi format)
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
  "function bestAsk() view returns (uint256)",
  "function bestBid() view returns (uint256)",
  "function bestOrder(uint256 outcome) view returns (uint256)",
  "function orders(uint256 id) view returns (uint256 orderId, address maker, uint256 yesPrice, uint256 amount, uint256 timestamp, bool isBuySide)",
  "function nextOrder(uint256 id) view returns (uint256)",
  "event OrderCreated(uint256 indexed orderId, address indexed maker, uint8 outcome, uint256 price, uint256 amount)",
  "event OrderMatched(uint256 indexed buyOrderId, uint256 indexed sellOrderId, uint256 amount, uint256 yesPrice)",
  "event OrderCancelled(uint256 indexed orderId)",
  "event BBaseIncrease(uint256 amount, uint256 newBBase)",
]);

export const SOOTH_FEE_CONTROLLER_ABI = parseAbi([
  "function orderbookFee() view returns (uint256)",
  "function lpSplitBps() view returns (uint256)",
  "function treasury() view returns (address)",
]);

const ERC20_STRINGS = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

export const ERC20_ABI = parseAbi(ERC20_STRINGS);

export const MOCK_ERC20_ABI = parseAbi([
  ...ERC20_STRINGS,
  "function mint(address to, uint256 amount)",
]);

export const TRADER_VAULT_V4_ABI = parseAbi([
  "function deposit(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function accounts(address user) view returns (uint256 available, uint256 pending)",
  "function shareBalances(address user, address market, uint8 outcome) view returns (uint256)",
  "function ammPositions(address user, address market) view returns (uint256 yesShares, uint256 noShares)",
  "function tradeAMM(address market, uint8 outcome, int256 deltaShares, int256 maxCost)",
  "function depositAndTradeAMM(address market, uint8 outcome, int256 deltaShares, int256 maxCost, uint256 depositAmount)",
  "function depositShares(address market, uint8 outcome, uint256 amount)",
  "function withdrawShares(address market, uint8 outcome, uint256 amount)",
  "function splitAndDeposit(address market, uint256 amount)",
  "function mergeFromVault(address market, uint256 amount)",
  "function placeOrder(address market, uint8 outcome, uint256 price, uint256 amount, bool isBuy) returns (uint256)",
  "function cancelOrder(address market, uint256 orderId)",
  "function onOrderMatched(uint256 orderId, uint256 matchedAmount, uint256 matchedValue)",
  "function claimUnlocked() returns (uint256)",
  "function claimUnlocked(address vault) returns (uint256)",
  "function redeem(address market)",
  "function asset() view returns (address)",
  "function isMarket(address market) view returns (bool)",
  "function orderOwners(uint256 orderId) view returns (address)",
  "function lockedBalance(address user) view returns (uint256)",
  "function claimableBalance(address user) view returns (uint256)",
  "function availableBalance(address user) view returns (uint256)",
  "function pendingBalance(address user) view returns (uint256)",
  "function totalBalance(address user) view returns (uint256)",
  "function nextUnlock(address user) view returns (uint256 amount, uint64 unlockTime)",
  "function getLockEntries(address user) view returns (uint256[] amounts, uint64[] unlockTimes)",
  "function setSettlementSink(address sink, bool allowed)",
  "function claimSettlementRoot(address market, uint256 batchId, int256 pnlWad, bytes32[] proof)",
]);

export const GOVERNOR_VAULT_V4_ABI = parseAbi([
  "function asset() view returns (address)",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address user) view returns (uint256)",
  "function totalLockedExposure() view returns (uint256)",
  "function totalLockedProceeds() view returns (uint256)",
  "function convertToShares(uint256 assets) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)",
  "function lockedBalance(address user) view returns (uint256)",
  "function claimableBalance(address user) view returns (uint256)",
  "event Deposit(address indexed user, address indexed receiver, uint256 assets, uint256 shares)",
  "event Withdraw(address indexed user, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)",
  "event Locked(address indexed user, uint256 amount, uint64 unlockTime)",
  "event Unlocked(address indexed user, uint256 amount)",
  "event Claimed(address indexed user, uint256 amount)",
]);

export const MARKET_V4_ABI = parseAbi([
  "function qYes() view returns (int256)",
  "function qNo() view returns (int256)",
  "function _cost(int256 qYes, int256 qNo, uint256 b) view returns (int256)",
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
  "function split(uint256 amount)",
]);

export const LAUNCHPAD_FACTORY_ABI = parseAbi([
  "function createMarket(string name, string symbol, string description, uint8 liquidityTierIndex, bool isOpenEnd, uint40 durationSeconds, address marketAdjudicator) returns (address market)",
  "function tierDeposits(uint256 tier) view returns (uint256)",
  "function tierBValues(uint256 tier) view returns (uint256)",
  "function usdc() view returns (address)",
  "function getAllMarkets() view returns (address[])",
  "function protocolConfig() view returns (address)",
  "function adjudicatorRegistry() view returns (address)",
  "event MarketCreated(address indexed market, address indexed creator, string name, string symbol, uint256 liquidityTier, uint256 depositAmount, address adjudicator)",
]);

export const SOOTH_ADJUDICATOR_REGISTRY_ABI = parseAbi([
  "function isAdjudicator(address adjudicator) view returns (bool)",
  "function getAdjudicatorClass(address adjudicator) view returns (uint8)",
  "function setAdjudicator(address adjudicator, uint8 classId, bool enabled, bytes32 paramsHash)",
  "event AdjudicatorConfigured(address indexed adjudicator, uint8 classId, bool enabled, bytes32 paramsHash)",
]);

export const LAUNCHPAD_MARKET_ABI = parseAbi([
  "function qYes() view returns (int256)",
  "function qNo() view returns (int256)",
  "function b() view returns (uint256)",
  "function bBase() view returns (uint256)",
  "function price(uint8 outcome) view returns (uint256)",
  "function isLive() view returns (bool)",
  "function isSettled() view returns (bool)",
  "function winningOutcome() view returns (uint8)",
  "function adjudicator() view returns (address)",
  "function tStar() view returns (uint256)",
  "function yesBalance(address user) view returns (uint256)",
  "function noBalance(address user) view returns (uint256)",
  "function outcomeToken() view returns (address)",
  "function merge(uint256 amount) returns (uint256 proceeds)",
  "function split(uint256 amount)",
  "function isGraduated() view returns (bool)",
  "function graduationThreshold() view returns (uint256)",
  "function deadline() view returns (uint40)",
  "function creator() view returns (address)",
  "function factory() view returns (address)",
  "function totalLockedProceeds() view returns (uint256)",
  "function lockedProceeds(address user) view returns (uint256)",
  "function useLockedProceeds(address user, uint256 amount)",
  "function ammAssets() view returns (uint256)",
  "function pureCeilingAssets() view returns (uint256)",
  "function isUnderwater() view returns (bool)",
  "function totalAssets() view returns (uint256)",
  "function totalNetAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function graduate()",
  "function expire()",
  "function liquidate()",
  "function forceGraduate()",
  "function isLiquidated() view returns (bool)",
  "function claimLiquidationRefund(address user)",
  "function redeemLP(uint256 amount)",
  "function previewRedeemLP(uint256 amount) view returns (uint256)",
  "function claimUnlocked() returns (uint256 claimed)",
  "function claimLockedOnMarketEnd(uint256 maxSteps) returns (uint256 claimed)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function convertToShares(uint256 assets) view returns (uint256)",
  "function finalizeResolution(uint8 outcome, uint256 _tStar)",
  "event MarketGraduated(uint256 totalFeesAccrued, uint256 graduationTimestamp)",
  "event MarketSettled(uint8 outcome, uint256 tStar)",
  "event MarketLiquidated(uint256 liquidationFee, uint256 refundAmount)",
  "event LpTokensRedeemed(address indexed from, uint256 amount, uint256 assets)",
  "event Locked(address indexed user, uint256 amount, uint64 unlockTime)",
  "event TradeAMM(address indexed user, uint8 outcome, int256 deltaShares, int256 cost, uint256 fee)",
]);

export const LAUNCHPAD_QUOTER_ABI = parseAbi([
  "function calculateAMMTradeQuote(address market, uint8 outcome, uint256 shares, bool isBuy) view returns (int256 cost, uint256 fee, uint256 nextFloor, uint256 nextCeiling, uint256 priceImpactBps)",
]);

export const MARKET_LP_VAULT_ABI = parseAbi([
  "function totalAssets() view returns (uint256)",
  "function market() view returns (address)",
  "function asset() view returns (address)",
]);

export const LAUNCHPAD_OUTCOME_TOKEN_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function market() view returns (address)",
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function merge(uint256 amount)",
  "function split(uint256 amount)",
  "function yesBalance(address user) view returns (uint256)",
  "function noBalance(address user) view returns (uint256)",
  // ERC1155 approval
  "function isApprovedForAll(address account, address operator) view returns (bool)",
  "function setApprovalForAll(address operator, bool approved)",
]);

export const PROTOCOL_CONFIG_ABI = parseAbi([
  "function liquidationFeeBps() view returns (uint256)",
  "function guardian() view returns (address)",
  "function setLiquidationFeeBps(uint256 bps)",
  "function setGuardian(address guardian)",
]);

export const SOOTH_MANUAL_ADJUDICATOR_ABI = parseAbi([
  "function resolve(address market, uint8 outcome, uint256 tStar)",
  "function adjudicatorClass() view returns (uint8)",
]);

export const SOOTH_OPTIMISTIC_ADJUDICATOR_ABI = parseAbi([
  "function propose(address market, uint8 outcome, uint256 tStar)",
  "function dispute(address market)",
  "function finalize(address market)",
  "function proposals(address market) view returns (uint8 outcome, uint256 tStar, uint256 timestamp, address proposer, bool disputed)",
  "function adjudicatorClass() view returns (uint8)",
  "function challengeWindow() view returns (uint256)",
]);

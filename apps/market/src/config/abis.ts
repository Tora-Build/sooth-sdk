import { parseAbi } from 'viem';

export const LAUNCHPAD_ENGINE_ABI = parseAbi([
  'function getMarkets() view returns (address[])',
  'function markets(address) view returns (address truthMarket, address ammEngine, address soothBook, uint256 deposit, bool isGraduated)',
  'function trialStates(address) view returns (uint256 initialLiquidity, uint256 feesAccrued, uint256 lpTokenSupply)',
]);

export const SOOTH_BOOK_ABI = parseAbi([
  'function markets(bytes32) view returns (address, address, address, bool, bool, uint8)',
  'function buyYes(bytes32 marketKey, uint16 tick, uint128 amount, bool escrow, uint256 maxCost)',
  'function buyNo(bytes32 marketKey, uint16 tick, uint128 amount, bool escrow, uint256 maxCost)',
  'function mint(bytes32 marketKey, uint256 amount)',
  'function merge(bytes32 marketKey, uint256 amount)',
  'function cancel(bytes32 marketKey, uint8 side, uint16 tick)',
  'function cancelById(uint64 orderId)',
  'function redeem(bytes32 marketKey)',
  'function getImpliedPrice(bytes32 marketKey) view returns (uint256, uint256)',
  'function getBestTick(bytes32 marketKey, uint8 side) view returns (uint16)',
  'function getBalance(bytes32 marketKey, address user) view returns (uint256, uint256)',
  'function getOrdersAtTick(bytes32 marketKey, uint8 side, uint16 tick) view returns (uint256 totalAmount, uint256 orderCount)',
]);

export const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
]);

export const TRUTH_MARKET_ABI = parseAbi([
  'function question() view returns (string)',
  'function isSettled() view returns (bool)',
  'function isFinalized() view returns (bool)',
  'function outcome() view returns (uint8)',
]);

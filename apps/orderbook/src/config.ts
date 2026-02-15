import { createPublicClient, http, parseAbi, type Address } from 'viem'
import { baseSepolia } from 'viem/chains'

export const SOOTHBOOK_ADDRESS = '0x9a992959490578c8f171C25BC8615E9Cc1AA2aB8' as Address
export const MOCK_USDC = '0x39d579b27011FCE3f944Aa0DfBb1885279c9eD89' as Address

export const SOOTHBOOK_ABI = parseAbi([
  'function markets(bytes32) view returns (address collateral, address yesToken, address noToken, bool active, bool finalized, uint8 outcome)',
  'function getBalance(bytes32, address) view returns (uint256 yes, uint256 no)',
  'function getCollateralBacking(bytes32) view returns (uint256)',
  'function getBestTick(bytes32, uint8) view returns (uint16)',
  'function getOrdersAtTick(bytes32, uint8, uint16) view returns (uint256 totalAmount, uint256 orderCount)',
  'function getImpliedPrice(bytes32) view returns (uint256 yesPrice, uint256 noPrice)',
])

export const client = createPublicClient({
  chain: baseSepolia,
  transport: http(),
})

export interface MarketInfo {
  marketKey: `0x${string}`
  question: string
  collateral: Address
  yesToken: Address
  noToken: Address
}

export const MARKETS: MarketInfo[] = [
  {
    marketKey: '0x79a7bc6308ae7267ddd3776d02ad1446f41d1e3ed74ed41b5184fc53cc8bd5b5',
    question: 'Will BTC hit $100k by end of 2026?',
    collateral: MOCK_USDC,
    yesToken: '0x7C68410557A837B4Cc0f9595CA75186e4A66a705' as Address,
    noToken: '0x04280B7C3584c4fd66885d2C32F3B89c1C4eE972' as Address,
  },
]

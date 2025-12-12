// V4 ABI Exports
import TraderVaultV4ABI from './v4/SoothTraderVaultV4.json'
import MarketV4ABI from './v4/SoothMarketV4.json'
import OutcomeTokenABI from './v4/OutcomeToken.json'
import GovernorVaultABI from './v4/SoothGovernorVault.json'

export const V4_ABIS = {
    TraderVaultV4: TraderVaultV4ABI.abi,
    MarketV4: MarketV4ABI.abi,
    OutcomeToken: OutcomeTokenABI.abi,
    GovernorVault: GovernorVaultABI.abi,
} as const

export { TraderVaultV4ABI, MarketV4ABI, OutcomeTokenABI, GovernorVaultABI }

import TraderVaultV4ABI from './SoothTraderVault.json'
import MarketV4ABI from './SoothMarket.json'
import OutcomeTokenABI from './OutcomeToken.json'
import GovernorVaultABI from './SoothGovernorVault.json'

export const V4_ABIS = {
    TraderVaultV4: TraderVaultV4ABI.abi,
    MarketV4: MarketV4ABI.abi,
    OutcomeToken: OutcomeTokenABI.abi,
    GovernorVault: GovernorVaultABI.abi,
} as const

export { TraderVaultV4ABI, MarketV4ABI, OutcomeTokenABI, GovernorVaultABI }

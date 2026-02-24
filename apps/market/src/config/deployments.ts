// Base Sepolia V12 deployments
export const DEPLOYMENTS = {
  84532: {
    MockUSDC: '0x51073241ff403cd900008569714e0c9605f65a79',
    ProtocolConfig: '0xd19842d2cbcb6146460e6639db1571787620583f',
    Collateralizer: '0x956e8ad7b35c5270fc737ceddfcd7d894a1e5574',
    AMMEngine: '0x1d736e5008b775948e0cbd06bbf0074d48a9803a',
    SoothBook: '0x0eb179c7e79e62bac3ee40d379425e32cb00d22b',
    LaunchpadEngine: '0xf00fb446d1262d1f4100e6d899cf0c8c298a6e61',
  },
} as const;

export function getDeployment(chainId: number) {
  return DEPLOYMENTS[chainId as keyof typeof DEPLOYMENTS];
}

export type DeploymentKey = keyof typeof DEPLOYMENTS[84532];

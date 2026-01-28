import type { Address } from 'viem';

interface MarketSetupBannerProps {
  marketAddress: Address;
  marketState: number | undefined;
  launchpadCreator: string | undefined;
  truthCreator: string | undefined;
  onComplete?: () => void;
}

export const MarketSetupBanner = (_props: MarketSetupBannerProps) => null;

/**
 * Local overrides for on-chain question strings that were stored without Source URLs.
 * These markets were created before the validation was added.
 * Key: lowercase market address → corrected question string.
 */
export const QUESTION_OVERRIDES: Record<string, string> = {
  '0xb5630ada6ee7a9af186c9fb182e402dfa0d171bb':
    '@SoothSayer Will ETH trade above $2,800 on Feb 12, 2026? Source: https://moltbook.com/post/6f0ed709-7800-433b-8e2f-3f73c00717ec',
  '0x23384a4369abb07a378c6568b59f370ac27bfb27':
    '@SoothSayer Will OpenAI announce GPT-5 by March 31, 2026? Source: https://moltbook.com/post/44bcfb61-bea7-439b-b601-f67c791b727c',
  '0x4973d8faa48dc5189e879caf8a7acd7c6a5c2bad':
    '@SoothSayer Will SpaceX Starship complete a successful orbital flight by March 31, 2026? Source: https://moltbook.com/post/3d2f4ad0-4e3e-4829-b13e-32342651c4f0',
  '0xc157e406ed743e6823574baa80ac42004a10e7fb':
    '@SoothSayer Will the US Federal Reserve cut interest rates in Q1 2026? Source: https://moltbook.com/post/01d528a5-69eb-4147-b74d-a898be196c1f',
  '0x7a56e59eec577dffc142ce6339c944d354f35782':
    '@SoothSayer Will multi-agent production systems become mainstream by end of 2026? Source: https://moltbook.com/post/9453d46d-69dd-4a49-bbd6-80ca5d2d3da1',
  '0xecfa65411d52dfd9e961bcb0d8fb396282edf835':
    '@SoothSayer Will Apple announce Vision Pro 2 by March 31, 2026? Source: https://moltbook.com/post/d582f595-30e8-431d-b3e5-83b9b5d2cf74',
};

export function getDisplayQuestion(address: string, onchainQuestion: string): string {
  return QUESTION_OVERRIDES[address.toLowerCase()] ?? onchainQuestion;
}

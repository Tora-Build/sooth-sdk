/**
 * Mapping of market addresses (lowercase) to Moltbook discussion post URLs.
 * Updated by the repost queue as markets are posted.
 */
export const MOLTBOOK_LINKS: Record<string, string> = {
  // BTC $75K — post deleted, needs repost after suspension lifts
  // '0xd1964c571b4013dee036d7f8b14d4f9b02636b51': 'https://moltbook.com/post/32ca597b-3cbe-418d-a566-b0c9cb23fbc7',
  // AI Security Breach
  '0xe3268a1e1180dd1bca33f8f4df6b6735de55fa57': 'https://moltbook.com/post/b47bd18d-ec6d-4c54-a339-c300b5771e00',
  // AI Patent Co-Author
  '0x3c7ab81b625daf9bec03dab5a67f6e6be56ed426': 'https://moltbook.com/post/8e6cb590-7b02-430d-b5cf-175432d738a1',
  // GPT-5 Announce (March 2026)
  '0x23384a4369abb07a378c6568b59f370ac27bfb27': 'https://moltbook.com/post/5d5f032f-7cb0-4ddb-a77e-9153c7c75ff6',
  // SpaceX Starship Orbital
  '0x4973d8faa48dc5189e879caf8a7acd7c6a5c2bad': 'https://moltbook.com/post/15514d99-e4e2-4ba1-b5d8-80dbc52c2f25',
  // Fed Rate Cut Q1 2026
  '0xc157e406ed743e6823574baa80ac42004a10e7fb': 'https://moltbook.com/post/aac4f2ef-4930-4a42-967f-9c7a830465b5',
  // Multi-Agent Systems Mainstream
  '0x7a56e59eec577dffc142ce6339c944d354f35782': 'https://moltbook.com/post/7dac95fd-90ab-417c-ad5a-18a022beee79',
  // Apple Vision Pro 2
  '0xecfa65411d52dfd9e961bcb0d8fb396282edf835': 'https://moltbook.com/post/7fd2f8b6-9778-4e6a-8563-5efab3060118',
  // HYPE $50
  '0x3f1a11c81e3ca5937068dd7946d51f2efdd6568f': 'https://moltbook.com/post/b29f1523-6285-4379-8d37-92f793a7230c',
  // BTC $100K (March 2026)
  '0x0a3f9b6408d3d830f2f98068713fb01ffb860118': 'https://moltbook.com/post/2a9674e0-dedb-4f3b-8120-72cfb36ef505',
  // GPT-5 Release 2026
  '0x0756f2414631a8a9ea3c06fdf88d50442be9ed6a': 'https://moltbook.com/post/47812e51-a053-4efd-acea-6e8bd65554d3',
  // BTC $150K (Dec 2026)
  '0xd1277f8faae78fdc03886912519937377c7ce9c6': 'https://moltbook.com/post/c7fb3f81-4f11-4340-aded-a623efbc9f61',
};

export function getMoltbookLink(address: string): string | undefined {
  return MOLTBOOK_LINKS[address.toLowerCase()];
}

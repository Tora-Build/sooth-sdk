/**
 * Mapping of market addresses (lowercase) to Moltbook discussion post URLs.
 * Updated by the repost queue as markets are posted.
 */
export const MOLTBOOK_LINKS: Record<string, string> = {
  // BTC $75K
  '0xd1964c571b4013dee036d7f8b14d4f9b02636b51': 'https://moltbook.com/post/32ca597b-3cbe-418d-a566-b0c9cb23fbc7',
  // AI Security Breach
  '0xe3268a1e1180dd1bca33f8f4df6b6735de55fa57': 'https://moltbook.com/post/b47bd18d-ec6d-4c54-a339-c300b5771e00',
  // AI Patent Co-Author
  '0x3c7ab81b625daf9bec03dab5a67f6e6be56ed426': 'https://moltbook.com/post/8e6cb590-7b02-430d-b5cf-175432d738a1',
};

export function getMoltbookLink(address: string): string | undefined {
  return MOLTBOOK_LINKS[address.toLowerCase()];
}

const KEYWORD_IMAGES: Record<string, string> = {
  btc: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&h=400&fit=crop',
  bitcoin: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&h=400&fit=crop',
  eth: 'https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=800&h=400&fit=crop',
  ethereum: 'https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=800&h=400&fit=crop',
  crypto: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&h=400&fit=crop',
  trump: 'https://images.unsplash.com/photo-1580128660010-fd027e1e587a?w=800&h=400&fit=crop',
  election: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=800&h=400&fit=crop',
  president: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=800&h=400&fit=crop',
  ai: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=400&fit=crop',
  openai: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=400&fit=crop',
  gpt: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=400&fit=crop',
  spacex: 'https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?w=800&h=400&fit=crop',
  mars: 'https://images.unsplash.com/photo-1614728263952-84ea256f9679?w=800&h=400&fit=crop',
  nba: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&h=400&fit=crop',
  basketball: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&h=400&fit=crop',
  nfl: 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=800&h=400&fit=crop',
  football: 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=800&h=400&fit=crop',
  soccer: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=400&fit=crop',
  stock: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=400&fit=crop',
  market: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=400&fit=crop',
  apple: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&h=400&fit=crop',
  tesla: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800&h=400&fit=crop',
  hype: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&h=400&fit=crop',
  monad: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&h=400&fit=crop',
};

const DEFAULT_IMAGES = [
  'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&h=400&fit=crop',
  'https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=800&h=400&fit=crop',
  'https://images.unsplash.com/photo-1634704784915-aacf363b021f?w=800&h=400&fit=crop',
  'https://images.unsplash.com/photo-1620321023374-d1a68fbc720d?w=800&h=400&fit=crop',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=400&fit=crop',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&h=400&fit=crop',
];

export function getMarketImage(question: string, address: string): string {
  const lowerQuestion = question.toLowerCase();
  
  for (const [keyword, imageUrl] of Object.entries(KEYWORD_IMAGES)) {
    if (lowerQuestion.includes(keyword)) {
      return imageUrl;
    }
  }
  
  const hash = parseInt(address.slice(2, 10), 16);
  return DEFAULT_IMAGES[hash % DEFAULT_IMAGES.length];
}

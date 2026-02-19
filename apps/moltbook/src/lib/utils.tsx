import { ExternalLink } from 'lucide-react';

// Map old (deleted) moltbook post IDs to new reposted ones
const MOLTBOOK_REDIRECTS: Record<string, string> = {
  '71e2e2b3-ff67-49e6-8880-013a0cb197dd': '', // AI gig economy — not yet reposted
  '1cdb951b-f245-4b21-98b6-c5a9c5fea782': 'c7fb3f81-4f11-4340-aded-a623efbc9f61', // BTC $150K
  '9453d46d-69dd-4a49-bbd6-80ca5d2d3da1': '7dac95fd-90ab-417c-ad5a-18a022beee79', // Multi-agent
  '45536c8b-37dc-4c1e-a9a5-5d44232a2f41': 'b47bd18d-ec6d-4c54-a339-c300b5771e00', // AI breach
  '121ef411-661f-4a0c-8de8-c73be2479076': '2a9674e0-dedb-4f3b-8120-72cfb36ef505', // BTC $100K
  '01d528a5-69eb-4147-b74d-a898be196c1f': 'aac4f2ef-4930-4a42-967f-9c7a830465b5', // Fed rate
  '3d2f4ad0-4e3e-4829-b13e-32342651c4f0': '15514d99-e4e2-4ba1-b5d8-80dbc52c2f25', // SpaceX
  'f88ab8f1-ddc5-42d3-9b1e-cb891a1efaea': 'b29f1523-6285-4379-8d37-92f793a7230c', // HYPE $50
  '5ac527fd-26d4-467e-b56e-cf298ff88ee8': '32ca597b-3cbe-418d-a566-b0c9cb23fbc7', // BTC $75K — also deleted, will fix later
  '6f0ed709-7800-433b-8e2f-3f73c00717ec': '5d5f032f-7cb0-4ddb-a77e-9153c7c75ff6', // GPT-5 announce
  'd582f595-5fa1-42ed-a3b1-89b9dbeeed11': '7fd2f8b6-9778-4e6a-8563-5efab3060118', // Vision Pro 2
  '44bcfb61-e3a5-4e8f-b424-04b17b6dc82c': '47812e51-a053-4efd-acea-6e8bd65554d3', // GPT-5 release
};

function fixMoltbookUrl(url: string): string | null {
  const match = url.match(/moltbook\.com\/post\/([a-f0-9-]+)/);
  if (!match) return url;
  const oldId = match[1];
  const newId = MOLTBOOK_REDIRECTS[oldId];
  if (newId === undefined) return url; // not a redirected post
  if (newId === '') return null; // post not yet reposted, hide link
  return url.replace(oldId, newId);
}

const MENTION_URL_REGEX = /(https?:\/\/[^\s]+|@\w+)/g;

export function parseTextWithLinks(text: string): React.ReactNode[] {
  const parts = text.split(MENTION_URL_REGEX);
  return parts.map((part, index) => {
    if (part.startsWith('http')) {
      const fixedUrl = fixMoltbookUrl(part);
      if (fixedUrl === null) return null; // hide dead links
      part = fixedUrl;
      let displayText: string;
      let isMoltbook = false;
      try {
        const url = new URL(part);
        displayText = url.hostname.replace('www.', '');
        isMoltbook = url.hostname.includes('moltbook.com');
      } catch {
        displayText = 'link';
      }
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 text-[#00d4aa] hover:text-[#00b894] underline underline-offset-2"
        >
          {isMoltbook ? (
            <img 
              src="https://moltbook.com/moltbook-mascot.png" 
              alt="Moltbook" 
              className="w-5 h-5 inline-block"
            />
          ) : null}
          {displayText}
          <ExternalLink className="w-4 h-4" />
        </a>
      );
    } else if (part.startsWith('@')) {
      const username = part.slice(1);
      return (
        <a
          key={index}
          href={`https://moltbook.com/u/${username}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="font-bold text-[#00d4aa] hover:underline"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

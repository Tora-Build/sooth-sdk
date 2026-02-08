import { ExternalLink } from 'lucide-react';

const MENTION_URL_REGEX = /(https?:\/\/[^\s]+|@\w+)/g;

export function parseTextWithLinks(text: string): React.ReactNode[] {
  const parts = text.split(MENTION_URL_REGEX);
  return parts.map((part, index) => {
    if (part.startsWith('http')) {
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

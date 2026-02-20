import { useState } from 'react';
import { Loader2, Search as SearchIcon } from 'lucide-react';
import { useLensFeed, type LensPost } from '../hooks/useLensFeed';
import { LensPostCard } from '../components/LensPostCard';

const TAGS = ['sooth-market', 'crypto', 'politics', 'sports', 'tech', 'defi', 'culture'] as const;

function TagChip({
  tag,
  isActive,
  onClick,
}: {
  tag: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-4 py-2 rounded-full font-medium text-sm transition-all ${
        isActive
          ? 'bg-[#00d4aa] text-black'
          : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
      }`}
    >
      {tag}
    </button>
  );
}

function EmptyState({ tag }: { tag: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
        <SearchIcon className="w-8 h-8 text-[#888]" />
      </div>
      <h3 className="text-lg font-bold text-white mb-2">No markets found</h3>
      <p className="text-sm text-[#888]">
        No markets found for <span className="text-[#00d4aa]">#{tag}</span>
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="w-8 h-8 text-[#00d4aa] animate-spin mb-3" />
      <p className="text-sm text-[#888]">Loading markets…</p>
    </div>
  );
}

export function Search() {
  const [selectedTag, setSelectedTag] = useState<string>('sooth-market');
  const { data: posts, isLoading } = useLensFeed(selectedTag);

  const filteredPosts = (posts ?? []).filter((post: LensPost) =>
    post.tags.includes(selectedTag)
  );

  return (
    <div className="min-h-dvh w-full flex flex-col bg-mesh text-white">
      <header className="shrink-0 pt-4 px-4 pb-4 border-b border-white/10">
        <h1 className="text-lg font-bold mb-4">Search Markets</h1>

        <div className="overflow-x-auto -mx-4 px-4 pb-2">
          <div className="flex gap-2">
            {TAGS.map((tag) => (
              <TagChip
                key={tag}
                tag={tag}
                isActive={selectedTag === tag}
                onClick={() => setSelectedTag(tag)}
              />
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <LoadingState />
        ) : filteredPosts.length === 0 ? (
          <EmptyState tag={selectedTag} />
        ) : (
          <div className="divide-y divide-white/10">
            {filteredPosts.map((post) => (
              <LensPostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

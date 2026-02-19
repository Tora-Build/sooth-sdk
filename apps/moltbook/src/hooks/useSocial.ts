import { useState, useEffect, useCallback } from 'react';

const LIKES_KEY = 'sooth-lite-likes';

function getLikedMarkets(): Set<string> {
  try {
    const stored = localStorage.getItem(LIKES_KEY);
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
}

function saveLikedMarkets(likes: Set<string>) {
  localStorage.setItem(LIKES_KEY, JSON.stringify([...likes]));
}

export function useLikes(marketAddress: string) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    const likes = getLikedMarkets();
    setIsLiked(likes.has(marketAddress));
    const baseCount = Math.floor(parseInt(marketAddress.slice(2, 6), 16) % 2000) + 100;
    setLikeCount(baseCount + (likes.has(marketAddress) ? 1 : 0));
  }, [marketAddress]);

  const toggleLike = useCallback(() => {
    const likes = getLikedMarkets();
    if (likes.has(marketAddress)) {
      likes.delete(marketAddress);
      setIsLiked(false);
      setLikeCount((c) => c - 1);
    } else {
      likes.add(marketAddress);
      setIsLiked(true);
      setLikeCount((c) => c + 1);
    }
    saveLikedMarkets(likes);
  }, [marketAddress]);

  return { isLiked, likeCount, toggleLike };
}

export function useShare() {
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  const share = useCallback(async (title: string, text: string, url?: string) => {
    if (canShare) {
      try {
        await navigator.share({
          title,
          text,
          url: url ?? window.location.href,
        });
        return true;
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          console.warn('Share failed:', e);
        }
        return false;
      }
    }
    
    try {
      await navigator.clipboard.writeText(url ?? window.location.href);
      return true;
    } catch {
      return false;
    }
  }, [canShare]);

  return { canShare, share };
}

export function useComments(marketAddress: string) {
  const baseCount = Math.floor(parseInt(marketAddress.slice(6, 10), 16) % 500) + 20;
  return { commentCount: baseCount };
}

import { useCallback, useState } from 'react';
import {
  addReaction,
  undoReaction,
  bookmarkPost,
  undoBookmarkPost,
  fetchPostReactionStatus,
} from '@lens-protocol/client/actions';
import {
  postId,
  PostReactionType,
  evmAddress,
} from '@lens-protocol/client';
import { useLensAuth } from './useLensAuth';
import { getLensClient } from '../lib/lensClient';

export interface UseUpvoteResult {
  isUpvoted: boolean;
  count: number;
  toggle: () => void;
  isLoading: boolean;
}

export interface UseBookmarkResult {
  isBookmarked: boolean;
  toggle: () => void;
  isLoading: boolean;
}

export function useUpvote(targetPostId: string, initialCount: number): UseUpvoteResult {
  const { sessionClient, isAuthenticated, lensAccount } = useLensAuth();

  const [isUpvoted, setIsUpvoted] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const [hasCheckedStatus, setHasCheckedStatus] = useState(false);

  if (isAuthenticated && lensAccount && !hasCheckedStatus) {
    setHasCheckedStatus(true);
    const client = getLensClient();
    void fetchPostReactionStatus(client, {
      pairs: [{
        account: evmAddress(lensAccount),
        post: postId(targetPostId),
      }],
    }).then((result) => {
      if (!result.isErr() && result.value.length > 0) {
        const status = result.value[0];
        if (status.result) {
          setIsUpvoted(true);
        }
      }
    });
  }

  const toggle = useCallback(() => {
    if (!sessionClient || !isAuthenticated || isLoading) return;

    const wasUpvoted = isUpvoted;
    const prevCount = count;

    setIsUpvoted(!wasUpvoted);
    setCount(wasUpvoted ? prevCount - 1 : prevCount + 1);
    setIsLoading(true);

    const action = wasUpvoted
      ? undoReaction(sessionClient, {
          post: postId(targetPostId),
          reaction: PostReactionType.Upvote,
        })
      : addReaction(sessionClient, {
          post: postId(targetPostId),
          reaction: PostReactionType.Upvote,
        });

    void action.then((result) => {
      if (result.isErr()) {
        setIsUpvoted(wasUpvoted);
        setCount(prevCount);
        console.error('[useUpvote] Failed:', result.error);
      }
      setIsLoading(false);
    });
  }, [sessionClient, isAuthenticated, isLoading, isUpvoted, count, targetPostId]);

  return { isUpvoted, count, toggle, isLoading };
}

export function useBookmark(targetPostId: string): UseBookmarkResult {
  const { sessionClient, isAuthenticated } = useLensAuth();

  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const toggle = useCallback(() => {
    if (!sessionClient || !isAuthenticated || isLoading) return;

    const wasBookmarked = isBookmarked;

    setIsBookmarked(!wasBookmarked);
    setIsLoading(true);

    const action = wasBookmarked
      ? undoBookmarkPost(sessionClient, { post: postId(targetPostId) })
      : bookmarkPost(sessionClient, { post: postId(targetPostId) });

    void action.then((result) => {
      if (result.isErr()) {
        setIsBookmarked(wasBookmarked);
        console.error('[useBookmark] Failed:', result.error);
      }
      setIsLoading(false);
    });
  }, [sessionClient, isAuthenticated, isLoading, isBookmarked, targetPostId]);

  return { isBookmarked, toggle, isLoading };
}

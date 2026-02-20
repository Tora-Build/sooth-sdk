import { useState, useCallback, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { fetchPostReferences } from '@lens-protocol/client/actions';
import { post as lensPost } from '@lens-protocol/client/actions';
import { postId, PostReferenceType, uri } from '@lens-protocol/client';
import { textOnly } from '@lens-protocol/metadata';
import { StorageClient, immutable } from '@lens-chain/storage-client';
import { getLensClient } from '../lib/lensClient';
import { useLensAuth } from '../hooks/useLensAuth';
import { ACTIVE_LENS_CHAIN_ID } from '../lib/lensConfig';

interface Comment {
  id: string;
  author: {
    address: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
  };
  content: string;
  timestamp: string;
}

interface CommentThreadProps {
  postId: string;
  commentCount: number;
}

function CommentAvatar({ src, username }: { src: string | null; username: string | null }) {
  if (src) {
    return (
      <img
        src={src}
        alt={username ?? 'avatar'}
        className="w-7 h-7 rounded-full object-cover bg-[#2d2d2e]"
      />
    );
  }

  const letter = username?.[0]?.toUpperCase() ?? '?';
  const colors = [
    'from-emerald-500 to-teal-600',
    'from-violet-500 to-purple-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-cyan-500 to-blue-600',
  ];
  const idx = (username ?? '').charCodeAt(0) % colors.length;

  return (
    <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${colors[idx]} flex items-center justify-center`}>
      <span className="text-white text-[10px] font-bold">{letter}</span>
    </div>
  );
}

function timeAgo(timestamp: string): string {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function extractComment(item: Record<string, unknown>): Comment | null {
  const typename = item.__typename as string | undefined;
  if (typename !== 'Post') return null;

  const meta = item.metadata as Record<string, unknown> | undefined;
  let content: string | null = null;

  const metaType = meta?.__typename as string | undefined;
  if (metaType === 'TextOnlyMetadata' || metaType === 'ArticleMetadata') {
    content = (meta?.content as string) ?? null;
  }

  if (!content) return null;

  const author = item.author as Record<string, unknown> | undefined;
  const authorMeta = author?.metadata as Record<string, unknown> | undefined;
  const picture = authorMeta?.picture as Record<string, unknown> | undefined;
  const optimized = (picture?.__typename === 'ImageSet')
    ? (picture?.optimized as Record<string, unknown> | undefined)?.uri as string | undefined
    : undefined;

  const usernameObj = author?.username as Record<string, unknown> | undefined;

  return {
    id: item.id as string,
    author: {
      address: (author?.address as string) ?? '',
      username: (usernameObj?.value as string) ?? null,
      displayName: (authorMeta?.name as string) ?? null,
      avatar: optimized ?? null,
    },
    content,
    timestamp: (item.timestamp as string) ?? '',
  };
}

export function CommentThread({ postId: targetPostId, commentCount }: CommentThreadProps) {
  const { sessionClient, isAuthenticated } = useLensAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  useEffect(() => {
    if (hasFetched) return;
    setHasFetched(true);
    setIsLoadingComments(true);

    const client = getLensClient();
    void fetchPostReferences(client, {
      referencedPost: postId(targetPostId),
      referenceTypes: [PostReferenceType.CommentOn],
    }).then((result) => {
      if (!result.isErr()) {
        const items = result.value.items as unknown as Array<Record<string, unknown>>;
        const parsed = items.map(extractComment).filter((c): c is Comment => c !== null);
        setComments(parsed);
      }
      setIsLoadingComments(false);
    });
  }, [targetPostId, hasFetched]);

  const handlePostComment = useCallback(async () => {
    if (!sessionClient || !commentText.trim() || isPosting) return;

    setIsPosting(true);
    setPostError(null);

    try {
      const metadata = textOnly({ content: commentText.trim() });
      const storageClient = StorageClient.create();
      const uploadResult = await storageClient.uploadAsJson(metadata, {
        acl: immutable(ACTIVE_LENS_CHAIN_ID),
      });

      const result = await lensPost(sessionClient, {
        contentUri: uri(uploadResult.uri),
        commentOn: { post: postId(targetPostId) },
      });

      if (result.isErr()) {
        setPostError(result.error.message);
        return;
      }

      setCommentText('');

      const client = getLensClient();
      const refreshResult = await fetchPostReferences(client, {
        referencedPost: postId(targetPostId),
        referenceTypes: [PostReferenceType.CommentOn],
      });

      if (!refreshResult.isErr()) {
        const items = refreshResult.value.items as unknown as Array<Record<string, unknown>>;
        const parsed = items.map(extractComment).filter((c): c is Comment => c !== null);
        setComments(parsed);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to post comment';
      setPostError(message);
    } finally {
      setIsPosting(false);
    }
  }, [sessionClient, commentText, isPosting, targetPostId]);

  return (
    <div className="border-t border-[#2d2d2e] bg-[#1a1a1b]">
      {isLoadingComments ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 text-[#888] animate-spin" />
        </div>
      ) : comments.length === 0 && commentCount === 0 ? (
        <p className="text-sm text-[#888] text-center py-4">No comments yet</p>
      ) : (
        <div className="divide-y divide-[#2d2d2e]">
          {comments.map((comment) => {
            const displayName = comment.author.displayName ?? comment.author.username ?? comment.author.address.slice(0, 10);
            const handle = comment.author.username
              ? `@${comment.author.username.replace('lens/', '')}`
              : comment.author.address.slice(0, 8) + '...';

            return (
              <div key={comment.id} className="flex gap-2.5 px-4 py-3">
                <CommentAvatar src={comment.author.avatar} username={comment.author.username} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-semibold text-white truncate">{displayName}</span>
                    <span className="text-[#888] text-xs truncate">{handle}</span>
                    <span className="text-[#888] text-[10px] shrink-0">· {timeAgo(comment.timestamp)}</span>
                  </div>
                  <p className="text-[13px] text-[#e0e0e0] leading-relaxed whitespace-pre-wrap break-words">
                    {comment.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="px-4 py-3 border-t border-[#2d2d2e]">
        {isAuthenticated ? (
          <div className="flex gap-2 items-end">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handlePostComment(); } }}
              placeholder="Write a comment..."
              className="flex-1 bg-[#2d2d2e] text-sm text-white placeholder-[#666] rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#00d4aa]/50"
              disabled={isPosting}
            />
            <button
              onClick={() => void handlePostComment()}
              disabled={!commentText.trim() || isPosting}
              className="p-2 rounded-lg bg-[#00d4aa]/10 text-[#00d4aa] hover:bg-[#00d4aa]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Post comment"
            >
              {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        ) : (
          <p className="text-sm text-[#888] text-center">
            Sign in with Lens to comment
          </p>
        )}
        {postError && (
          <p className="text-xs text-red-400 mt-1.5">{postError}</p>
        )}
      </div>
    </div>
  );
}

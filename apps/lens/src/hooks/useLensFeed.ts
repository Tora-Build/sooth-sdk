/**
 * Lens Feed Hook
 *
 * Fetches real posts from Lens mainnet using the V3 SDK.
 */
import { useQuery } from "@tanstack/react-query";
import { getLensClient } from "../lib/lensClient";
import { fetchPosts } from "@lens-protocol/client/actions";

export interface LensPost {
  id: string;
  feedAddress: string;
  author: {
    address: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
  };
  content: string | null;
  contentType: string;
  tags: string[];
  timestamp: string;
  stats: {
    comments: number;
    reposts: number;
    bookmarks: number;
    upvotes: number;
    collects: number;
  };
}

function extractPost(item: any): LensPost | null {
  if (item.__typename !== "Post") return null;

  const meta = item.metadata;
  let content: string | null = null;
  let contentType = meta?.__typename ?? "Unknown";

  if (meta?.__typename === "TextOnlyMetadata") {
    content = meta.content ?? null;
  } else if (meta?.__typename === "ArticleMetadata") {
    content = meta.title ?? meta.content ?? null;
  } else if (meta?.__typename === "ImageMetadata") {
    content = meta.title ?? meta.content ?? null;
  } else if (meta?.__typename === "LinkMetadata") {
    content = meta.content ?? meta.sharingLink ?? null;
  } else if (meta?.__typename === "VideoMetadata") {
    content = meta.title ?? meta.content ?? null;
  }

  const author = item.author;
  const avatar = author?.metadata?.picture?.__typename === "ImageSet"
    ? author.metadata.picture.optimized?.uri ?? null
    : null;

  return {
    id: item.id,
    feedAddress: item.feed?.address ?? '',
    author: {
      address: author?.address ?? "",
      username: author?.username?.value ?? null,
      displayName: author?.metadata?.name ?? null,
      avatar,
    },
    content,
    contentType,
    tags: meta?.tags ?? [],
    timestamp: item.timestamp ?? "",
    stats: {
      comments: item.stats?.comments ?? 0,
      reposts: item.stats?.reposts ?? 0,
      bookmarks: item.stats?.bookmarks ?? 0,
      upvotes: item.stats?.upvotes ?? 0,
      collects: item.stats?.collects ?? 0,
    },
  };
}

export function useLensFeed(tag?: string) {
  return useQuery({
    queryKey: ["lens-feed", tag ?? "all"],
    queryFn: async (): Promise<LensPost[]> => {
      const client = getLensClient();

      const filter: any = {};
      if (tag) {
        filter.metadata = { tags: { oneOf: [tag] } };
      }

      const result = await fetchPosts(client, {
        filter: Object.keys(filter).length > 0 ? filter : undefined,
      });

      if (result.isErr()) {
        throw new Error(`Failed to fetch posts: ${JSON.stringify(result.error)}`);
      }

      const posts: LensPost[] = [];
      for (const item of result.value.items) {
        const post = extractPost(item);
        if (post) posts.push(post);
      }

      return posts;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

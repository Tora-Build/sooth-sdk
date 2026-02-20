import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  fetchPosts: vi.fn(),
  getLensClient: vi.fn().mockReturnValue({}),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
}));

vi.mock('@lens-protocol/client/actions', () => ({
  fetchPosts: mocks.fetchPosts,
}));

vi.mock('../lib/lensClient', () => ({
  getLensClient: mocks.getLensClient,
}));

import { useLensFeed, type LensPost } from '../hooks/useLensFeed';

function getQueryOptions() {
  return mocks.useQuery.mock.calls[0][0] as {
    queryKey: unknown[];
    queryFn: () => Promise<LensPost[]>;
    staleTime: number;
    refetchInterval: number;
  };
}

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    __typename: 'Post',
    id: 'post-1',
    feed: { address: '0x1234567890123456789012345678901234567890' },
    metadata: {
      __typename: 'TextOnlyMetadata',
      content: 'Hello world',
      tags: ['sooth'],
    },
    author: {
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      username: { value: 'alice' },
      metadata: {
        name: 'Alice',
        picture: {
          __typename: 'ImageSet',
          optimized: { uri: 'https://example.com/avatar.png' },
        },
      },
    },
    timestamp: '2024-01-01T00:00:00Z',
    stats: { comments: 5, reposts: 3, bookmarks: 1, upvotes: 10, collects: 2 },
    ...overrides,
  };
}

function okResult(items: unknown[]) {
  return { isErr: () => false, value: { items } };
}

function errResult(error: unknown) {
  return { isErr: () => true, error };
}

describe('useLensFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('constructs queryKey with "all" when no tag provided', () => {
    useLensFeed();
    const options = getQueryOptions();
    expect(options.queryKey).toEqual(['lens-feed', 'all']);
  });

  it('constructs queryKey with tag when provided', () => {
    useLensFeed('sooth');
    const options = getQueryOptions();
    expect(options.queryKey).toEqual(['lens-feed', 'sooth']);
  });

  it('queryFn extracts TextOnlyMetadata post correctly', async () => {
    useLensFeed();
    const options = getQueryOptions();

    mocks.fetchPosts.mockResolvedValueOnce(okResult([makePost()]));

    const result = await options.queryFn();
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'post-1',
      feedAddress: '0x1234567890123456789012345678901234567890',
      author: {
        address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        username: 'alice',
        displayName: 'Alice',
        avatar: 'https://example.com/avatar.png',
      },
      content: 'Hello world',
      contentType: 'TextOnlyMetadata',
      tags: ['sooth'],
      timestamp: '2024-01-01T00:00:00Z',
      stats: { comments: 5, reposts: 3, bookmarks: 1, upvotes: 10, collects: 2 },
    });
  });

  it('queryFn filters out non-Post items', async () => {
    useLensFeed();
    const options = getQueryOptions();

    mocks.fetchPosts.mockResolvedValueOnce(
      okResult([
        makePost(),
        { __typename: 'Comment', id: 'comment-1' },
        { __typename: 'Repost', id: 'repost-1' },
      ]),
    );

    const result = await options.queryFn();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('post-1');
  });

  it('queryFn handles ImageMetadata content type', async () => {
    useLensFeed();
    const options = getQueryOptions();

    const imagePost = makePost({
      id: 'post-img',
      metadata: {
        __typename: 'ImageMetadata',
        title: 'My Photo',
        content: null,
        tags: [],
      },
    });
    mocks.fetchPosts.mockResolvedValueOnce(okResult([imagePost]));

    const result = await options.queryFn();
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('My Photo');
    expect(result[0].contentType).toBe('ImageMetadata');
  });

  it('queryFn handles author without avatar', async () => {
    useLensFeed();
    const options = getQueryOptions();

    const noAvatarPost = makePost({
      author: {
        address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        username: null,
        metadata: { name: null, picture: null },
      },
    });
    mocks.fetchPosts.mockResolvedValueOnce(okResult([noAvatarPost]));

    const result = await options.queryFn();
    expect(result[0].author).toEqual({
      address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      username: null,
      displayName: null,
      avatar: null,
    });
  });

  it('queryFn throws on fetchPosts error result', async () => {
    useLensFeed();
    const options = getQueryOptions();

    mocks.fetchPosts.mockResolvedValueOnce(errResult({ message: 'Network error' }));

    await expect(options.queryFn()).rejects.toThrow('Failed to fetch posts');
  });

  it('queryFn returns empty array when no posts', async () => {
    useLensFeed();
    const options = getQueryOptions();

    mocks.fetchPosts.mockResolvedValueOnce(okResult([]));

    const result = await options.queryFn();
    expect(result).toEqual([]);
  });

  it('queryFn passes tag filter to fetchPosts', async () => {
    useLensFeed('prediction');
    const options = getQueryOptions();

    mocks.fetchPosts.mockResolvedValueOnce(okResult([]));
    await options.queryFn();

    expect(mocks.fetchPosts).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        filter: { metadata: { tags: { oneOf: ['prediction'] } } },
      }),
    );
  });

  it('queryFn passes undefined filter when no tag', async () => {
    useLensFeed();
    const options = getQueryOptions();

    mocks.fetchPosts.mockResolvedValueOnce(okResult([]));
    await options.queryFn();

    expect(mocks.fetchPosts).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ filter: undefined }),
    );
  });
});

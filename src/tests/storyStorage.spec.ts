import { describe, expect, it } from 'vitest';
import { StoryStorage } from '@/lib/storyStorage';
import type { Story } from '@/types/story';

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: 'story-1',
    title: 'Demo Story',
    author: 'Test Author',
    description: 'A demo story for tests',
    lastModified: new Date('2024-01-02T03:04:05Z').toISOString(),
    nodes: [],
    ...overrides,
  };
}

describe('StoryStorage (memory fallback, no localStorage in node)', () => {
  it('lists no stories when empty', () => {
    const storage = new StoryStorage();
    expect(storage.listStories()).toEqual([]);
  });

  it('upsert stamps a fresh modification time and returns a summary', () => {
    const storage = new StoryStorage();
    const summary = storage.upsertStory(
      makeStory({ lastModified: '2020-01-01T00:00:00Z' }),
    );
    expect(summary).toMatchObject({
      id: 'story-1',
      title: 'Demo Story',
      author: 'Test Author',
      description: 'A demo story for tests',
    });
    expect(Number.isFinite(Date.parse(summary.lastModified))).toBe(true);
  });

  it('upsert replaces an existing story with the same id (no duplicates)', () => {
    const storage = new StoryStorage();
    storage.upsertStory(makeStory({ title: 'Before' }));
    storage.upsertStory(makeStory({ title: 'After' }));
    const list = storage.listStories();
    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe('After');
    expect(storage.getStory('story-1')?.title).toBe('After');
  });

  it('sorts most-recently modified first', () => {
    const storage = new StoryStorage();
    storage.upsertStory(makeStory({ id: 'old' }));
    const later = new Date(
      Date.now() + 2 * 24 * 60 * 60 * 1000,
    ).toISOString();
    storage.upsertStory(
      makeStory({ id: 'new', title: 'Newer', lastModified: later }),
    );
    // Both got fresh timestamps; the later upsert is newest.
    const list = storage.listStories();
    expect(list).toHaveLength(2);
    expect(Date.parse(list[0]!.lastModified)).toBeGreaterThanOrEqual(
      Date.parse(list[1]!.lastModified),
    );
  });

  it('deleteStory removes a story and reports success/failure', () => {
    const storage = new StoryStorage();
    storage.upsertStory(makeStory());
    expect(storage.deleteStory('story-1')).toBe(true);
    expect(storage.listStories()).toHaveLength(0);
    expect(storage.deleteStory('story-1')).toBe(false);
  });

  it('listStories only returns entries passing the summary boundary check', async () => {
    const { isStorySummary } = await import('@/types/story');
    const corrupt: unknown[] = [
      { ...makeStory(), lastModified: 'not-a-date' },
      { ...makeStory(), lastModified: '2023-02-30T00:00:00Z' },
      { ...makeStory(), id: 42 },
      'just a string',
      null,
    ];
    for (const c of corrupt) {
      expect(isStorySummary(c)).toBe(false);
    }
    const storage = new StoryStorage();
    storage.upsertStory(makeStory());
    const summaries = storage.listStories();
    expect(summaries).toHaveLength(1);
    for (const s of summaries) {
      expect(isStorySummary(s)).toBe(true);
    }
  });
});

describe('isStorySummary boundary validation', () => {
  it('accepts a well-formed summary with a real date', async () => {
    const { isStorySummary } = await import('@/types/story');
    expect(
      isStorySummary(makeStory()),
    ).toBe(true);
  });

  it('rejects impossible dates, NaN/Infinity and wrong types', async () => {
    const { isStorySummary } = await import('@/types/story');
    expect(isStorySummary(makeStory({ lastModified: '2023-02-30T00:00:00Z' }))).toBe(false);
    expect(isStorySummary(makeStory({ lastModified: 'not-a-date' }))).toBe(false);
    expect(isStorySummary(makeStory({ lastModified: String(Number.POSITIVE_INFINITY) }))).toBe(false);
    expect(isStorySummary(makeStory({ title: 7 as unknown as string }))).toBe(false);
    expect(isStorySummary(makeStory({ description: 9 as unknown as string }))).toBe(false);
    expect(isStorySummary(null)).toBe(false);
    expect(isStorySummary(undefined)).toBe(false);
    expect(isStorySummary('plain')).toBe(false);
  });
});

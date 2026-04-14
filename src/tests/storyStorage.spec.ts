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

describe('StoryStorage boundary hardening (corrupted nodes payloads)', () => {
  it('upsert sanitizes a non-array nodes value into an empty array', () => {
    const storage = new StoryStorage();
    storage.upsertStory(
      makeStory({ nodes: undefined as unknown as Story['nodes'] }),
    );
    const story = storage.getStory('story-1');
    expect(story).toBeDefined();
    expect(story?.nodes).toEqual([]);
  });

  it('upsert drops malformed node entries, keeping only well-formed nodes', () => {
    const storage = new StoryStorage();
    storage.upsertStory(
      makeStory({
        nodes: [
          { id: 'start', text: 'ok', choices: [] },
          { id: 'bad', text: 7 as unknown as string, choices: [] },
          null,
          'x',
        ] as unknown as Story['nodes'],
      }),
    );
    const story = storage.getStory('story-1');
    expect(story?.nodes.map((n) => n.id)).toEqual(['start']);
    expect(story?.nodes.every((n) => Array.isArray(n.choices))).toBe(true);
  });

  it('getStory on a valid persisted story preserves its node array', () => {
    const storage = new StoryStorage();
    storage.upsertStory(
      makeStory({
        nodes: [
          { id: 'start', text: 'A', choices: [] },
          { id: 'b', text: 'B', choices: [{ id: 'c1', label: 'L', targetNodeId: 'start' }] },
        ],
      }),
    );
    const story = storage.getStory('story-1');
    expect(story?.nodes).toHaveLength(2);
    expect(story?.nodes[0]?.id).toBe('start');
    expect(story?.nodes[1]?.choices).toHaveLength(1);
  });

  it('getStory returns undefined for an unknown id', () => {
    const storage = new StoryStorage();
    storage.upsertStory(makeStory());
    expect(storage.getStory('nope')).toBeUndefined();
  });

  it('upsert stamps a fresh timestamp, so a bad lastModified is replaced', () => {
    const storage = new StoryStorage();
    storage.upsertStory(makeStory({ id: 'seed-a' }));
    storage.upsertStory(
      makeStory({
        id: 'corrupt',
        lastModified: '2023-02-30T00:00:00Z',
      }),
    );
    // Both are re-stamped with a valid timestamp on write, so both list.
    const summaries = storage.listStories();
    expect(summaries.map((s) => s.id).sort()).toEqual(['corrupt', 'seed-a']);
    for (const s of summaries) {
      expect(Number.isFinite(Date.parse(s.lastModified))).toBe(true);
    }
  });
});

describe('StoryStorage localStorage round-trip (simulated storage)', () => {
  // In the node test environment there is no real localStorage, so we
  // simulate one by defining a minimal global before constructing storage.
  function installFakeLocalStorage(initial: Record<string, string> = {}) {
    const map = new Map<string, string>(Object.entries(initial));
    const fake = {
      getItem: (k: string) => (map.has(k) ? map.get(k) : null),
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
      clear: () => map.clear(),
    };
    (globalThis as Record<string, unknown>).localStorage = fake;
    (globalThis as Record<string, unknown>).window = {};
    return { fake, map };
  }

  it('reads and validates a well-formed persisted story from localStorage', () => {
    installFakeLocalStorage();
    const storage = new StoryStorage();
    storage.upsertStory(
      makeStory({ nodes: [{ id: 'start', text: 'Hi', choices: [] }] }),
    );
    const round = storage.getStory('story-1');
    expect(round?.nodes).toHaveLength(1);
    expect(storage.listStories()).toHaveLength(1);
  });

  it('recovers a corrupted nodes array stored in localStorage to []', () => {
    const { map } = installFakeLocalStorage();
    const KEY = 'interactive-story-builder:stories';
    // Pre-seed a payload where a story's nodes is undefined.
    map.set(
      KEY,
      JSON.stringify([
        {
          id: 'legacy',
          title: 'Legacy',
          author: 'X',
          description: '',
          lastModified: new Date('2024-05-05T00:00:00Z').toISOString(),
        },
      ]),
    );
    const storage = new StoryStorage();
    const loaded = storage.getStory('legacy');
    expect(loaded).toBeDefined();
    expect(loaded?.nodes).toEqual([]);
  });

  it('drops entries with missing identity fields and keeps valid ones', () => {
    const { map } = installFakeLocalStorage();
    const KEY = 'interactive-story-builder:stories';
    map.set(
      KEY,
      JSON.stringify([
        {
          id: 'good',
          title: 'Good',
          author: 'A',
          description: '',
          lastModified: new Date('2024-05-05T00:00:00Z').toISOString(),
          nodes: [{ id: 'start', text: 's', choices: [] }],
        },
        { title: 'No id', author: 'B', description: '', lastModified: '2024-05-05T00:00:00Z' },
        'not an object',
        null,
      ]),
    );
    const storage = new StoryStorage();
    const ids = storage.listStories().map((s) => s.id);
    expect(ids).toContain('good');
    expect(ids).toHaveLength(1);
    expect(storage.getStory('good')?.nodes).toHaveLength(1);
  });

  it('returns an empty list when the stored payload is not an array', () => {
    const { map } = installFakeLocalStorage();
    const KEY = 'interactive-story-builder:stories';
    map.set(KEY, JSON.stringify({ id: 'story-1' }));
    const storage = new StoryStorage();
    expect(storage.listStories()).toEqual([]);
  });

  it('returns an empty list for malformed JSON', () => {
    const { map } = installFakeLocalStorage();
    const KEY = 'interactive-story-builder:stories';
    map.set(KEY, '{ not json');
    const storage = new StoryStorage();
    expect(storage.listStories()).toEqual([]);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { importStoryFromFile, parseStoryJson } from '@/lib/importStory';
import { StoryStorage } from '@/lib/storyStorage';
import { storyToJson } from '@/lib/storyExport';
import type { Story } from '@/types/story';

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: 'story-import',
    title: 'Imported Story',
    author: 'Author',
    description: 'desc',
    lastModified: new Date('2024-05-01T00:00:00Z').toISOString(),
    nodes: [
      {
        id: 'start',
        text: 'Hello.',
        choices: [{ id: 'c1', label: 'Go', targetNodeId: 'room' }],
      },
      { id: 'room', text: 'Room.', choices: [] },
    ],
    ...overrides,
  };
}

class FakeFile {
  name: string;
  private content: string;
  constructor(text: string, name = 'story.json') {
    this.content = text;
    this.name = name;
  }
  text(): Promise<string> {
    return Promise.resolve(this.content);
  }
}

function failingFile() {
  const f = new FakeFile('x');
  (f as unknown as { text: () => Promise<string> }).text = () => Promise.reject(new Error('boom'));
  return f;
}

describe('parseStoryJson', () => {
  it('accepts a well-formed export document', () => {
    const result = parseStoryJson(storyToJson(makeStory()));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.story.title).toBe('Imported Story');
      expect(result.story.nodes).toHaveLength(2);
    }
  });

  it('rejects unparseable JSON text with a descriptive error', () => {
    const result = parseStoryJson('{not json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Invalid JSON');
  });

  it('rejects JSON that is not story-shaped', () => {
    for (const text of ['[1,2]', '"str"', 'null', '{}', '{"id":42}']) {
      const result = parseStoryJson(text);
      expect(result.ok).toBe(false);
    }
  });

  it('rejects impossible or non-UTC lastModified timestamps', () => {
    const base = storyToJson(makeStory());
    const bad = JSON.parse(base) as Record<string, unknown>;
    for (const ts of [
      'not-a-date',
      '2023-02-30T00:00:00Z',
      String(Number.POSITIVE_INFINITY),
    ]) {
      const result = parseStoryJson(JSON.stringify({ ...bad, lastModified: ts }));
      expect(result.ok).toBe(false);
    }
  });

  it('accepts an export missing the nodes field and coerces it to []', () => {
    const base = JSON.parse(storyToJson(makeStory({ nodes: [] }))) as Record<string, unknown>;
    delete base.nodes;
    const result = parseStoryJson(JSON.stringify(base));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.story.nodes).toEqual([]);
  });

  it('drops malformed node entries, keeping only well-formed ones', () => {
    const base = JSON.parse(storyToJson(makeStory())) as Record<string, unknown>;
    (base.nodes as unknown[]).push({ id: 'bad', text: 7 }, 'junk');
    const result = parseStoryJson(JSON.stringify(base));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.story.nodes.map((n) => n.id)).toEqual(['start', 'room']);
    }
  });
});

describe('importStoryFromFile', () => {
  it('imports a valid file through an injected storage backend and upserts it', async () => {
    const storage = new StoryStorage();
    const file = new FakeFile(storyToJson(makeStory()));
    const result = await importStoryFromFile(file as unknown as File, storage);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.story.id).toBe('story-import');
      expect(storage.getStory('story-import')).toBeDefined();
      expect(storage.listStories().map((s) => s.id)).toContain('story-import');
    }
  });

  it('replaces an existing story with the same id on re-import', async () => {
    const storage = new StoryStorage();
    await importStoryFromFile(
      new FakeFile(storyToJson(makeStory({ title: 'First' }))) as unknown as File,
      storage,
    );
    const result = await importStoryFromFile(
      new FakeFile(storyToJson(makeStory({ title: 'Second' }))) as unknown as File,
      storage,
    );
    expect(result.ok).toBe(true);
    expect(storage.listStories().filter((s) => s.id === 'story-import')).toHaveLength(1);
    expect(storage.getStory('story-import')?.title).toBe('Second');
  });

  it('reports invalid JSON content without touching storage', async () => {
    const storage = new StoryStorage();
    const spy = vi.spyOn(storage, 'upsertStory');
    const result = await importStoryFromFile(
      new FakeFile('{oops') as unknown as File,
      storage,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Invalid JSON');
    expect(spy).not.toHaveBeenCalled();
  });

  it('reports file-read failures without throwing', async () => {
    const storage = new StoryStorage();
    const result = await importStoryFromFile(failingFile() as unknown as File, storage);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Could not read file');
  });
});

import { describe, expect, it } from 'vitest';
import {
  downloadStory,
  isStoryExport,
  sanitizeStoryExport,
  storyFileName,
  storyToJson,
} from '@/lib/storyExport';
import type { Story } from '@/types/story';

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: 'story-1',
    title: 'Demo Story',
    author: 'Test Author',
    description: 'A demo story for tests',
    lastModified: new Date('2024-01-02T03:04:05Z').toISOString(),
    nodes: [
      {
        id: 'start',
        text: 'Once upon a time.',
        title: 'Opening',
        backgroundColor: '#f4f6f8',
        choices: [{ id: 'c1', label: 'Enter', targetNodeId: 'room' }],
        position: { x: 10, y: 20 },
      },
      { id: 'room', text: 'A room.', choices: [] },
    ],
    ...overrides,
  };
}

describe('storyToJson', () => {
  it('serializes a full story (summary fields + node graph) to valid JSON', () => {
    const json = storyToJson(makeStory());
    const parsed: unknown = JSON.parse(json);
    expect(parsed).toMatchObject({
      id: 'story-1',
      title: 'Demo Story',
      author: 'Test Author',
      description: 'A demo story for tests',
      nodes: expect.any(Array),
    });
    const nodes = (parsed as { nodes: unknown[] }).nodes;
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({
      id: 'start',
      text: 'Once upon a time.',
      title: 'Opening',
      position: { x: 10, y: 20 },
      choices: [{ id: 'c1', label: 'Enter', targetNodeId: 'room' }],
    });
    // lastModified must be a real, finite UTC timestamp.
    expect(Number.isFinite(Date.parse((parsed as { lastModified: string }).lastModified))).toBe(true);
  });

  it('round-trips through isStoryExport', () => {
    const json = storyToJson(makeStory());
    const parsed: unknown = JSON.parse(json);
    expect(isStoryExport(parsed)).toBe(true);
    const story = sanitizeStoryExport(parsed as Parameters<typeof sanitizeStoryExport>[0]);
    expect(story.nodes).toHaveLength(2);
    expect(story.nodes[0]?.choices).toHaveLength(1);
  });
});

describe('storyFileName', () => {
  it('sanitizes forbidden filename characters', () => {
    expect(storyFileName(makeStory({ title: 'A<B>C:D' }))).toBe('A-B-C-D.json');
    expect(storyFileName(makeStory({ title: 'x/y\\z|?*n' }))).toBe('x-y-z-n.json');
  });

  it('collapses whitespace runs and trims leading/trailing dots and spaces', () => {
    expect(storyFileName(makeStory({ title: '  My   Quest  ' }))).toBe('My Quest.json');
    expect(storyFileName(makeStory({ title: '...a...' }))).toBe('a.json');
  });

  it('falls back to "story" for empty/whitespace-only titles', () => {
    expect(storyFileName(makeStory({ title: '' }))).toBe('story.json');
    expect(storyFileName(makeStory({ title: '   ' }))).toBe('story.json');
  });

  it('caps very long titles at 60 characters plus the extension', () => {
    const long = 'x'.repeat(80);
    const name = storyFileName(makeStory({ title: long }));
    expect(name.endsWith('.json')).toBe(true);
    expect(name.length).toBeLessThanOrEqual(65);
  });

  it('strips control characters', () => {
    expect(storyFileName(makeStory({ title: 'a\u0000b\u0001c' }))).toBe('abc.json');
  });
});

describe('isStoryExport boundary validation', () => {
  it('accepts a well-formed export document', () => {
    expect(isStoryExport(JSON.parse(storyToJson(makeStory())))).toBe(true);
  });

  it('rejects missing or wrong-typed identity fields', () => {
    const base = JSON.parse(storyToJson(makeStory()));
    expect(isStoryExport({ ...base, id: '' })).toBe(false);
    expect(isStoryExport({ ...base, id: 42 })).toBe(false);
    expect(isStoryExport({ ...base, title: 7 })).toBe(false);
    expect(isStoryExport({ ...base, lastModified: 'not-a-date' })).toBe(false);
    expect(isStoryExport({ ...base, lastModified: '2023-02-30T00:00:00Z' })).toBe(false);
    expect(isStoryExport(null)).toBe(false);
    expect(isStoryExport('plain')).toBe(false);
  });

  it('rejects a non-array nodes field', () => {
    const base = JSON.parse(storyToJson(makeStory()));
    expect(isStoryExport({ ...base, nodes: 'nope' })).toBe(false);
    expect(isStoryExport({ ...base, nodes: { a: 1 } })).toBe(false);
    // nodes may be absent entirely; only a present non-array is invalid.
    const { nodes, ...withoutNodes } = base;
    expect(isStoryExport(withoutNodes)).toBe(true);
  });

  it('rejects Infinity-string timestamps', () => {
    const base = JSON.parse(storyToJson(makeStory()));
    expect(isStoryExport({ ...base, lastModified: String(Number.POSITIVE_INFINITY) })).toBe(false);
  });
});

describe('sanitizeStoryExport', () => {
  it('coerces a missing nodes field into an empty array', () => {
    const base = JSON.parse(storyToJson(makeStory({ nodes: [] })));
    const { nodes, ...summary } = base;
    const story = sanitizeStoryExport(summary as Parameters<typeof sanitizeStoryExport>[0]);
    expect(story.nodes).toEqual([]);
  });

  it('drops malformed node entries, keeping only well-formed ones', () => {
    const base = JSON.parse(storyToJson(makeStory()));
    base.nodes.push({ id: 'bad', text: 7 as unknown as string, choices: [] });
    base.nodes.push(null);
    base.nodes.push('x');
    const story = sanitizeStoryExport(base as Parameters<typeof sanitizeStoryExport>[0]);
    expect(story.nodes.map((n) => n.id)).toEqual(['start', 'room']);
    expect(story.nodes.every((n) => Array.isArray(n.choices))).toBe(true);
  });

  it('coerces a corrupt nodes value into an empty array', () => {
    const base = JSON.parse(storyToJson(makeStory()));
    const story = sanitizeStoryExport({
      ...base,
      nodes: 'corrupt',
    } as Parameters<typeof sanitizeStoryExport>[0]);
    expect(story.nodes).toEqual([]);
  });
});

describe('downloadStory', () => {
  it('is a safe no-op in a DOM-less environment (node tests)', () => {
    // The node test environment has no document/Blob; the helper must
    // report inability to download instead of throwing.
    expect(downloadStory(makeStory())).toBe(false);
  });
});

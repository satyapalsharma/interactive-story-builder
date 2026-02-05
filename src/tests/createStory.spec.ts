import { describe, expect, it } from 'vitest';
import {
  createNewStory,
  MAX_AUTHOR_LENGTH,
  normalizeNewStoryInput,
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  validateNewStoryInput,
} from '@/lib/createStory';
import { StoryStorage } from '@/lib/storyStorage';
import type { StorySummary } from '@/types/story';

function makeStorageSpy() {
  const storage = new StoryStorage();
  return {
    storage,
    ids: () => storage.listStories().map((s: StorySummary) => s.id),
  };
}

describe('normalizeNewStoryInput', () => {
  it('trims whitespace from all string fields', () => {
    const result = normalizeNewStoryInput({
      title: '  A Title  ',
      author: '  Jane  ',
      description: '  Once upon a time  ',
    });
    expect(result).toEqual({
      title: 'A Title',
      author: 'Jane',
      description: 'Once upon a time',
    });
  });

  it('defaults missing author to empty string', () => {
    const result = normalizeNewStoryInput({
      title: 'T',
      description: 'D',
    });
    expect(result.author).toBe('');
  });
});

describe('validateNewStoryInput boundary checks', () => {
  it('rejects an empty or whitespace-only title', () => {
    const errors = validateNewStoryInput({ title: '   ', description: 'ok' });
    expect(errors).toEqual([{ field: 'title', message: expect.any(String) }]);
  });

  it('rejects a title that exceeds the documented length bound', () => {
    const longTitle = 'x'.repeat(MAX_TITLE_LENGTH + 1);
    const errors = validateNewStoryInput({
      title: longTitle,
      description: 'ok',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.field).toBe('title');
  });

  it('accepts a title exactly at the maximum length', () => {
    const exact = 'y'.repeat(MAX_TITLE_LENGTH);
    const errors = validateNewStoryInput({ title: exact, description: '' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a description that exceeds the documented length bound', () => {
    const tooLong = 'd'.repeat(MAX_DESCRIPTION_LENGTH + 1);
    const errors = validateNewStoryInput({ title: 'T', description: tooLong });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.field).toBe('description');
  });

  it('accepts an empty description (it is optional)', () => {
    const errors = validateNewStoryInput({ title: 'T', description: '' });
    expect(errors).toHaveLength(0);
  });

  it('rejects an author that exceeds the documented length bound', () => {
    const tooLong = 'a'.repeat(MAX_AUTHOR_LENGTH + 1);
    const errors = validateNewStoryInput({
      title: 'T',
      author: tooLong,
      description: '',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.field).toBe('author');
  });
});

describe('createNewStory', () => {
  it('creates a valid story with a starting node and persists it', () => {
    const { storage, ids } = makeStorageSpy();
    expect(ids()).toHaveLength(0);

    const result = createNewStory(
      {
        title: '  A New Quest  ',
        author: '  Ada  ',
        description: '  A brave new tale.  ',
      },
      storage,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary.title).toBe('A New Quest');
      expect(result.summary.author).toBe('Ada');
      expect(result.summary.description).toBe('A brave new tale.');
      expect(Number.isFinite(Date.parse(result.summary.lastModified))).toBe(true);
    }

    const persisted = result.ok ? storage.getStory(result.summary.id) : undefined;
    expect(persisted).toBeDefined();
    if (persisted) {
      expect(persisted.nodes).toHaveLength(1);
      expect(persisted.nodes[0]?.text).toBe('A brave new tale.');
      expect(persisted.nodes[0]?.choices).toEqual([]);
    }
  });

  it('falls back to a generic starter text when description is empty', () => {
    const { storage } = makeStorageSpy();
    const result = createNewStory({ title: 'Short', description: '   ' }, storage);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const persisted = storage.getStory(result.summary.id);
      expect(persisted?.nodes[0]?.text).toBe('The beginning of "Short".');
    }
  });

  it('defaults the author to "Unknown Author" when left blank', () => {
    const { storage } = makeStorageSpy();
    const result = createNewStory({ title: 'Anonymous', description: 'd' }, storage);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary.author).toBe('Unknown Author');
      expect(storage.getStory(result.summary.id)?.author).toBe('Unknown Author');
    }
  });

  it('returns validation errors and persists nothing for invalid input', () => {
    const { storage, ids } = makeStorageSpy();
    const before = ids().length;

    const emptyTitle = createNewStory({ title: '', description: 'x' }, storage);
    expect(emptyTitle.ok).toBe(false);

    const longDescription = createNewStory(
      {
        title: 'ok',
        description: 'z'.repeat(MAX_DESCRIPTION_LENGTH + 1),
      },
      storage,
    );
    expect(longDescription.ok).toBe(false);

    expect(ids().length).toBe(before);
  });
});

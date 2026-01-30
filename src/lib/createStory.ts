import type { Story, StoryNode, StorySummary } from '@/types/story';
import { storyStorage } from '@/lib/storyStorage';

export const MAX_TITLE_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 1000;

export type NewStoryInput = {
  title: string;
  author?: string;
  description: string;
};

export type NormalizedNewStoryInput = {
  title: string;
  author: string;
  description: string;
};

export type NewStoryInputError =
  | { field: 'title'; message: string }
  | { field: 'description'; message: string }
  | { field: 'author'; message: string };

export const MAX_AUTHOR_LENGTH = 80;

export function normalizeNewStoryInput(input: NewStoryInput): NormalizedNewStoryInput {
  return {
    title: input.title.trim(),
    author: (input.author ?? '').trim(),
    description: input.description.trim(),
  };
}

/**
 * Validate user-supplied "create story" input at the boundary.
 * Returns a list of field errors (empty list means the input is valid).
 */
export function validateNewStoryInput(input: NewStoryInput): NewStoryInputError[] {
  const errors: NewStoryInputError[] = [];
  const normalized: NormalizedNewStoryInput = normalizeNewStoryInput(input);

  if (normalized.title.length === 0) {
    errors.push({ field: 'title', message: 'Title is required.' });
  } else if (normalized.title.length > MAX_TITLE_LENGTH) {
    errors.push({
      field: 'title',
      message: `Title must be at most ${MAX_TITLE_LENGTH} characters.`,
    });
  }

  if (normalized.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push({
      field: 'description',
      message: `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`,
    });
  }

  if (normalized.author.length > MAX_AUTHOR_LENGTH) {
    errors.push({
      field: 'author',
      message: `Author must be at most ${MAX_AUTHOR_LENGTH} characters.`,
    });
  }

  return errors;
}

function makeStoryId(): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `story-${random}`;
}

function startingNode(title: string, description: string): StoryNode {
  return {
    id: 'start',
    text: description.length > 0 ? description : `The beginning of "${title}".`,
    choices: [],
  };
}

/**
 * Create a new story from user input: validates the boundary values,
 * builds a story with a single starting node, persists it through the
 * storage backend (fresh lastModified stamp), and returns the summary.
 *
 * A storage backend may be injected for testability; defaults to the
 * app-level singleton.
 */
export function createNewStory(
  input: NewStoryInput,
  storage: typeof storyStorage = storyStorage,
): { ok: true; summary: StorySummary } | { ok: false; errors: NewStoryInputError[] } {
  const errors = validateNewStoryInput(input);
  if (errors.length > 0) return { ok: false, errors };

  const normalized = normalizeNewStoryInput(input);
  const story: Story = {
    id: makeStoryId(),
    title: normalized.title,
    author: normalized.author.length > 0 ? normalized.author : 'Unknown Author',
    description: normalized.description,
    lastModified: new Date().toISOString(),
    nodes: [startingNode(normalized.title, normalized.description)],
  };
  const summary = storage.upsertStory(story);
  return { ok: true, summary };
}

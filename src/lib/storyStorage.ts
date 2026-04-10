import type { Story, StoryNode, StorySummary } from '@/types/story';
import { isStorySummary } from '@/types/story';

const STORAGE_KEY = 'interactive-story-builder:stories';

/**
 * Local-first story persistence backed by localStorage, with an in-memory
 * fallback when localStorage is unavailable (e.g. in plain node tests).
 */
export class StoryStorage {
  private readonly memory: Map<string, Story> = new Map();
  private readonly useLocalStorage: boolean;

  constructor() {
    this.useLocalStorage =
      typeof localStorage !== 'undefined' &&
      typeof window !== 'undefined';
  }

  /** Read and validate all stories, sorted most-recently modified first. */
  listStories(): StorySummary[] {
    const raw = this.readRaw();
    const summaries = raw
      .filter(isStorySummary)
      .sort((a, b) => Date.parse(b.lastModified) - Date.parse(a.lastModified));
    return summaries;
  }

  /**
   * Look up a single story by id. The entry is coerced through
   * {@link sanitizeStory} so the caller always receives a well-formed
   * `Story` (in particular a real `nodes` array), never raw deserialized
   * JSON. Returns `undefined` when the id is not found.
   */
  getStory(id: string): Story | undefined {
    const raw = this.readRaw();
    const found = raw.find((s) => s.id === id);
    return found === undefined ? undefined : sanitizeStory(found);
  }

  /** Insert or replace a story and stamp it with a fresh modification time. */
  upsertStory(story: Story): StorySummary {
    const updated: Story = {
      ...story,
      id: story.id,
      title: story.title,
      author: story.author,
      description: story.description,
      lastModified: new Date().toISOString(),
      nodes: (Array.isArray(story.nodes) ? story.nodes : []).filter(
        isStoryNode,
      ),
    };
    const raw = this.readRaw();
    const next = raw.filter((s) => s.id !== updated.id);
    next.push(updated);
    this.writeRaw(next);
    return {
      id: updated.id,
      title: updated.title,
      author: updated.author,
      description: updated.description,
      lastModified: updated.lastModified,
    };
  }

  deleteStory(id: string): boolean {
    const raw = this.readRaw();
    const next = raw.filter((s) => s.id !== id);
    if (next.length === raw.length) return false;
    this.writeRaw(next);
    return true;
  }

  private readRaw(): Story[] {
    if (this.useLocalStorage) {
      try {
        const json = localStorage.getItem(STORAGE_KEY);
        if (!json) return [];
        const parsed: unknown = JSON.parse(json);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isStoryLike).map(sanitizeStory);
      } catch {
        return [];
      }
    }
    return Array.from(this.memory.values());
  }

  private writeRaw(stories: Story[]): void {
    if (this.useLocalStorage) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stories));
      } catch {
        // Quota or privacy errors: fall back to memory so the session
        // still works; data is lost on reload, but the app stays usable.
      }
      return;
    }
    this.memory.clear();
    for (const s of stories) this.memory.set(s.id, s);
  }
}

/**
 * A deserialized entry is at least story-shaped when it is a plain object
 * carrying string id/title/author/description/lastModified. Anything else
 * (null, primitive, missing fields) is dropped wholesale.
 */
function isStoryLike(value: unknown): value is Story {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.author === 'string' &&
    typeof v.description === 'string' &&
    typeof v.lastModified === 'string'
  );
}

/**
 * Type guard for a single node entry read from untrusted JSON: it must be a
 * plain object with a string id, string text, and a choices array.
 */
function isStoryNode(value: unknown): value is StoryNode {
  if (value === null || typeof value !== 'object') return false;
  const node = value as Partial<StoryNode>;
  return (
    typeof node.id === 'string' &&
    typeof node.text === 'string' &&
    Array.isArray(node.choices)
  );
}

/**
 * Coerce a deserialized entry into a well-formed `Story` for in-memory use.
 * The critical guarantee: `nodes` is always a real, filtered array (empty
 * when the source was missing/corrupt), so the reader and editor can
 * iterate it without crashing on `undefined`/non-array data.
 */
function sanitizeStory(entry: Story): Story {
  const nodes: StoryNode[] = Array.isArray(entry.nodes)
    ? entry.nodes.filter(isStoryNode)
    : [];
  return { ...entry, nodes };
}

export const storyStorage = new StoryStorage();

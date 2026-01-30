import type { Story, StorySummary } from '@/types/story';
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

  getStory(id: string): Story | undefined {
    const raw = this.readRaw();
    return raw.find((s) => s.id === id);
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
      nodes: story.nodes ?? [],
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
        return parsed;
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

export const storyStorage = new StoryStorage();

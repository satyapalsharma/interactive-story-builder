import type { Story } from '@/types/story';
import { isStoryExport, sanitizeStoryExport } from '@/lib/storyExport';
import { storyStorage } from '@/lib/storyStorage';

export type ImportStoryResult =
  | { ok: true; story: Story }
  | { ok: false; error: string };

/**
 * Parse a JSON text payload into a story for import.
 *
 * Boundary validation: the text must be parseable JSON, and the parsed value
 * must satisfy the export shape check (`isStoryExport`) — string identity
 * fields, a real UTC timestamp, and an array (or absent) `nodes`. Malformed
 * payloads produce descriptive errors instead of throwing.
 */
export function parseStoryJson(text: string): ImportStoryResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? `Invalid JSON: ${err.message}` : 'Invalid JSON.',
    };
  }
  if (!isStoryExport(parsed)) {
    return {
      ok: false,
      error:
        'Not a valid story export: expected a JSON object with id, title, author, description and a valid lastModified timestamp.',
    };
  }
  return { ok: true, story: sanitizeStoryExport(parsed) };
}

/**
 * Read a story JSON file (from a file input) and import it.
 *
 * The storage backend may be injected for testability; defaults to the
 * app-level singleton. The imported story is upserted (same id replaces an
 * existing story with that id; a new id adds it), and a fresh modification
 * timestamp is stamped by the storage layer.
 */
export function importStoryFromFile(
  file: File,
  storage: typeof storyStorage = storyStorage,
): Promise<ImportStoryResult> {
  return file
    .text()
    .then((text) => {
      const parsed = parseStoryJson(text);
      if (!parsed.ok) return parsed;
      const summary = storage.upsertStory(parsed.story);
      const story = storage.getStory(summary.id);
      return {
        ok: true as const,
        story: story ?? { ...parsed.story, lastModified: summary.lastModified },
      };
    })
    .catch((err: unknown) => ({
      ok: false as const,
      error:
        err instanceof Error
          ? `Could not read file: ${err.message}`
          : 'Could not read file.',
    }));
}

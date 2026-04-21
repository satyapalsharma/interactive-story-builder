import type { Story, StoryNode, StorySummary } from '@/types/story';
import { isValidUtcTimestamp } from '@/types/story';

/**
 * Serialize a story into a portable JSON document for download/backup.
 *
 * The export is a clean, canonical snapshot of the story: the summary
 * fields plus the full node graph (text, titles, colors, choices, and
 * canvas positions). It contains only data the app itself produced, so
 * there is nothing to strip or normalize beyond what a `Story` already
 * guarantees.
 */
export function storyToJson(story: Story): string {
  return JSON.stringify({
    id: story.id,
    title: story.title,
    author: story.author,
    description: story.description,
    lastModified: story.lastModified,
    nodes: story.nodes,
  }, null, 2);
}

/**
 * Build a safe, human-friendly filename for an exported story.
 *
 * The filename is derived from the story title, not an arbitrary input:
 * invalid filename characters are replaced, leading/trailing dots and
 * spaces are trimmed, and an empty result falls back to the story id.
 * The result always ends in `.json`.
 */
export function storyFileName(story: Pick<Story, 'title' | 'id'>): string {
  const base = sanitizeFileNamePart(story.title);
  return `${base}.json`;
}

/**
 * Replace characters that are not usable in a cross-platform filename
 * (`<>:"/\|?*` and control characters) and collapse whitespace runs.
 * Empty/whitespace-only input yields a fallback.
 */
function sanitizeFileNamePart(raw: string): string {
  if (typeof raw !== 'string') return 'story';
  const cleaned = raw
    // Strip control characters outright.
    .replace(/[\u0000-\u001f\u007f]/g, '')
    // Replace the classic forbidden filename characters with '-'.
    .replace(/[<>:"/\\|?*]/g, '-')
    // Collapse runs of whitespace into a single space; drop leading/
    // trailing dots and spaces.
    .replace(/ +/g, ' ')
    // Collapse the runs of hyphens the forbidden-char replacement created.
    .replace(/-+/g, '-')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .trim();
  // Keep the name short enough to stay readable in file managers.
  const capped =
    cleaned.length > 60 ? cleaned.slice(0, 60).trimEnd() : cleaned;
  return capped.length > 0 ? capped : 'story';
}

/**
 * Trigger a client-side download of `story` as a `.json` file.
 *
 * The blob and object URL are created locally; the anchor click is
 * dispatched synchronously and the URL is revoked afterwards. In
 * environments without a DOM (e.g. plain node tests) the helper is a
 * no-op and reports that fact instead of throwing.
 */
export function downloadStory(story: Story): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return false;
  }
  const json = storyToJson(story);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = storyFileName(story);
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return true;
}

// ---------------------------------------------------------------------------
// Import-side boundary validation (for a future "import JSON" feature and
// for round-trip testing of the export format).
// ---------------------------------------------------------------------------

/**
 * A deserialized export is at least story-shaped when it is a plain object
 * with string identity fields, a valid UTC timestamp, and an array (or
 * missing) `nodes` field.
 */
export function isStoryExport(value: unknown): value is Story {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    v.id.length > 0 &&
    typeof v.title === 'string' &&
    typeof v.author === 'string' &&
    typeof v.description === 'string' &&
    typeof v.lastModified === 'string' &&
    isValidUtcTimestamp(v.lastModified) &&
    (v.nodes === undefined || Array.isArray(v.nodes))
  );
}

/**
 * Coerce a deserialized export into a well-formed `Story` for in-memory
 * use: mirrors the storage-layer guarantee that `nodes` is always a real,
 * filtered array. Entries with missing or non-array nodes become `[]`.
 */
export function sanitizeStoryExport(
  entry: StorySummary & { nodes?: unknown },
): Story {
  const rawNodes = entry.nodes;
  const nodes: StoryNode[] = Array.isArray(rawNodes)
    ? rawNodes.filter(isStoryNodeLike)
    : [];
  return {
    id: entry.id,
    title: entry.title,
    author: entry.author,
    description: entry.description,
    lastModified: entry.lastModified,
    nodes,
  };
}

/**
 * A node entry is at least node-shaped when it is a plain object with a
 * string id, string text, and a choices array.
 */
function isStoryNodeLike(value: unknown): value is StoryNode {
  if (value === null || typeof value !== 'object') return false;
  const node = value as Partial<StoryNode>;
  return (
    typeof node.id === 'string' &&
    typeof node.text === 'string' &&
    Array.isArray(node.choices)
  );
}
